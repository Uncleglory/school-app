"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function getPaymentReceipt(paymentId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const payment = await db.payment.findUnique({
    where: { id: paymentId },
    include: {
      invoice: {
        include: {
          student: { include: { class: true } },
          feeStructure: true,
          term: true,
        },
      },
      receivedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!payment) throw new Error("Receipt not found");

  // Parents can only see their children's receipts
  if (session.user.role === "PARENT") {
    const link = await db.parentStudent.findFirst({
      where: {
        studentId: payment.invoice.studentId,
        parent: { userId: session.user.id },
      },
    });
    if (!link) throw new Error("Unauthorized");
  }

  return payment;
}

export async function getReportCardData(studentId: string, examId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Parent can only view their children
  if (session.user.role === "PARENT") {
    const link = await db.parentStudent.findFirst({
      where: {
        studentId,
        parent: { userId: session.user.id },
      },
    });
    if (!link) throw new Error("Unauthorized");
  }

  const [student, exam, results] = await Promise.all([
    db.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    }),
    db.exam.findUnique({
      where: { id: examId },
      include: { academicYear: true, term: true },
    }),
    db.examResult.findMany({
      where: { studentId, examId },
      include: { subject: true },
      orderBy: { subject: { name: "asc" } },
    }),
  ]);

  if (!student || !exam) throw new Error("Not found");

  // Only show published results to non-staff
  if (
    !exam.isPublished &&
    !["ADMIN", "TEACHER"].includes(session.user.role)
  ) {
    throw new Error("Results not yet published");
  }

  const totalScore = results.reduce((s, r) => s + Number(r.score), 0);
  const totalMax = results.reduce((s, r) => s + Number(r.maxScore), 0);
  const average = results.length ? totalScore / results.length : 0;
  const percentage = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;

  function grade(pct: number) {
    if (pct >= 70) return "A";
    if (pct >= 60) return "B";
    if (pct >= 50) return "C";
    if (pct >= 45) return "D";
    if (pct >= 40) return "E";
    return "F";
  }

  return {
    student,
    exam,
    results,
    summary: {
      totalScore: Math.round(totalScore * 100) / 100,
      totalMax: Math.round(totalMax * 100) / 100,
      average: Math.round(average * 100) / 100,
      percentage: Math.round(percentage * 100) / 100,
      overallGrade: grade(percentage),
      subjectsCount: results.length,
    },
  };
}

export async function getPaymentsForInvoice(invoiceId: string) {
  return db.payment.findMany({
    where: { invoiceId },
    orderBy: { paidAt: "desc" },
    select: { id: true, receiptNo: true, amount: true, paidAt: true },
  });
}
