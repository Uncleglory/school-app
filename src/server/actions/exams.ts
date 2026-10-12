"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ExamType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

function calculateGrade(score: number, maxScore: number = 100): string {
  const pct = (score / maxScore) * 100;
  if (pct >= 70) return "A";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 45) return "D";
  if (pct >= 40) return "E";
  return "F";
}

// ─────────────────────────────────────────────
// EXAMS
// ─────────────────────────────────────────────

export async function createExam(data: {
  name: string;
  type: ExamType;
  academicYearId: string;
  termId?: string;
  startDate: string;
  endDate: string;
}) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const exam = await db.exam.create({
    data: {
      name: data.name,
      type: data.type,
      academicYearId: data.academicYearId,
      termId: data.termId || null,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
    },
  });

  revalidatePath("/dashboard/exams");
  return exam;
}

export async function getExams() {
  return db.exam.findMany({
    include: {
      academicYear: true,
      term: true,
      _count: { select: { results: true } },
    },
    orderBy: { startDate: "desc" },
  });
}

export async function publishExam(examId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can publish results");
  }

  await db.exam.update({
    where: { id: examId },
    data: { isPublished: true },
  });

  revalidatePath("/dashboard/exams");
}

// ─────────────────────────────────────────────
// RESULTS / MARKS ENTRY
// ─────────────────────────────────────────────

export async function enterResult(data: {
  examId: string;
  studentId: string;
  subjectId: string;
  score: number;
  maxScore?: number;
  remark?: string;
}) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const maxScore = data.maxScore ?? 100;
  const grade = calculateGrade(data.score, maxScore);

  const result = await db.examResult.upsert({
    where: {
      examId_studentId_subjectId: {
        examId: data.examId,
        studentId: data.studentId,
        subjectId: data.subjectId,
      },
    },
    update: {
      score: new Decimal(data.score),
      maxScore: new Decimal(maxScore),
      grade,
      remark: data.remark || null,
      enteredById: session.user.id,
    },
    create: {
      examId: data.examId,
      studentId: data.studentId,
      subjectId: data.subjectId,
      score: new Decimal(data.score),
      maxScore: new Decimal(maxScore),
      grade,
      remark: data.remark || null,
      enteredById: session.user.id,
    },
  });

  revalidatePath("/dashboard/exams");
  revalidatePath("/dashboard/reports");
  return result;
}

export async function getResultsForExam(examId: string, classId?: string) {
  return db.examResult.findMany({
    where: {
      examId,
      ...(classId ? { student: { classId } } : {}),
    },
    include: {
      student: { include: { class: true } },
      subject: true,
      enteredBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { subject: { name: "asc" } },
    ],
  });
}

export async function getStudentReportCard(studentId: string, examId: string) {
  const results = await db.examResult.findMany({
    where: { studentId, examId },
    include: { subject: true, exam: true },
    orderBy: { subject: { name: "asc" } },
  });

  const student = await db.student.findUnique({
    where: { id: studentId },
    include: { class: true },
  });

  const totalScore = results.reduce((sum, r) => sum + r.score.toNumber(), 0);
  const totalMax = results.reduce((sum, r) => sum + r.maxScore.toNumber(), 0);
  const average = results.length ? totalScore / results.length : 0;
  const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

  return {
    student,
    exam: results[0]?.exam || null,
    results,
    summary: {
      totalScore,
      totalMax,
      average: Math.round(average * 100) / 100,
      percentage: Math.round(percentage * 100) / 100,
      overallGrade: calculateGrade(percentage),
    },
  };
}

export async function getSubjects() {
  return db.subject.findMany({ orderBy: { name: "asc" } });
}

export async function getStudentsByClass(classId?: string) {
  return db.student.findMany({
    where: {
      status: "ACTIVE",
      ...(classId ? { classId } : {}),
    },
    include: { class: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

// ─────────────────────────────────────────────
// CLASS RESULTS (enter a whole class at once)
// ─────────────────────────────────────────────

export async function getClassResultsGrid(examId: string, classId: string) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const [exam, klass, students, classSubjects, existing] = await Promise.all([
    db.exam.findUnique({ where: { id: examId }, select: { id: true, name: true } }),
    db.class.findUnique({ where: { id: classId }, select: { id: true, name: true } }),
    db.student.findMany({
      where: { classId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, admissionNo: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.classSubject.findMany({
      where: { classId },
      include: { subject: { select: { id: true, name: true } } },
    }),
    db.examResult.findMany({
      where: { examId, student: { classId } },
      select: { studentId: true, subjectId: true, score: true },
    }),
  ]);

  if (!exam || !klass) throw new Error("Exam or class not found");

  // Use the subjects set up for this class; if none are set up, offer every subject
  let subjects = classSubjects.map((cs) => cs.subject);
  if (subjects.length === 0) {
    subjects = await db.subject.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }
  subjects.sort((a, b) => a.name.localeCompare(b.name));

  const scores: Record<string, number> = {};
  for (const r of existing) {
    scores[`${r.studentId}:${r.subjectId}`] = Number(r.score);
  }

  return {
    exam,
    className: klass.name,
    students: students.map((s) => ({
      id: s.id,
      name: `${s.lastName} ${s.firstName}`,
      admissionNo: s.admissionNo,
    })),
    subjects,
    scores,
  };
}

export async function saveClassScores(data: {
  examId: string;
  entries: { studentId: string; subjectId: string; score: number }[];
}) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const entries = data.entries.filter(
    (e) => Number.isFinite(e.score) && e.score >= 0 && e.score <= 100
  );
  if (entries.length !== data.entries.length) {
    throw new Error("Every score must be a number from 0 to 100");
  }

  const CHUNK = 100;
  for (let i = 0; i < entries.length; i += CHUNK) {
    const chunk = entries.slice(i, i + CHUNK);
    await db.$transaction(
      chunk.map((e) =>
        db.examResult.upsert({
          where: {
            examId_studentId_subjectId: {
              examId: data.examId,
              studentId: e.studentId,
              subjectId: e.subjectId,
            },
          },
          update: {
            score: new Decimal(e.score),
            maxScore: new Decimal(100),
            grade: calculateGrade(e.score, 100),
            enteredById: session.user.id,
          },
          create: {
            examId: data.examId,
            studentId: e.studentId,
            subjectId: e.subjectId,
            score: new Decimal(e.score),
            maxScore: new Decimal(100),
            grade: calculateGrade(e.score, 100),
            enteredById: session.user.id,
          },
        })
      )
    );
  }

  revalidatePath("/dashboard/exams");
  revalidatePath("/dashboard/results");
  revalidatePath("/dashboard/reports");
  return { saved: entries.length };
}
