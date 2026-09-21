"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function getAttendanceReport(dateFrom: string, dateTo: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const from = new Date(dateFrom);
  const to = new Date(dateTo);

  const records = await db.studentAttendance.groupBy({
    by: ["status"],
    where: {
      date: { gte: from, lte: to },
    },
    _count: { status: true },
  });

  const total = records.reduce((s, r) => s + r._count.status, 0);

  return {
    records: records.map((r) => ({
      status: r.status,
      count: r._count.status,
      percentage: total ? Math.round((r._count.status / total) * 100) : 0,
    })),
    total,
  };
}

export async function getFeeCollectionReport() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const byStatus = await db.invoice.groupBy({
    by: ["status"],
    _sum: { amount: true, amountPaid: true },
    _count: true,
  });

  const recentPayments = await db.payment.findMany({
    take: 10,
    orderBy: { paidAt: "desc" },
    include: {
      invoice: {
        include: { student: true },
      },
      receivedBy: { select: { firstName: true, lastName: true } },
    },
  });

  return { byStatus, recentPayments };
}

export async function getAcademicPerformance(examId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const results = await db.examResult.findMany({
    where: { examId },
    include: {
      student: { include: { class: true } },
      subject: true,
    },
  });

  // Average by subject
  const bySubject: Record<string, { total: number; count: number; name: string }> = {};
  for (const r of results) {
    const key = r.subjectId;
    if (!bySubject[key]) {
      bySubject[key] = { total: 0, count: 0, name: r.subject.name };
    }
    bySubject[key].total += r.score.toNumber();
    bySubject[key].count += 1;
  }

  const subjectAverages = Object.values(bySubject).map((s) => ({
    subject: s.name,
    average: Math.round((s.total / s.count) * 100) / 100,
    count: s.count,
  }));

  // Grade distribution
  const gradeDist: Record<string, number> = {};
  for (const r of results) {
    const g = r.grade || "N/A";
    gradeDist[g] = (gradeDist[g] || 0) + 1;
  }

  return { subjectAverages, gradeDist, totalResults: results.length };
}
