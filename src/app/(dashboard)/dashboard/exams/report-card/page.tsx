import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getReportCardData } from "@/server/actions/print";
import { getSchoolSettings } from "@/server/actions/settings";
import { formatDate } from "@/lib/utils";
import { PrintButton } from "@/components/print/print-button";
import Link from "next/link";

interface Props {
  searchParams: Promise<{ studentId?: string; examId?: string }>;
}

export default async function ReportCardPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  if (!params.studentId || !params.examId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Report Card</h1>
        <p className="text-muted-foreground">
          Select a student and exam from the Exams page to view a report card.
        </p>
        <Link href="/dashboard/exams" className="text-primary underline text-sm">
          Go to Exams
        </Link>
      </div>
    );
  }

  let data;
  try {
    data = await getReportCardData(params.studentId, params.examId);
  } catch {
    notFound();
  }

  const school = await getSchoolSettings();
  const { student, exam, results, summary } = data;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/dashboard/exams" className="text-sm text-muted-foreground hover:underline">
          ← Back to Exams
        </Link>
        <PrintButton />
      </div>

      {/* Printable report card */}
      <div className="rounded-xl border bg-white p-8 shadow-sm print:border-0 print:shadow-none print:p-0">
        {/* School header */}
        <div className="border-b pb-6 text-center">
          {school.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logoUrl} alt="Logo" className="mx-auto h-14 w-14 object-contain mb-2" />
          )}
          <h1 className="text-2xl font-bold tracking-tight">{school.name}</h1>
          {school.motto && <p className="text-sm italic text-muted-foreground">{school.motto}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            {[school.address, school.phone].filter(Boolean).join(" · ")}
          </p>
          <p className="text-sm font-medium mt-3">Student Report Card</p>
          <p className="mt-1 font-semibold">{exam.name}</p>
          <p className="text-sm text-muted-foreground">
            {exam.academicYear.name}
            {exam.term ? ` · ${exam.term.name}` : ""}
          </p>
        </div>

        {/* Student details */}
        <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-slate-50 p-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Name</p>
            <p className="font-medium">{student.lastName} {student.firstName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Admission No</p>
            <p className="font-medium">{student.admissionNo}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Class</p>
            <p className="font-medium">{student.class?.name || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Date</p>
            <p className="font-medium">{formatDate(new Date())}</p>
          </div>
        </div>

        {/* Subject results */}
        <div className="mt-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-left">
                <th className="pb-2 font-semibold">Subject</th>
                <th className="pb-2 font-semibold text-center">Score</th>
                <th className="pb-2 font-semibold text-center">Max</th>
                <th className="pb-2 font-semibold text-center">Grade</th>
                <th className="pb-2 font-semibold">Remark</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} className="border-b border-slate-100">
                  <td className="py-2.5 font-medium">{r.subject.name}</td>
                  <td className="py-2.5 text-center">{Number(r.score)}</td>
                  <td className="py-2.5 text-center text-muted-foreground">{Number(r.maxScore)}</td>
                  <td className="py-2.5 text-center font-bold">{r.grade}</td>
                  <td className="py-2.5 text-muted-foreground text-xs">{r.remark || "—"}</td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No results entered yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary box */}
        {results.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg border-2 border-slate-200 p-4 sm:grid-cols-4">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Subjects</p>
              <p className="text-xl font-bold">{summary.subjectsCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total Score</p>
              <p className="text-xl font-bold">{summary.totalScore} / {summary.totalMax}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-xl font-bold">{summary.average}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Overall Grade</p>
              <p className="text-2xl font-bold text-primary">{summary.overallGrade}</p>
            </div>
          </div>
        )}

        {/* Grade key */}
        <div className="mt-6 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Grading Scale</p>
          <p>A (70–100) · B (60–69) · C (50–59) · D (45–49) · E (40–44) · F (0–39)</p>
        </div>

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-b border-slate-400 h-10" />
            <p className="mt-2 text-muted-foreground">Class Teacher</p>
          </div>
          <div>
            <div className="border-b border-slate-400 h-10" />
            <p className="mt-2 text-muted-foreground">
              {school.principal || "Principal / Head Teacher"}
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Computer-generated report card · {exam.isPublished ? "Published results" : "Draft"}
        </p>
      </div>
    </div>
  );
}
