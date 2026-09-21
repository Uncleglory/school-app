"use client";

import { useState, useTransition } from "react";
import { createExam, enterResult, publishExam, getResultsForExam } from "@/server/actions/exams";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Plus, BookOpen, Eye } from "lucide-react";

type Exam = {
  id: string;
  name: string;
  type: string;
  isPublished: boolean;
  startDate: string;
  endDate: string;
  academicYear: { name: string };
  term: { name: string } | null;
  _count: { results: number };
};

interface Props {
  exams: Exam[];
  years: { id: string; name: string }[];
  terms: { id: string; name: string }[];
  subjects: { id: string; name: string; code: string }[];
  classes: { id: string; name: string }[];
  students: { id: string; firstName: string; lastName: string; admissionNo: string; class: { name: string } | null }[];
  userRole: string;
}

export function ExamsClient({ exams, years, terms, subjects, classes, students, userRole }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [enterMode, setEnterMode] = useState(false);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const canManage = ["ADMIN", "TEACHER"].includes(userRole);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createExam({
          name: fd.get("name") as string,
          type: fd.get("type") as any,
          academicYearId: fd.get("academicYearId") as string,
          termId: (fd.get("termId") as string) || undefined,
          startDate: fd.get("startDate") as string,
          endDate: fd.get("endDate") as string,
        });
        setShowCreate(false);
        setMessage("Exam created");
      } catch (err: any) {
        setMessage(err.message);
      }
    });
  }

  function handleEnterMark(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await enterResult({
          examId: fd.get("examId") as string,
          studentId: fd.get("studentId") as string,
          subjectId: fd.get("subjectId") as string,
          score: Number(fd.get("score")),
          maxScore: Number(fd.get("maxScore") || 100),
          remark: (fd.get("remark") as string) || undefined,
        });
        setMessage("Mark saved");
        (e.target as HTMLFormElement).reset();
      } catch (err: any) {
        setMessage(err.message);
      }
    });
  }

  function handleViewResults(examId: string) {
    startTransition(async () => {
      const data = await getResultsForExam(examId);
      setResults(JSON.parse(JSON.stringify(data)));
      setSelectedExam(examId);
    });
  }

  function handlePublish(examId: string) {
    startTransition(async () => {
      await publishExam(examId);
      setMessage("Results published");
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

      <div className="flex flex-wrap gap-2">
        {canManage && (
          <>
            <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEnterMode(false); }}>
              <Plus className="h-4 w-4 mr-1.5" /> New Exam
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEnterMode(!enterMode); setShowCreate(false); }}>
              <BookOpen className="h-4 w-4 mr-1.5" /> Enter Marks
            </Button>
          </>
        )}
      </div>

      {/* Create Exam */}
      {showCreate && canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create Exam</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input name="name" placeholder="First Term Mid-Term" required />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select name="type" className="flex h-9 w-full rounded-md border px-3 text-sm">
                  <option value="CONTINUOUS_ASSESSMENT">Continuous Assessment</option>
                  <option value="MID_TERM">Mid-Term</option>
                  <option value="FINAL">Final</option>
                  <option value="MOCK">Mock</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <select name="academicYearId" required className="flex h-9 w-full rounded-md border px-3 text-sm">
                  {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Term</Label>
                <select name="termId" className="flex h-9 w-full rounded-md border px-3 text-sm">
                  <option value="">—</option>
                  {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input name="startDate" type="date" required />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input name="endDate" type="date" required />
              </div>
              <div className="sm:col-span-2 flex gap-2">
                <Button type="submit" disabled={isPending}>Create</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Enter Marks */}
      {enterMode && canManage && (
        <Card>
          <CardHeader><CardTitle className="text-base">Enter Marks</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleEnterMark} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Exam</Label>
                <select name="examId" required className="flex h-9 w-full rounded-md border px-3 text-sm">
                  {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Student</Label>
                <select name="studentId" required className="flex h-9 w-full rounded-md border px-3 text-sm">
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.lastName} {s.firstName} ({s.class?.name})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <select name="subjectId" required className="flex h-9 w-full rounded-md border px-3 text-sm">
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Score</Label>
                <Input name="score" type="number" min="0" step="0.01" required />
              </div>
              <div className="space-y-1.5">
                <Label>Max Score</Label>
                <Input name="maxScore" type="number" defaultValue={100} min="1" />
              </div>
              <div className="space-y-1.5">
                <Label>Remark</Label>
                <Input name="remark" placeholder="Optional" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={isPending}>Save Mark</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Exams List */}
      <Card>
        <CardHeader><CardTitle className="text-base">All Exams</CardTitle></CardHeader>
        <CardContent>
          {exams.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No exams yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Year / Term</th>
                  <th className="pb-2 font-medium">Results</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{e.name}</td>
                    <td className="py-3 text-muted-foreground">{e.type.replace(/_/g, " ")}</td>
                    <td className="py-3 text-muted-foreground">
                      {e.academicYear.name}{e.term ? ` · ${e.term.name}` : ""}
                    </td>
                    <td className="py-3">{e._count.results}</td>
                    <td className="py-3">
                      <span className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        e.isPublished ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"
                      )}>
                        {e.isPublished ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="py-3 text-right space-x-1">
                      <Button size="sm" variant="outline" onClick={() => handleViewResults(e.id)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>
                      {userRole === "ADMIN" && !e.isPublished && (
                        <Button size="sm" variant="outline" disabled={isPending} onClick={() => handlePublish(e.id)}>
                          Publish
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Results preview */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Results — {exams.find((e) => e.id === selectedExam)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Student</th>
                  <th className="pb-2 font-medium">Subject</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Grade</th>
                  <th className="pb-2 font-medium text-right">Report Card</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2">{r.student.lastName} {r.student.firstName}</td>
                    <td className="py-2">{r.subject.name}</td>
                    <td className="py-2">{Number(r.score)} / {Number(r.maxScore)}</td>
                    <td className="py-2 font-semibold">{r.grade}</td>
                    <td className="py-2 text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <a
                          href={`/dashboard/exams/report-card?studentId=${r.studentId}&examId=${selectedExam}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
