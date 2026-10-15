import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getExams } from "@/server/actions/exams";
import { getClasses } from "@/server/actions/attendance";
import { ClassResultsClient } from "@/components/results/class-results-client";

export default async function ResultsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER", "TEACHER"].includes(session.user.role)) redirect("/dashboard");

  const [exams, classes] = await Promise.all([getExams(), getClasses()]);

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Class Results</h1>
        <p className="text-muted-foreground">
          Choose an exam and a class, type in each student&apos;s scores, then save.
          You can also print the class result sheet.
        </p>
      </div>

      <ClassResultsClient
        exams={exams.map((e) => ({
          id: e.id,
          name: e.name,
          term: e.term?.name ?? null,
          year: e.academicYear?.name ?? null,
        }))}
        classes={classes}
      />
    </div>
  );
}
