"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { createMaterial, deleteMaterial } from "@/server/actions/materials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import {
  Plus,
  ExternalLink,
  Trash2,
  UploadCloud,
  Folder,
  ChevronRight,
  ArrowLeft,
  Search,
  Link2,
} from "lucide-react";

type Material = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  fileUrl: string;
  visibleToStudents: boolean;
  createdAt: string;
  class: { name: string } | null;
  subject: { name: string } | null;
  uploadedBy: { firstName: string; lastName: string };
};

interface Props {
  materials: Material[];
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  userRole: string;
}

// ─── Folder setup ───────────────────────────────
const LEVELS = [
  "Lower Classes",
  "Primary",
  "Junior Secondary",
  "Senior Secondary",
  "General (All Levels)",
];

const PRESET_SECTIONS = ["Free Curriculum Books", "Past Questions"];

// The folder is stored at the start of the description, like:
// [[folder:Primary/Past Questions/English]]
const FOLDER_MARKER = /^\[\[folder:([^\]]*)\]\]\s*([\s\S]*)$/;

function parseDescription(raw: string | null) {
  const text = raw || "";
  const match = text.match(FOLDER_MARKER);
  if (!match) return { path: [] as string[], description: text.trim() };
  const path = match[1]
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return { path, description: match[2].trim() };
}

function buildDescription(path: string[], description: string) {
  const text = description.trim();
  if (path.length === 0) return text || undefined;
  return `[[folder:${path.join("/")}]]${text ? "\n" + text : ""}`;
}

function cleanName(value: string) {
  return value.replace(/[\/\[\]]/g, "-").trim();
}

function isPrefix(path: string[], prefix: string[]) {
  return prefix.every(
    (part, i) => (path[i] || "").toLowerCase() === part.toLowerCase()
  );
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  names.forEach((name) => {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(name);
    }
  });
  return result;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isUploadedFile(url: string) {
  return url.includes("blob.vercel-storage.com");
}

export function MaterialsClient({ materials, classes, subjects, userRole }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const canManage = ["ADMIN", "TEACHER"].includes(userRole);

  // Folder navigation + search
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState("NOTE");
  const [fileUrl, setFileUrl] = useState("");
  const [folderLevel, setFolderLevel] = useState("");
  const [folderName, setFolderName] = useState("");
  const [subFolder, setSubFolder] = useState("");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Materials with their folder separated from the description
  const items = useMemo(
    () =>
      materials.map((m) => {
        const parsed = parseDescription(m.description);
        return { ...m, path: parsed.path, cleanDescription: parsed.description };
      }),
    [materials]
  );

  const depth = currentPath.length;

  // Folders to show at the current level
  const folderTiles = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();

    const add = (name: string, count: number) => {
      const key = name.toLowerCase();
      const existing = map.get(key);
      if (existing) existing.count += count;
      else map.set(key, { name, count });
    };

    // Folders that are always visible
    if (depth === 0) {
      LEVELS.forEach((level) => add(level, 0));
    } else if (depth === 1) {
      PRESET_SECTIONS.forEach((section) => add(section, 0));
      subjects.forEach((s) => add(s.name, 0));
    } else if (
      depth === 2 &&
      PRESET_SECTIONS.some((s) => s.toLowerCase() === currentPath[1].toLowerCase())
    ) {
      subjects.forEach((s) => add(s.name, 0));
    }

    // Folders that really contain materials
    items.forEach((m) => {
      if (m.path.length > depth && isPrefix(m.path, currentPath)) {
        add(m.path[depth], 1);
      }
    });

    return Array.from(map.values());
  }, [items, subjects, currentPath, depth]);

  // Materials directly inside the current folder
  const itemsHere = useMemo(
    () =>
      items.filter(
        (m) => m.path.length === depth && isPrefix(m.path, currentPath)
      ),
    [items, currentPath, depth]
  );

  // Search across all folders
  const query = search.trim().toLowerCase();
  const searching = query.length > 0;
  const searchResults = useMemo(() => {
    if (!searching) return [];
    return items.filter((m) =>
      [m.title, m.cleanDescription, m.path.join(" "), m.subject?.name || "", m.fileUrl]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [items, query, searching]);

  const visibleItems = searching ? searchResults : itemsHere;

  // Suggestions for the folder boxes in the form
  const sectionSuggestions = useMemo(() => {
    const custom: string[] = [];
    items.forEach((m) => {
      if (
        m.path.length >= 2 &&
        m.path[0].toLowerCase() === folderLevel.toLowerCase()
      ) {
        custom.push(m.path[1]);
      }
    });
    return uniqueNames([...PRESET_SECTIONS, ...subjects.map((s) => s.name), ...custom]);
  }, [items, subjects, folderLevel]);

  const subSuggestions = useMemo(() => {
    const custom: string[] = [];
    items.forEach((m) => {
      if (
        m.path.length >= 3 &&
        m.path[0].toLowerCase() === folderLevel.toLowerCase() &&
        m.path[1].toLowerCase() === folderName.trim().toLowerCase()
      ) {
        custom.push(m.path[2]);
      }
    });
    return uniqueNames([...subjects.map((s) => s.name), ...custom]);
  }, [items, subjects, folderLevel, folderName]);

  // Where the new material will be saved
  const chosenLevel = cleanName(folderLevel);
  const chosenFolder = chosenLevel ? cleanName(folderName) : "";
  const chosenSub = chosenFolder ? cleanName(subFolder) : "";
  const chosenPath = [chosenLevel, chosenFolder, chosenSub].filter(Boolean);

  function resetForm() {
    setTitle("");
    setType("NOTE");
    setFileUrl("");
    setFileName("");
    setProgress(0);
    setUploading(false);
    setDragActive(false);
    setFolderLevel("");
    setFolderName("");
    setSubFolder("");
  }

  function openForm() {
    resetForm();
    // Start in the folder you are currently viewing
    setFolderLevel(currentPath[0] || "");
    setFolderName(currentPath[1] || "");
    setSubFolder(currentPath[2] || "");
    setShowForm(true);
  }

  async function uploadFile(file: File) {
    setUploading(true);
    setProgress(0);
    setMessage("");

    try {
      const blob = await upload(`materials/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => {
          setProgress(Math.round(percentage));
        },
      });

      setFileUrl(blob.url);
      setFileName(file.name);

      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }

      if (file.type.startsWith("video/")) {
        setType("VIDEO");
      } else if (
        file.type === "application/vnd.ms-powerpoint" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      ) {
        setType("SLIDE");
      }

      setMessage("File uploaded. Check the details below, then tap Save.");
    } catch (err: any) {
      setFileUrl("");
      setFileName("");
      setMessage(
        err?.message || "Upload failed. Check your network and try again."
      );
    } finally {
      setUploading(false);
    }
  }

  function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (uploading) {
      setMessage("Please wait for the upload to finish.");
      return;
    }
    if (!fileUrl.trim()) {
      setMessage("Please upload a file or paste a website link first.");
      return;
    }

    // Add https:// if the link was pasted without it
    let finalUrl = fileUrl.trim();
    if (!/^https?:\/\//i.test(finalUrl)) {
      finalUrl = "https://" + finalUrl;
    }

    const fd = new FormData(e.currentTarget);
    const savePath = chosenPath;

    startTransition(async () => {
      try {
        await createMaterial({
          title: title.trim(),
          description: buildDescription(
            savePath,
            (fd.get("description") as string) || ""
          ),
          type: type as any,
          fileUrl: finalUrl,
          classId: (fd.get("classId") as string) || undefined,
          subjectId: (fd.get("subjectId") as string) || undefined,
          visibleToStudents: fd.get("visibleToStudents") === "on",
        });
        setShowForm(false);
        resetForm();
        setSearch("");
        setCurrentPath(savePath);
        setMessage(
          savePath.length > 0
            ? `Saved in: ${savePath.join(" / ")}`
            : "Material uploaded"
        );
      } catch (err: any) {
        setMessage(err.message);
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this material?")) return;
    startTransition(async () => {
      try {
        await deleteMaterial(id);
        setMessage("Deleted");
      } catch (err: any) {
        setMessage(err.message);
      }
    });
  }

  function openFolder(name: string) {
    setSearch("");
    setCurrentPath([...currentPath, name]);
  }

  function goBack() {
    setCurrentPath(currentPath.slice(0, -1));
  }

  function goToCrumb(index: number) {
    // index -1 means the main Materials page
    setCurrentPath(currentPath.slice(0, index + 1));
  }

  const nothingHere =
    !searching && folderTiles.length === 0 && itemsHere.length === 0;

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800">
          {message}
          <button className="ml-3 underline" onClick={() => setMessage("")}>
            dismiss
          </button>
        </div>
      )}

      {/* Search + Add */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search all materials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              if (showForm) {
                resetForm();
                setShowForm(false);
              } else {
                openForm();
              }
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Material
          </Button>
        )}
      </div>

      {/* Add form */}
      {showForm && canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Material</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
              {/* Folder choice */}
              <div className="sm:col-span-2 rounded-md border bg-slate-50 p-3 space-y-3">
                <p className="text-sm font-medium">Where should it go?</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Level</Label>
                    <select
                      value={folderLevel}
                      onChange={(e) => setFolderLevel(e.target.value)}
                      className="flex h-9 w-full rounded-md border bg-white px-3 text-sm"
                    >
                      <option value="">No folder</option>
                      {LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {level}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Folder</Label>
                    <Input
                      list="folder-suggestions"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      placeholder="e.g. Past Questions"
                      disabled={!folderLevel}
                    />
                    <datalist id="folder-suggestions">
                      {sectionSuggestions.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sub-folder (optional)</Label>
                    <Input
                      list="subfolder-suggestions"
                      value={subFolder}
                      onChange={(e) => setSubFolder(e.target.value)}
                      placeholder="e.g. English"
                      disabled={!folderName.trim()}
                    />
                    <datalist id="subfolder-suggestions">
                      {subSuggestions.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {chosenPath.length > 0
                    ? `Will be saved in: ${chosenPath.join(" / ")}`
                    : "Will be saved in the main list (no folder)."}{" "}
                  Type a new name to make a new folder.
                </p>
              </div>

              {/* Upload box */}
              <div className="sm:col-span-2 space-y-2">
                <Label>Upload a file from your phone or computer</Label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                  onClick={() => !uploading && inputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center text-sm transition-colors ${
                    dragActive
                      ? "border-emerald-600 bg-emerald-50"
                      : "border-slate-300 hover:bg-slate-50"
                  } ${uploading ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <UploadCloud className="h-8 w-8 text-slate-500" />
                  {uploading ? (
                    <div className="w-full max-w-xs space-y-2">
                      <p className="font-medium">Uploading… {progress}%</p>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full bg-emerald-600 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Keep this page open until it reaches 100%.
                      </p>
                    </div>
                  ) : fileName ? (
                    <p className="font-medium text-emerald-700">
                      Uploaded: {fileName}
                    </p>
                  ) : (
                    <>
                      <p className="font-medium">Tap here to choose a file</p>
                      <p className="text-xs text-muted-foreground">
                        or drag and drop it here (video, PDF, slides, notes, images)
                      </p>
                    </>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    onChange={handleFileChosen}
                    accept="video/*,audio/*,image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                  />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>
                  Website link (paste a link here, or leave it to use the uploaded file)
                </Label>
                <Input
                  name="fileUrl"
                  placeholder="https://www.example.com/free-books"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  name="title"
                  required
                  placeholder="Primary 4 English Textbook"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="flex h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="NOTE">Note</option>
                  <option value="ASSIGNMENT">Assignment</option>
                  <option value="SLIDE">Slide</option>
                  <option value="PAST_PAPER">Past Paper</option>
                  <option value="VIDEO">Video</option>
                  <option value="OTHER">Other (website, book)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Class (optional)</Label>
                <select
                  name="classId"
                  className="flex h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">All</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject (optional)</Label>
                <select
                  name="subjectId"
                  className="flex h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">All</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Input name="description" />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="visibleToStudents"
                  id="vis"
                  defaultChecked
                  className="h-4 w-4"
                />
                <Label htmlFor="vis">Visible to students</Label>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={isPending || uploading}>
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Path bar */}
      {!searching && (
        <div className="flex flex-wrap items-center gap-1 text-sm">
          {depth > 0 && (
            <Button size="sm" variant="outline" className="mr-1 h-7" onClick={goBack}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
          )}
          <button
            className={`rounded px-1.5 py-0.5 hover:bg-muted ${
              depth === 0 ? "font-semibold" : "text-muted-foreground"
            }`}
            onClick={() => goToCrumb(-1)}
          >
            Materials
          </button>
          {currentPath.map((name, index) => (
            <span key={index} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                className={`rounded px-1.5 py-0.5 hover:bg-muted ${
                  index === depth - 1 ? "font-semibold" : "text-muted-foreground"
                }`}
                onClick={() => goToCrumb(index)}
              >
                {name}
              </button>
            </span>
          ))}
        </div>
      )}

      {searching && (
        <p className="text-sm text-muted-foreground">
          {searchResults.length} result{searchResults.length === 1 ? "" : "s"} for “{search}”
        </p>
      )}

      {/* Folder tiles */}
      {!searching && folderTiles.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {folderTiles.map((folder) => (
            <button
              key={folder.name}
              onClick={() => openFolder(folder.name)}
              className="flex items-center gap-3 rounded-lg border bg-white p-3 text-left transition-shadow hover:shadow-md"
            >
              <Folder className="h-8 w-8 shrink-0 text-amber-500" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {folder.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {folder.count === 0
                    ? "Empty"
                    : `${folder.count} item${folder.count === 1 ? "" : "s"}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Materials in this folder */}
      {!searching && depth === 0 && itemsHere.length > 0 && (
        <p className="text-sm font-medium text-muted-foreground">
          Not in a folder
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibleItems.map((m) => (
          <Card key={m.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug">{m.title}</CardTitle>
                <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs">
                  {m.type.replace("_", " ")}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {m.cleanDescription && (
                <p className="text-muted-foreground line-clamp-2">
                  {m.cleanDescription}
                </p>
              )}
              {searching && m.path.length > 0 && (
                <p className="text-xs text-amber-700">
                  Folder: {m.path.join(" / ")}
                </p>
              )}
              {!isUploadedFile(m.fileUrl) && hostOf(m.fileUrl) && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Link2 className="h-3 w-3" /> {hostOf(m.fileUrl)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {m.subject?.name || "General"}
                {m.class ? ` · ${m.class.name}` : ""}
                {" · "}
                {m.uploadedBy.lastName} {m.uploadedBy.firstName}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDate(m.createdAt)}
              </p>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" asChild>
                  <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                  </a>
                </Button>
                {canManage && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    disabled={isPending}
                    onClick={() => handleDelete(m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {searching && searchResults.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nothing found. Try another word.
          </CardContent>
        </Card>
      )}

      {nothingHere && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {canManage
              ? "This folder is empty. Tap Add Material to put something here."
              : "Nothing here yet."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
