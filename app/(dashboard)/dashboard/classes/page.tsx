import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getClassesFull, getStaffForFormTeacher } from "@/server/actions/classes";
import { ClassesClient } from "@/components/classes/classes-client";

export default async function ClassesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [classes, staff] = await Promise.all([
    getClassesFull(),
    getStaffForFormTeacher(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Classes</h1>
        <p className="text-muted-foreground">
          Manage school classes (Creche → SSS 3). Assign form teachers and capacity.
        </p>
      </div>
      <ClassesClient
        classes={JSON.parse(JSON.stringify(classes))}
        staff={JSON.parse(JSON.stringify(staff))}
        userRole={session.user.role}
      />
    </div>
  );
}
