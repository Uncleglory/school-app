"use client";

import { useState, useTransition } from "react";
import { createStaff } from "@/server/actions/staff";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

type StaffMember = {
  id: string;
  staffNo: string;
  department: string | null;
  position: string | null;
  hireDate: string;
  isTeaching: boolean;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    role: string;
  };
  formClasses: { name: string }[];
};

export function StaffClient({ staff }: { staff: StaffMember[] }) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createStaff({
          email: fd.get("email") as string,
          firstName: fd.get("firstName") as string,
          lastName: fd.get("lastName") as string,
          phone: (fd.get("phone") as string) || undefined,
          staffNo: fd.get("staffNo") as string,
          department: (fd.get("department") as string) || undefined,
          position: (fd.get("position") as string) || undefined,
          hireDate: fd.get("hireDate") as string,
          isTeaching: fd.get("isTeaching") === "on",
          password: (fd.get("password") as string) || "password123",
        });
        setShowForm(false);
        setMessage("Staff created. Default password: password123 (or the one you set)");
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
          <button className="ml-3 underline" onClick={() => setMessage("")}>dismiss</button>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add Staff
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">New Staff Member</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Staff No</Label>
                <Input name="staffNo" required placeholder="TCH-002" />
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
                <Label>Email</Label>
                <Input name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input name="phone" />
              </div>
              <div className="space-y-1.5">
                <Label>Password (optional)</Label>
                <Input name="password" type="password" placeholder="password123" />
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input name="department" placeholder="Academic" />
              </div>
              <div className="space-y-1.5">
                <Label>Position</Label>
                <Input name="position" placeholder="Teacher / Bursar / Clerk" />
              </div>
              <div className="space-y-1.5">
                <Label>Hire Date</Label>
                <Input name="hireDate" type="date" required />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" name="isTeaching" id="isTeaching" className="h-4 w-4" />
                <Label htmlFor="isTeaching">Is Teaching Staff</Label>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Staff No</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Email</th>
                <th className="pb-2 font-medium">Position</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                  <td className="py-3 font-mono text-xs">{s.staffNo}</td>
                  <td className="py-3 font-medium">{s.user.lastName} {s.user.firstName}</td>
                  <td className="py-3 text-muted-foreground">{s.user.email}</td>
                  <td className="py-3">{s.position || "—"}</td>
                  <td className="py-3 capitalize">{s.user.role.toLowerCase()}</td>
                  <td className="py-3">
                    <span className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      s.user.isActive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    )}>
                      {s.user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
