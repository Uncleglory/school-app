"use client";

import { useState, useTransition } from "react";
import { createMaterial, deleteMaterial } from "@/server/actions/materials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { Plus, ExternalLink, Trash2 } from "lucide-react";

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

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createMaterial({
          title: fd.get("title") as string,
          description: (fd.get("description") as string) || undefined,
          type: fd.get("type") as any,
          fileUrl: fd.get("fileUrl") as string,
          classId: (fd.get("classId") as string) || undefined,
          subjectId: (fd.get("subjectId") as string) || undefined,
          visibleToStudents: fd.get("visibleToStudents") === "on",
        });
        setShowForm(false);
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
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Material
          </Button>
        </div>
      )}

      {showForm && canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upload Material</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input name="title" required placeholder="Chapter 5 Notes" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select name="type" className="flex h-9 w-full rounded-md border px-3 text-sm">
                  <option value="NOTE">Note</option>
                  <option value="ASSIGNMENT">Assignment</option>
                  <option value="SLIDE">Slide</option>
                  <option value="PAST_PAPER">Past Paper</option>
                  <option value="VIDEO">Video</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>File URL / Link</Label>
                <Input name="fileUrl" required placeholder="https://drive.google.com/..." />
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
                <Button type="submit" disabled={isPending}>Save</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
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
