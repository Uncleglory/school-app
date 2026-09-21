import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getExams, getSubjects, getStudentsByClass } from "@/server/actions/exams";
import { getAcademicYears, getTerms } from "@/server/actions/fees";
import { getClasses } from "@/server/actions/attendance";
import { ExamsClient } from "@/components/exams/exams-client";

export default async function ExamsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [exams, years, terms, subjects, classes, students] = await Promise.all([
    getExams(),
    getAcademicYears(),
    getTerms(),
    getSubjects(),
    getClasses(),
    getStudentsByClass(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exams & Results</h1>
        <p className="text-muted-foreground">
          Create exams, enter marks, publish results and generate report cards.
        </p>
      </div>

      <ExamsClient
        exams={JSON.parse(JSON.stringify(exams))}
        years={JSON.parse(JSON.stringify(years))}
        terms={JSON.parse(JSON.stringify(terms))}
        subjects={subjects}
        classes={classes}
        students={JSON.parse(JSON.stringify(students))}
        userRole={session.user.role}
      />
    </div>
  );
}
