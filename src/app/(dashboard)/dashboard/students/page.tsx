import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getStudents } from "@/server/actions/students";
import { getClasses } from "@/server/actions/attendance";
import { StudentsClient } from "@/components/students/students-client";

export default async function StudentsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [students, classes] = await Promise.all([getStudents(), getClasses()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground">Manage student records, classes and status.</p>
      </div>
      <StudentsClient
        students={JSON.parse(JSON.stringify(students))}
        classes={classes}
        userRole={session.user.role}
      />
    </div>
  );
}
