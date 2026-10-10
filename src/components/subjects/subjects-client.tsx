"use client";

import { useState, useTransition } from "react";
import {
  createSubject,
  updateSubject,
  deleteSubject,
  assignSubjectToClass,
  updateAssignmentTeacher,
  removeAssignment,
} from "@/server/actions/subjects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";

type Level = "JUNIOR" | "SENIOR" | "BOTH";
type Tab = "JUNIOR" | "SENIOR" | "ALL";

type AssignmentItem = {
  id: string;
  classId: string;
  teacherId: string | null;
  class: { id: string; name: string; level: string };
  teacher: { user: { firstName: string; lastName: string } } | null;
};

type SubjectItem = {
  id: string;
  name: string;
  code: string;
  level: Level;
  classes: AssignmentItem[];
};

type ClassOption = { id: string; name: string; level: string };

type StaffItem = {
  id: string;
  staffNo: string;
  user: { firstName: string; lastName: string };
};

interface Props {
  subjects: SubjectItem[];
  classes: ClassOption[];
  staff: StaffItem[];
  userRole: string;
}

const LEVEL_LABEL: Record<Level, string> = {
  JUNIOR: "Junior",
  SENIOR: "Senior",
  BOTH: "Junior & Senior",
};

const LEVEL_BADGE: Record<Level, string> = {
  JUNIOR: "border-blue-200 bg-blue-50 text-blue-700",
  SENIOR: "border-violet-200 bg-violet-50 text-violet-700",
  BOTH: "border-slate-200 bg-slate-50 text-slate-700",
};

// Works out whether a class is junior or senior secondary from its name.
// JSS 1, JSS 2 ... = junior.  SS 1, SSS 2 ... = senior.  Anything else
// (Nursery, Primary ...) is treated as "OTHER".
function classLevel(name: string): "JUNIOR" | "SENIOR" | "OTHER" {
  const n = name.trim().toLowerCase();
  if (/^(jss|junior)/.test(n)) return "JUNIOR";
  if (/^(sss?\s*\d|senior)/.test(n)) return "SENIOR";
  return "OTHER";
}

function teacherName(t: AssignmentItem["teacher"]) {
  return t ? `${t.user.lastName} ${t.user.firstName}` : "";
}

export function SubjectsClient({
  subjects: initial,
  classes,
  staff,
  userRole,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("JUNIOR");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SubjectItem | null>(null);
  const [message, setMessage] = useState("");
  const canManage = userRole === "ADMIN";

  const q = search.toLowerCase();
  const visible = initial.filter((s) => {
    const inTab = tab === "ALL" || s.level === "BOTH" || s.level === tab;
    return (
      inTab &&
      (s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
    );
  });

  function assignmentsFor(s: SubjectItem) {
    if (tab === "ALL") return s.classes;
    return s.classes.filter((a) => classLevel(a.class.name) === tab);
  }

  function classesFor(s: SubjectItem) {
    const taken = new Set(s.classes.map((a) => a.classId));
    const wanted: "JUNIOR" | "SENIOR" | null =
      tab === "ALL" ? (s.level === "BOTH" ? null : s.level) : tab;
    return classes.filter(
      (c) =>
        !taken.has(c.id) && (wanted === null || classLevel(c.name) === wanted)
    );
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      code: fd.get("code") as string,
      level: fd.get("level") as Level,
    };
    startTransition(async () => {
      try {
        if (editing) {
          await updateSubject(editing.id, payload);
          setEditing(null);
          setMessage("Subject updated");
        } else {
          await createSubject(payload);
          setShowForm(false);
          setMessage("Subject added");
        }
      } catch (err: any) {
        setMessage(err.message || "Failed to save subject");
      }
    });
  }

  function handleDelete(s: SubjectItem) {
    if (!confirm(`Delete subject "${s.name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteSubject(s.id);
        setMessage("Subject deleted");
      } catch (err: any) {
        setMessage(err.message || "Failed to delete subject");
      }
    });
  }

  function handleAssign(
    e: React.FormEvent<HTMLFormElement>,
    subjectId: string
  ) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const classId = fd.get("classId") as string;
    if (!classId) {
      setMessage("Choose a class first");
      return;
    }
    startTransition(async () => {
      try {
        await assignSubjectToClass({
          subjectId,
          classId,
          teacherId: (fd.get("teacherId") as string) || undefined,
        });
        form.reset();
        setMessage("Subject assigned to class");
      } catch (err: any) {
        setMessage(err.message || "Failed to assign subject");
      }
    });
  }

  function handleTeacherChange(assignmentId: string, teacherId: string) {
    startTransition(async () => {
      try {
        await updateAssignmentTeacher(assignmentId, teacherId || null);
        setMessage("Teacher updated");
      } catch (err: any) {
        setMessage(err.message || "Failed to update teacher");
      }
    });
  }

  function handleRemove(a: AssignmentItem, subjectName: string) {
    if (!confirm(`Remove ${subjectName} from ${a.class.name}?`)) return;
    startTransition(async () => {
      try {
        await removeAssignment(a.id);
        setMessage("Removed from class");
      } catch (err: any) {
        setMessage(err.message || "Failed to remove");
      }
    });
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "JUNIOR", label: "Junior" },
    { key: "SENIOR", label: "Senior" },
    { key: "ALL", label: "All subjects" },
  ];

  const defaultLevel: Level = tab === "ALL" ? "BOTH" : tab;

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

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={tab === t.key ? "default" : "outline"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              setShowForm(!showForm);
              setEditing(null);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Subject
          </Button>
        )}
      </div>

      {(showForm || editing) && canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? `Edit ${editing.name}` : "New Subject"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              key={editing?.id ?? "new"}
              onSubmit={handleSave}
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div className="space-y-1.5">
                <Label>Subject Name</Label>
                <Input
                  name="name"
                  required
                  defaultValue={editing?.name ?? ""}
                  placeholder="e.g. Yoruba"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Code (must be unique)</Label>
                <Input
                  name="code"
                  required
                  defaultValue={editing?.code ?? ""}
                  placeholder="e.g. YOR-S"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Level</Label>
                <select
                  name="level"
                  className="flex h-9 w-full rounded-md border px-3 text-sm"
                  defaultValue={editing?.level ?? defaultLevel}
                >
                  <option value="JUNIOR">Junior</option>
                  <option value="SENIOR">Senior</option>
                  <option value="BOTH">Junior &amp; Senior (same subject)</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                <Button type="submit" disabled={isPending}>
                  {editing ? "Save changes" : "Save Subject"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditing(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <p className="text-sm text-muted-foreground">
        {visible.length} subject{visible.length === 1 ? "" : "s"}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {visible.map((s) => {
          const assigned = assignmentsFor(s);
          const available = classesFor(s);
          return (
            <Card key={s.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{s.code}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 ${LEVEL_BADGE[s.level]}`}
                    >
                      {LEVEL_LABEL[s.level]}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={() => {
                        setEditing(s);
                        setShowForm(false);
                      }}
                      disabled={isPending}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 h-7"
                      onClick={() => handleDelete(s)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {assigned.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Not assigned to any class yet.
                  </p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {assigned.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-b last:border-0 pb-2"
                      >
                        <span className="font-medium">{a.class.name}</span>
                        {canManage ? (
                          <div className="flex items-center gap-1">
                            <select
                              className="h-8 rounded-md border px-2 text-sm"
                              defaultValue={a.teacherId || ""}
                              onChange={(e) =>
                                handleTeacherChange(a.id, e.target.value)
                              }
                              disabled={isPending}
                            >
                              <option value="">No teacher yet</option>
                              {staff.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.user.lastName} {t.user.firstName}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-red-600"
                              onClick={() => handleRemove(a, s.name)}
                              disabled={isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span
                            className={
                              a.teacher
                                ? "text-muted-foreground"
                                : "text-amber-600"
                            }
                          >
                            {a.teacher ? teacherName(a.teacher) : "No teacher yet"}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {canManage && available.length > 0 && (
                  <form
                    onSubmit={(e) => handleAssign(e, s.id)}
                    className="flex flex-col gap-2 sm:flex-row"
                  >
                    <select
                      name="classId"
                      defaultValue=""
                      className="h-9 flex-1 rounded-md border px-3 text-sm"
                    >
                      <option value="">Add to class...</option>
                      {available.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select
                      name="teacherId"
                      defaultValue=""
                      className="h-9 flex-1 rounded-md border px-3 text-sm"
                    >
                      <option value="">No teacher yet</option>
                      {staff.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.user.lastName} {t.user.firstName} ({t.staffNo})
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" disabled={isPending}>
                      Assign
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-8">
          No subjects here yet.
          {canManage ? " Use Add Subject to create one." : ""}
        </p>
      )}
    </div>
  );
}
