"use client";

import { useState, useTransition } from "react";
import { createUser, updateUser, deleteUser, toggleUserActive } from "@/server/actions/users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Plus, Search, Trash2 } from "lucide-react";

type UserItem = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  staff: { id: string; staffNo: string; position: string | null } | null;
  parent: { id: string; relationship: string } | null;
  student: { id: string; admissionNo: string } | null;
};

interface Props {
  users: UserItem[];
}

const ROLES = [
  "ADMIN",
  "TEACHER",
  "STAFF",
  "PARENT",
  "LIBRARIAN",
  "ACCOUNTANT",
] as const;

export function UsersClient({ users: initial }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [message, setMessage] = useState("");

  const filtered = initial.filter((u) => {
    const matchesSearch =
      u.firstName.toLowerCase().includes(search.toLowerCase()) ||
      u.lastName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = !roleFilter || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createUser({
          email: fd.get("email") as string,
          password: fd.get("password") as string,
          firstName: fd.get("firstName") as string,
          lastName: fd.get("lastName") as string,
          phone: (fd.get("phone") as string) || undefined,
          role: fd.get("role") as any,
          staffNo: (fd.get("staffNo") as string) || undefined,
          department: (fd.get("department") as string) || undefined,
          position: (fd.get("position") as string) || undefined,
          isTeaching: fd.get("isTeaching") === "on",
          relationship: (fd.get("relationship") as string) || undefined,
        });
        setShowForm(false);
        setMessage("User created successfully. They can now log in.");
      } catch (err: any) {
        setMessage(err.message || "Failed to create user");
      }
    });
  }

  function handleToggleActive(id: string) {
    startTransition(async () => {
      try {
        const res = await toggleUserActive(id);
        setMessage(res.isActive ? "User activated" : "User deactivated");
      } catch (err: any) {
        setMessage(err.message);
      }
    });
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`Permanently delete user "${name}"? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteUser(id);
        setMessage("User deleted");
      } catch (err: any) {
        setMessage(err.message);
      }
    });
  }

  const roleColor: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    TEACHER: "bg-blue-100 text-blue-800",
    STAFF: "bg-slate-100 text-slate-800",
    PARENT: "bg-amber-100 text-amber-800",
    LIBRARIAN: "bg-teal-100 text-teal-800",
    ACCOUNTANT: "bg-emerald-100 text-emerald-800",
    STUDENT: "bg-pink-100 text-pink-800",
  };

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
        <div className="flex flex-1 gap-2">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-9 rounded-md border px-3 text-sm"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1.5" /> Create User
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New User Login</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input name="firstName" required />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input name="lastName" required />
              </div>
              <div className="space-y-1.5">
                <Label>Email (login)</Label>
                <Input name="email" type="email" required placeholder="teacher@school.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input name="password" type="password" required minLength={6} placeholder="min 6 chars" />
              </div>
              <div className="space-y-1.5">
                <Label>Phone (optional)</Label>
                <Input name="phone" placeholder="+234..." />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <select name="role" required className="flex h-9 w-full rounded-md border px-3 text-sm">
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Staff-specific fields */}
              <div className="space-y-1.5">
                <Label>Staff No (auto if empty)</Label>
                <Input name="staffNo" placeholder="STF-001" />
              </div>
              <div className="space-y-1.5">
                <Label>Position / Department</Label>
                <Input name="position" placeholder="Class Teacher / Accounts" />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input name="department" placeholder="Science / Admin" />
              </div>

              {/* Parent field */}
              <div className="space-y-1.5">
                <Label>Relationship (for Parent)</Label>
                <select name="relationship" className="flex h-9 w-full rounded-md border px-3 text-sm">
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Guardian</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" name="isTeaching" id="isTeaching" className="h-4 w-4" />
                <Label htmlFor="isTeaching">Is Teaching Staff</Label>
              </div>

              <div className="sm:col-span-2 lg:col-span-3 flex gap-2">
                <Button type="submit" disabled={isPending}>
                  Create Login
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
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Phone</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="py-3 font-medium">
                      {u.lastName} {u.firstName}
                      {u.staff && (
                        <span className="block text-xs text-muted-foreground">
                          {u.staff.staffNo} · {u.staff.position}
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">{u.email}</td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          roleColor[u.role] || "bg-gray-100"
                        )}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 text-muted-foreground">{u.phone || "—"}</td>
                    <td className="py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                          u.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        )}
                      >
                        {u.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleToggleActive(u.id)}
                        disabled={isPending}
                      >
                        {u.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 h-7"
                        onClick={() => handleDelete(u.id, `${u.firstName} ${u.lastName}`)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No users found.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
