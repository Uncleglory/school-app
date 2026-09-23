"use client";

import { useState, useTransition } from "react";
import { createClass, updateClass, deleteClass } from "@/server/actions/classes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search, Trash2 } from "lucide-react";

type ClassItem = {
  id: string;
  name: string;
  level: string;
  capacity: number;
  formTeacherId: string | null;
  formTeacher: {
    user: { firstName: string; lastName: string };
  } | null;
  _count: { students: number };
};

type StaffItem = {
  id: string;
  staffNo: string;
  user: { firstName: string; lastName: string };
};

interface Props {
  classes: ClassItem[];
  staff: StaffItem[];
  userRole: string;
}

const SUGGESTED_CLASSES = [
  "Creche",
  "KG 1",
  "KG 2",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SSS 1",
  "SSS 2",
  "SSS 3",
];

export function ClassesClient({ classes: initial, staff, userRole }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const canManage = userRole === "ADMIN";

  const filtered = initial.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.level.toLowerCase().includes(search.toLowerCase())
  );

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createClass({
          name: fd.get("name") as string,
          level: fd.get("level") as string,
          capacity: Number(fd.get("capacity")) || 40,
          formTeacherId: (fd.get("formTeacherId") as string) || undefined,
        });
        setShowForm(false);
        setMessage("Class created successfully");
      } catch (err: any) {
        setMessage(err.message || "Failed to create class");
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete class "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteClass(id);
        setMessage("Class deleted");
      } catch (err: any) {
        setMessage(err.message || "Failed to delete");
      }
    });
  }

  function quickAdd(name: string) {
    startTransition(async () => {
      try {
        await createClass({
          name,
          level: name,
          capacity: 40,
        });
        setMessage(`Added ${name}`);
      } catch (err: any) {
        setMessage(err.message || "Failed");
      }
    });
  }

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

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search classes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Class
          </Button>
        )}
      </div>

      {/* Quick-add chips for common Nigerian school levels */}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center mr-1">Quick add:</span>
          {SUGGESTED_CLASSES.filter(
            (s) => !initial.some((c) => c.name.toLowerCase() === s.toLowerCase())
          ).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => quickAdd(name)}
              disabled={isPending}
              className="rounded-full border px-3 py-1 text-xs hover:bg-muted transition-colors disabled:opacity-50"
            >
              + {name}
            </button>
          ))}
        </div>
      )}

      {showForm && canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Class</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Class Name</Label>
                <Input name="name" required placeholder="e.g. Primary 3A" />
              </div>
              <div className="space-y-1.5">
                <Label>Level</Label>
                <Input name="level" required placeholder="e.g. Primary 3" />
              </div>
              <div className="space-y-1.5">
                <Label>Capacity</Label>
                <Input name="capacity" type="number" defaultValue={40} min={1} />
              </div>
              <div className="space-y-1.5">
                <Label>Form Teacher (optional)</Label>
                <select
                  name="formTeacherId"
                  className="flex h-9 w-full rounded-md border px-3 text-sm"
                >
                  <option value="">None</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.user.lastName} {s.user.firstName} ({s.staffNo})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
                <Button type="submit" disabled={isPending}>
                  Save Class
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Level</th>
                  <th className="pb-2 font-medium">Students</th>
                  <th className="pb-2 font-medium">Capacity</th>
                  <th className="pb-2 font-medium">Form Teacher</th>
                  {canManage && <th className="pb-2 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-3 font-medium">{c.name}</td>
                    <td className="py-3 text-muted-foreground">{c.level}</td>
                    <td className="py-3">{c._count.students}</td>
                    <td className="py-3">{c.capacity}</td>
                    <td className="py-3 text-muted-foreground">
                      {c.formTeacher
                        ? `${c.formTeacher.user.lastName} ${c.formTeacher.user.firstName}`
                        : "—"}
                    </td>
                    {canManage && (
                      <td className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 h-7"
                          onClick={() => handleDelete(c.id, c.name)}
                          disabled={isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No classes yet. Add Creche → SSS 3 using the quick buttons or the form above.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
