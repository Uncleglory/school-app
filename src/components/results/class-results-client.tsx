"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  getClassResultsGrid,
  saveClassScores,
} from "@/server/actions/exams";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PrintButton } from "@/components/print/print-button";

interface ExamOption {
  id: string;
  name: string;
  term: string | null;
  year: string | null;
}

interface Grid {
  exam: { id: string; name: string };
  className: string;
  students: { id: string; name: string; admissionNo: string }[];
  subjects: { id: string; name: string }[];
  scores: Record<string, number>;
}

export function ClassResultsClient({
  exams,
  classes,
}: {
  exams: ExamOption[];
  classes: { id: string; name: string }[];
}) {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [grid, setGrid] = useState<Grid | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleLoad() {
    setMessage("");
    startTransition(async () => {
      try {
        const data = await getClassResultsGrid(examId, classId);
        const initial: Record<string, string> = {};
        for (const [key, score] of Object.entries(data.scores)) {
          initial[key] = String(score);
        }
        setGrid(data);
        setValues(initial);
      } catch (err: any) {
        setGrid(null);
        setMessage(err?.message || "Could not load this class.");
      }
    });
  }

  function handleSave() {
    if (!grid) return;
    setMessage("");

    const entries: { studentId: string; subjectId: string; score: number }[] = [];
    for (const [key, raw] of Object.entries(values)) {
      if (raw.trim() === "") continue;
      const [studentId, subjectId] = key.split(":");
      entries.push({ studentId, subjectId, score: Number(raw) });
    }

    if (entries.length === 0) {
      setMessage("Type at least one score before saving.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await saveClassScores({ examId: grid.exam.id, entries });
        setMessage(`Saved ${res.saved} scores.`);
      } catch (err: any) {
        setMessage(err?.message || "Could not save. Please try again.");
      }
    });
  }

  // Total, average and position for each student, worked out from what is typed in
  const summary = useMemo(() => {
    if (!grid) return {} as Record<string, { total: number; count: number; avg: number; position: number }>;
    const rows = grid.students.map((s) => {
      let total = 0;
      let count = 0;
      for (const sub of grid.subjects) {
        const raw = values[`${s.id}:${sub.id}`];
        if (raw !== undefined && raw.trim() !== "" && Number.isFinite(Number(raw))) {
          total += Number(raw);
          count += 1;
        }
      }
      return { id: s.id, total, count, avg: count ? total / count : 0 };
    });
    const ranked = [...rows].sort((a, b) => b.total - a.total);
    const out: Record<string, { total: number; count: number; avg: number; position: number }> = {};
    ranked.forEach((r, i) => {
      const prev = ranked[i - 1];
      const position =
        i > 0 && prev && prev.total === r.total ? out[prev.id].position : i + 1;
      out[r.id] = { total: r.total, count: r.count, avg: r.avg, position };
    });
    return out;
  }, [grid, values]);

  return (
    <div className="space-y-4">
      <Card className="print:hidden">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Exam</Label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              className="flex h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Choose an exam</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                  {ex.term ? ` · ${ex.term}` : ""}
                  {ex.year ? ` · ${ex.year}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Class</Label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="flex h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Choose a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleLoad}
              disabled={!examId || !classId || isPending}
              className="w-full"
            >
              {isPending ? "Loading..." : "Open class"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {exams.length === 0 && (
        <p className="text-sm text-muted-foreground print:hidden">
          There is no exam yet. Create one on the Exams page first.
        </p>
      )}

      {message && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm print:hidden">
          {message}
        </p>
      )}

      {grid && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">
                {grid.className} · {grid.exam.name}
              </h2>
              <p className="text-xs text-muted-foreground print:hidden">
                Leave a box empty if the student did not write that subject.
                Scores are out of 100.
              </p>
            </div>
            <div className="flex gap-2 print:hidden">
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? "Saving..." : "Save scores"}
              </Button>
              <PrintButton />
            </div>
          </div>

          {grid.students.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              There are no active students in this class.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left">
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">Student</th>
                    {grid.subjects.map((sub) => (
                      <th key={sub.id} className="px-2 py-2 text-center">
                        {sub.name}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center">Total</th>
                    <th className="px-2 py-2 text-center">Avg</th>
                    <th className="px-2 py-2 text-center">Pos</th>
                    <th className="px-2 py-2 print:hidden"></th>
                  </tr>
                </thead>
                <tbody>
                  {grid.students.map((s, i) => {
                    const sum = summary[s.id];
                    return (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="px-2 py-1.5">{i + 1}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {s.name}
                          <span className="block text-xs text-muted-foreground">
                            {s.admissionNo}
                          </span>
                        </td>
                        {grid.subjects.map((sub) => {
                          const key = `${s.id}:${sub.id}`;
                          return (
                            <td key={sub.id} className="px-1 py-1 text-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step="0.01"
                                value={values[key] ?? ""}
                                onChange={(e) =>
                                  setValues((v) => ({ ...v, [key]: e.target.value }))
                                }
                                className="h-8 w-16 rounded-md border px-1 text-center text-sm print:border-0"
                              />
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 text-center font-medium">
                          {sum && sum.count ? Math.round(sum.total * 100) / 100 : ""}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {sum && sum.count ? Math.round(sum.avg * 10) / 10 : ""}
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {sum && sum.count ? sum.position : ""}
                        </td>
                        <td className="px-2 py-1.5 text-right print:hidden">
                          <Link
                            href={`/dashboard/exams/report-card?studentId=${s.id}&examId=${grid.exam.id}`}
                            className="text-xs text-primary underline"
                          >
                            Report card
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
