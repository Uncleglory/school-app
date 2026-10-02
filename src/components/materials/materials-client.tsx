"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import { createMaterial, deleteMaterial } from "@/server/actions/materials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { Plus, ExternalLink, Trash2, UploadCloud } from "lucide-react";

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

export function MaterialsClient({ materials, classes, subjects, userRole }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const canManage = ["ADMIN", "TEACHER"].includes(userRole);

  // Form fields
  const [title, setTitle] = useState("");
  const [type, setType] = useState("NOTE");
  const [fileUrl, setFileUrl] = useState("");

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setTitle("");
    setType("NOTE");
    setFileUrl("");
    setFileName("");
    setProgress(0);
    setUploading(false);
    setDragActive(false);
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
        err?.message ||
          "Upload failed. Check your network and try again."
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
      setMessage("Please upload a file or paste a link first.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createMaterial({
          title: title.trim(),
          description: (fd.get("description") as string) || undefined,
          type: type as any,
          fileUrl: fileUrl.trim(),
          classId: (fd.get("classId") as string) || undefined,
          subjectId: (fd.get("subjectId") as string) || undefined,
          visibleToStudents: fd.get("visibleToStudents") === "on",
        });
        setShowForm(false);
        resetForm();
        setMessage("Material uploaded");
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

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800">
          {message}
          <button className="ml-3 underline" onClick={() => setMessage("")}>dismiss</button>
        </div>
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              if (showForm) resetForm();
              setShowForm(!showForm);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Material
          </Button>
        </div>
      )}

      {showForm && canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upload Material</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
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

              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input
                  name="title"
                  required
                  placeholder="Chapter 5 Notes"
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
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>File URL / Link (filled in automatically after upload, or paste your own)</Label>
                <Input
                  name="fileUrl"
                  placeholder="https://..."
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Class (optional)</Label>
                <select name="classId" className="flex h-9 w-full rounded-md border px-3 text-sm">
                  <option value="">All</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject (optional)</Label>
                <select name="subjectId" className="flex h-9 w-full rounded-md border px-3 text-sm">
                  <option value="">All</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Input name="description" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" name="visibleToStudents" id="vis" defaultChecked className="h-4 w-4" />
                <Label htmlFor="vis">Visible to students</Label>
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={isPending || uploading}>Save</Button>
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {materials.length === 0 ? (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-12 text-center text-muted-foreground">
              No materials yet.
            </CardContent>
          </Card>
        ) : (
          materials.map((m) => (
            <Card key={m.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-snug">{m.title}</CardTitle>
                  <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs">{m.type.replace("_", " ")}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {m.description && <p className="text-muted-foreground line-clamp-2">{m.description}</p>}
                <p className="text-xs text-muted-foreground">
                  {m.subject?.name || "General"}
                  {m.class ? ` · ${m.class.name}` : ""}
                  {" · "}
                  {m.uploadedBy.lastName} {m.uploadedBy.firstName}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</p>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" asChild>
                    <a href={m.fileUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Open
                    </a>
                  </Button>
                  {canManage && (
                    <Button size="sm" variant="ghost" className="text-red-600" disabled={isPending} onClick={() => handleDelete(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
