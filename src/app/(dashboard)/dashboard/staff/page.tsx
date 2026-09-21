import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getStaffList } from "@/server/actions/staff";
import { StaffClient } from "@/components/staff/staff-client";

export default async function StaffPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const staff = await getStaffList();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
        <p className="text-muted-foreground">Manage teachers and non-teaching staff.</p>
      </div>
      <StaffClient staff={JSON.parse(JSON.stringify(staff))} />
    </div>
  );
}
