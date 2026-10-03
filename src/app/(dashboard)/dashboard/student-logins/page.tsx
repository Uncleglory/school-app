import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getStudentLoginOverview } from "@/server/actions/student-logins";
import { StudentLoginsClient } from "@/components/student-logins/student-logins-client";

export default async function StudentLoginsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const classes = await getStudentLoginOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Student Logins</h1>
        <p className="text-muted-foreground">
          Create logins for students by class. They sign in with their admission number.
        </p>
      </div>
      <StudentLoginsClient classes={classes} />
    </div>
  );
}
