import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSubjectsFull, getClassOptions } from "@/server/actions/subjects";
import { getStaffForFormTeacher } from "@/server/actions/classes";
import { SubjectsClient } from "@/components/subjects/subjects-client";

export default async function SubjectsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [subjects, classes, staff] = await Promise.all([
    getSubjectsFull(),
    getClassOptions(),
    getStaffForFormTeacher(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subjects</h1>
        <p className="text-muted-foreground">
          Manage Junior and Senior subjects. Assign each one to a class and,
          when ready, a teacher.
        </p>
      </div>
      <SubjectsClient
        subjects={JSON.parse(JSON.stringify(subjects))}
        classes={JSON.parse(JSON.stringify(classes))}
        staff={JSON.parse(JSON.stringify(staff))}
        userRole={session.user.role}
      />
    </div>
  );
}
