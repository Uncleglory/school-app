"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  createLibraryItem,
  deleteLibraryItem,
} from "@/server/actions/learning-library";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  FlaskConical,
  Folder,
  Headphones,
  HelpCircle,
  Image as ImageIcon,
  PlayCircle,
  Plus,
  Search,
  Trash2,
  Trophy,
} from "lucide-react";

type ItemType =
  | "VIDEO"
  | "AUDIO"
  | "NOTES"
  | "TEXTBOOK"
  | "STORYBOOK"
  | "WORKSHEET"
  | "QUIZ"
  | "PICTURE"
  | "PRACTICAL"
  | "EXAM_PREP";

type LibraryItem = {
  id: string;
  title: string;
  description: string | null;
  type: ItemType;
  topic: string;
  sourceName: string | null;
  url: string;
  addedById: string;
  class: { id: string; name: string } | null;
  subject: { id: string; name: string } | null;
  addedBy: { firstName: string; lastName: string };
};

interface Props {
  items: LibraryItem[];
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
  userRole: string;
  userId: string;
  studentClass: string | null;
}

const TYPES: {
  value: ItemType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: "VIDEO", label: "Video", icon: PlayCircle },
  { value: "AUDIO", label: "Audio", icon: Headphones },
  { value: "NOTES", label: "Notes", icon: FileText },
  { value: "TEXTBOOK", label: "Textbook", icon: BookOpen },
  { value: "STORYBOOK", label: "Storybook", icon: BookMarked },
  { value: "WORKSHEET", label: "Worksheet", icon: ClipboardList },
  { value: "QUIZ", label: "Quiz", icon: HelpCircle },
  { value: "PICTURE", label: "Picture / Chart", icon: ImageIcon },
  { value: "PRACTICAL", label: "Practical", icon: FlaskConical },
  { value: "EXAM_PREP", label: "Past Questions", icon: Trophy },
];

const TYPE_MAP = Object.fromEntries(TYPES.map((t) => [t.value, t]));

const SOURCE_SUGGESTIONS = [
  "Glory Schools",
  "eLearn Nigeria",
  "NERDC",
  "Khan Academy",
  "Khan Academy Kids",
  "British Council LearnEnglish",
  "StoryWeaver",
  "OpenStax",
  "CK-12",
  "YouTube",
];

const GENERAL = "__general__";

type Section = "early" | "primary" | "junior" | "senior";

const SECTIONS: { value: Section; label: string; hint: string }[] = [
  { value: "early", label: "Lower Classes", hint: "Crèche, KG, Nursery" },
  { value: "primary", label: "Primary", hint: "Primary 1 to 5" },
  { value: "junior", label: "Junior Secondary", hint: "JS 1 to 3" },
  { value: "senior", label: "Senior Secondary", hint: "SS 1 to 3" },
];

// Works out which section a class belongs to, whatever spelling was used
function sectionOf(className: string): Section | null {
  const n = className
    .toLowerCase()
    .replace(/[èé]/g, "e")
    .replace(/[^a-z0-9]/g, "");
  if (/(creche|kg[12]|nursery|nur[12]|nost[12])/.test(n)) return "early";
  if (/(primary|pry)[1-5]/.test(n)) return "primary";
  if (/(juniorsecondary|jss|js|gs)[1-3]/.test(n)) return "junior";
  if (/(seniorsecondary|sss|ss)[1-3]/.test(n)) return "senior";
  return null;
}

const selectClass = "flex h-9 w-full rounded-md border bg-white px-3 text-sm";

export function LearningLibraryClient({
  items,
  classes,
  subjects,
  userRole,
  userId,
  studentClass,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isStaff = ["ADMIN", "MANAGER"].includes(userRole) || userRole === "TEACHER";

  // Browsing
  const [section, setSection] = useState<Section | "">("");
  const [classFilter, setClassFilter] = useState("");
  const [subjectKey, setSubjectKey] = useState<string | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<ItemType | "">("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fType, setFType] = useState<ItemType>("NOTES");
  const [fClass, setFClass] = useState("");
  const [fSubject, setFSubject] = useState("");
  const [fTopic, setFTopic] = useState("");
  const [fSource, setFSource] = useState("");
  const [fUrl, setFUrl] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadedName, setUploadedName] = useState("");

  const subjectKeyOf = (i: LibraryItem) => i.subject?.id ?? GENERAL;
  const subjectNameOf = (i: LibraryItem) => i.subject?.name ?? "General";

  // Section, class and type filters apply everywhere.
  // When no single class is chosen, the same material that was added to
  // several classes is shown only once.
  const filtered = useMemo(() => {
    const seen = new Set<string>();
    return items.filter((i) => {
      // "All classes" items are shown in every section and class
      if (section && i.class && sectionOf(i.class.name) !== section) return false;
      if (classFilter && i.class && i.class.id !== classFilter) return false;
      if (typeFilter && i.type !== typeFilter) return false;
      if (!classFilter) {
        const key = `${i.title}|${i.url}|${i.subject?.id ?? ""}`;
        if (seen.has(key)) return false;
        seen.add(key);
      }
      return true;
    });
  }, [items, section, classFilter, typeFilter]);

  const sectionCounts = useMemo(() => {
    const sets: Record<Section, Set<string>> = {
      early: new Set(),
      primary: new Set(),
      junior: new Set(),
      senior: new Set(),
    };
    items.forEach((i) => {
      if (!i.class) return;
      const s = sectionOf(i.class.name);
      if (s) sets[s].add(`${i.title}|${i.url}|${i.subject?.id ?? ""}`);
    });
    return {
      early: sets.early.size,
      primary: sets.primary.size,
      junior: sets.junior.size,
      senior: sets.senior.size,
    };
  }, [items]);

  const visibleClasses = useMemo(
    () => classes.filter((c) => !section || sectionOf(c.name) === section),
    [classes, section]
  );

  function chooseSection(next: Section | "") {
    setSection(next);
    setSubjectKey(null);
    setTopic(null);
    if (next && classFilter) {
      const current = classes.find((c) => c.id === classFilter);
      if (!current || sectionOf(current.name) !== next) setClassFilter("");
    }
  }

  const query = search.trim().toLowerCase();
  const searching = query.length > 0;

  const searchResults = useMemo(() => {
    if (!searching) return [];
    return filtered.filter((i) =>
      [i.title, i.topic, i.description || "", i.sourceName || "", subjectNameOf(i)]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [filtered, query, searching]);

  // Level 1: subjects
  const subjectTiles = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>();
    filtered.forEach((i) => {
      const key = subjectKeyOf(i);
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { key, name: subjectNameOf(i), count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  // Level 2: topics inside the chosen subject
  const topicTiles = useMemo(() => {
    if (!subjectKey) return [];
    const map = new Map<string, { name: string; count: number }>();
    filtered
      .filter((i) => subjectKeyOf(i) === subjectKey)
      .forEach((i) => {
        const key = i.topic.toLowerCase();
        const existing = map.get(key);
        if (existing) existing.count += 1;
        else map.set(key, { name: i.topic, count: 1 });
      });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered, subjectKey]);

  // Level 3: materials inside the chosen topic
  const topicItems = useMemo(() => {
    if (!subjectKey || !topic) return [];
    return filtered.filter(
      (i) =>
        subjectKeyOf(i) === subjectKey &&
        i.topic.toLowerCase() === topic.toLowerCase()
    );
  }, [filtered, subjectKey, topic]);

  const currentSubjectName =
    subjectTiles.find((s) => s.key === subjectKey)?.name ?? "";

  // Existing topics, offered as suggestions in the form
  const topicSuggestions = useMemo(() => {
    const names = new Map<string, string>();
    items
      .filter((i) => (fSubject ? i.subject?.id === fSubject : !i.subject))
      .forEach((i) => names.set(i.topic.toLowerCase(), i.topic));
    return Array.from(names.values());
  }, [items, fSubject]);

  function goBack() {
    if (topic) setTopic(null);
    else setSubjectKey(null);
  }

  function openForm() {
    setMessage("");
    setFClass(classFilter);
    setFSubject(subjectKey && subjectKey !== GENERAL ? subjectKey : "");
    setFTopic(topic ?? "");
    setShowForm(true);
  }

  function resetForm() {
    setFTitle("");
    setFType("NOTES");
    setFClass("");
    setFSubject("");
    setFTopic("");
    setFSource("");
    setFUrl("");
    setFDescription("");
    setUploadedName("");
    setProgress(0);
  }

  async function handleFile(file: File) {
    setUploading(true);
    setProgress(0);
    setMessage("");
    try {
      const blob = await upload(`library/${file.name}`, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
      });
      setFUrl(blob.url);
      setUploadedName(file.name);
      if (!fTitle.trim()) setFTitle(file.name.replace(/\.[^/.]+$/, ""));
      if (!fSource.trim()) setFSource("Glory Schools");
      if (file.type.startsWith("video/")) setFType("VIDEO");
      else if (file.type.startsWith("audio/")) setFType("AUDIO");
      else if (file.type.startsWith("image/")) setFType("PICTURE");
    } catch (err: any) {
      setMessage(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    startTransition(async () => {
      try {
        await createLibraryItem({
          title: fTitle,
          description: fDescription,
          type: fType,
          topic: fTopic,
          sourceName: fSource,
          url: fUrl,
          classId: fClass || undefined,
          subjectId: fSubject || undefined,
        });
        resetForm();
        setShowForm(false);
        setMessage("Material added.");
        router.refresh();
      } catch (err: any) {
        setMessage(err?.message || "Could not save. Please try again.");
      }
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this material from the library?")) return;
    startTransition(async () => {
      try {
        await deleteLibraryItem(id);
        setMessage("Material deleted.");
        router.refresh();
      } catch (err: any) {
        setMessage(err?.message || "Could not delete.");
      }
    });
  }

  function renderItem(item: LibraryItem) {
    const meta = TYPE_MAP[item.type];
    const Icon = meta?.icon ?? FileText;
    const canDelete = ["ADMIN", "MANAGER"].includes(userRole) || item.addedById === userId;
    return (
      <div
        key={item.id}
        className="flex items-start gap-3 rounded-lg border bg-white p-3"
      >
        <div className="mt-0.5 rounded-md bg-muted p-2">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-snug">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {meta?.label ?? item.type}
            {item.sourceName ? ` · ${item.sourceName}` : ""}
            {searching ? ` · ${subjectNameOf(item)} › ${item.topic}` : ""}
            {isStaff && item.class ? ` · ${item.class.name}` : ""}
            {isStaff && !item.class ? " · All classes" : ""}
          </p>
          {item.description && (
            <p className="mt-1 text-sm text-muted-foreground">
              {item.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild size="sm" variant="outline">
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              Open <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
          {isStaff && canDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => handleDelete(item.id)}
              disabled={isPending}
              aria-label="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  const nothingYet = items.length === 0;

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md border bg-muted px-3 py-2 text-sm">
          {message}
        </div>
      )}

      {/* Sections */}
      {isStaff && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          <button
            onClick={() => chooseSection("")}
            className={`rounded-xl border p-3 text-left shadow-sm hover:bg-accent ${
              section === "" ? "border-primary bg-accent" : "bg-card"
            }`}
          >
            <p className="font-medium">All sections</p>
            <p className="text-xs text-muted-foreground">Everything</p>
          </button>
          {SECTIONS.map((s) => (
            <button
              key={s.value}
              onClick={() => chooseSection(s.value)}
              className={`rounded-xl border p-3 text-left shadow-sm hover:bg-accent ${
                section === s.value ? "border-primary bg-accent" : "bg-card"
              }`}
            >
              <p className="font-medium">
                {s.label}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({sectionCounts[s.value]})
                </span>
              </p>
              <p className="text-xs text-muted-foreground">{s.hint}</p>
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, topic or source"
            className="pl-9"
          />
        </div>
        {isStaff && (
          <select
            value={classFilter}
            onChange={(e) => {
              setClassFilter(e.target.value);
              setSubjectKey(null);
              setTopic(null);
            }}
            className={`${selectClass} sm:w-48`}
          >
            <option value="">
              {section
                ? `All ${SECTIONS.find((s) => s.value === section)?.label} classes`
                : "All classes"}
            </option>
            {visibleClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        {isStaff && (
          <Button onClick={openForm}>
            <Plus className="mr-1 h-4 w-4" /> Add material
          </Button>
        )}
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={typeFilter === "" ? "default" : "outline"}
          onClick={() => setTypeFilter("")}
        >
          All
        </Button>
        {TYPES.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={typeFilter === t.value ? "default" : "outline"}
            onClick={() => setTypeFilter(t.value)}
          >
            <t.icon className="mr-1 h-3 w-3" /> {t.label}
          </Button>
        ))}
      </div>

      {/* Add form */}
      {showForm && isStaff && (
        <Card>
          <CardHeader>
            <CardTitle>Add to Learning Library</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Title</Label>
                  <Input
                    value={fTitle}
                    onChange={(e) => setFTitle(e.target.value)}
                    placeholder="e.g. Introduction to Fractions"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <select
                    value={fType}
                    onChange={(e) => setFType(e.target.value as ItemType)}
                    className={selectClass}
                  >
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Class</Label>
                  <select
                    value={fClass}
                    onChange={(e) => setFClass(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All classes</option>
                    {SECTIONS.map((s) => (
                      <optgroup key={s.value} label={s.label}>
                        {classes
                          .filter((c) => sectionOf(c.name) === s.value)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </optgroup>
                    ))}
                    {classes.some((c) => sectionOf(c.name) === null) && (
                      <optgroup label="Other">
                        {classes
                          .filter((c) => sectionOf(c.name) === null)
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <select
                    value={fSubject}
                    onChange={(e) => setFSubject(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">General (no subject)</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Topic</Label>
                  <Input
                    value={fTopic}
                    onChange={(e) => setFTopic(e.target.value)}
                    list="topic-suggestions"
                    placeholder="e.g. Fractions"
                    required
                  />
                  <datalist id="topic-suggestions">
                    {topicSuggestions.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>Source (optional)</Label>
                  <Input
                    value={fSource}
                    onChange={(e) => setFSource(e.target.value)}
                    list="source-suggestions"
                    placeholder="e.g. Khan Academy"
                  />
                  <datalist id="source-suggestions">
                    {SOURCE_SUGGESTIONS.map((name) => (
                      <option key={name} value={name} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1.5">
                  <Label>Link</Label>
                  <Input
                    value={fUrl}
                    onChange={(e) => setFUrl(e.target.value)}
                    type="url"
                    placeholder="https://..."
                    required
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Or upload your own file (notes, PDF, Word, video, audio, picture)</Label>
                  <Input
                    type="file"
                    disabled={uploading}
                    accept="video/*,audio/*,image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                  />
                  {uploading && (
                    <p className="text-xs text-muted-foreground">Uploading... {progress}%</p>
                  )}
                  {!uploading && uploadedName && (
                    <p className="text-xs text-emerald-600">
                      Uploaded: {uploadedName}. The link above is filled in. Now tap Save.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Short description (optional)</Label>
                  <Input
                    value={fDescription}
                    onChange={(e) => setFDescription(e.target.value)}
                    placeholder="What will the student learn?"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Add a link, or upload your own file. Only upload or link material
                that Glory Schools owns or has permission to share.
              </p>
              <div className="flex gap-2">
                <Button type="submit" disabled={isPending || uploading}>
                  {isPending ? "Saving..." : "Save"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Empty states */}
      {nothingYet && !showForm && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {isStaff
            ? "No materials yet. Tap Add material to start the library."
            : userRole === "STUDENT" && !studentClass
              ? "Your account is not linked to a class yet. Please ask the school office."
              : `Your teachers have not added materials for ${studentClass ?? "your class"} yet. Please check back soon.`}
        </div>
      )}

      {/* Search results */}
      {!nothingYet && searching && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
          </p>
          {searchResults.map((i) => renderItem(i))}
        </div>
      )}

      {/* Browse: Subject > Topic > Materials */}
      {!nothingYet && !searching && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            {subjectKey && (
              <Button size="sm" variant="ghost" onClick={goBack}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            )}
            <button
              className="font-medium hover:underline"
              onClick={() => {
                setSubjectKey(null);
                setTopic(null);
              }}
            >
              Subjects
            </button>
            {subjectKey && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <button
                  className="font-medium hover:underline"
                  onClick={() => setTopic(null)}
                >
                  {currentSubjectName}
                </button>
              </>
            )}
            {topic && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{topic}</span>
              </>
            )}
          </div>

          {!subjectKey && (
            <>
              {subjectTiles.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nothing matches this filter.
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {subjectTiles.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setSubjectKey(s.key)}
                    className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow hover:bg-accent"
                  >
                    <Folder className="h-5 w-5" />
                    <span className="flex-1 font-medium">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.count}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {subjectKey && !topic && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topicTiles.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setTopic(t.name)}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 text-left shadow hover:bg-accent"
                >
                  <Folder className="h-5 w-5" />
                  <span className="flex-1 font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {subjectKey && topic && (
            <div className="space-y-2">
              {topicItems.map((i) => renderItem(i))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
