"use client";

import { useState, useTransition } from "react";
import { createStudent, updateStudent, deleteStudent } from "@/server/actions/students";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";
import { Plus, Search } from "lucide-react";

type Student = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  otherName: string | null;
  gender: string;
  dateOfBirth: string;
  status: string;
  class: { id: string; name: string } | null;
};

interface Props {
  students: Student[];
  classes: { id: string; name: string }[];
  userRole: string;
}

export function StudentsClient({ students: initial, classes, userRole }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const canManage = ["ADMIN", "TEACHER"].includes(userRole);

  const filtered = initial.filter(
    (s) =>
      s.firstName.toLowerCase().includes(search.toLowerCase()) ||
      s.lastName.toLowerCase().includes(search.toLowerCase()) ||
      s.admissionNo.toLowerCase().includes(search.toLowerCase())
  );

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createStudent({
          admissionNo: fd.get("admissionNo") as string,
          firstName: fd.get("firstName") as string,
          lastName: fd.get("lastName") as string,
          otherName: (fd.get("otherName") as string) || undefined,
          gender: fd.get("gender") as any,
          dateOfBirth: fd.get("dateOfBirth") as string,
          address: (fd.get("address") as string) || undefined,
          classId: (fd.get("classId") as string) || undefined,
        });
        setShowForm(false);
        setMessage("Student created successfully");
      } catch (err: any) {
        setMessage(err.message || "Failed");
      }
    });
  }

  function handleStatusChange(id: string, status: string) {
    startTransition(async () => {
      await updateStudent(id, { status: status as any });
      setMessage("Status updated");
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this student permanently?")) return;
    startTransition(async () => {
      try {
        await deleteStudent(id);
        setMessage("Student deleted");
      } catch (err: any) {
        setMessage(err.message);
      }
    });
  }

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-emerald-100 text-emerald-800",
    GRADUATED: "bg-blue-100 text-blue-800",
    TRANSFERRED: "bg-amber-100 text-amber-800",
    SUSPENDED: "bg-red-100 text-red-800",
    WITHDRAWN: "bg-slate-100 text-slate-800",
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800">
          {message}
          <button className="ml-3 underline" onClick={() => setMessage("")}>dismiss</button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or admission no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add Student
          </Button>
        )}
      </div>

      {showForm && canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Student</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Admission No</Label>
                <Input name="admissionNo" required placeholder="ADM-2026-001" />
              </div>
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input name="firstName" required />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input name="lastName" required />
              </div>
              <div className="space-y-1.5">
                <Label>Other Name</Label>
                <Input name="otherName" />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <select name="gender" required className="flex h-9 w-full rounded-md border px-3 text-sm">
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input name="dateOfBirth" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label>Class</Label>
                <select name="classId" className="flex h-9 w-full rounded-md border px-3 text-sm">
                  <option value="">Unassigned</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input name="address" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                <Button type="submit" disabled={isPending}>Save</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
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
                  <th className="pb-2 font-medium">Adm No</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Class</th>
                  <th className="pb-2 font-medium">Gender</th>
                  <th className="pb-2 font-medium">Status</th>
                  {canManage && <th className="pb-2 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-3 font-mono text-xs">{s.admissionNo}</td>
                    <td className="py-3 font-medium">{s.lastName} {s.firstName}</td>
                    <td className="py-3 text-muted-foreground">{s.class?.name || "—"}</td>
                    <td className="py-3 capitalize">{s.gender.toLowerCase()}</td>
                    <td className="py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusColor[s.status])}>
                        {s.status}
                      </span>
                    </td>
                    {canManage && (
                      <td className="py-3 text-right space-x-1">
                        <select
                          className="h-7 rounded border text-xs px-1"
                          value={s.status}
                          onChange={(e) => handleStatusChange(s.id, e.target.value)}
                          disabled={isPending}
                        >
                          {["ACTIVE", "SUSPENDED", "TRANSFERRED", "GRADUATED", "WITHDRAWN"].map((st) => (
                            <option key={st} value={st}>{st}</option>
                          ))}
                        </select>
                        {userRole === "ADMIN" && (
                          <Button size="sm" variant="ghost" className="text-red-600 h-7" onClick={() => handleDelete(s.id)}>
                            Delete
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No students found.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
