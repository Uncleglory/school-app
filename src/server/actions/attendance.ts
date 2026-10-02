"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/lib/telegram";
import { AttendanceStatus, NotificationType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────
// STUDENT ATTENDANCE
// ─────────────────────────────────────────────

export async function markStudentAttendance(data: {
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  note?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const allowedRoles: Role[] = ["ADMIN", "TEACHER"];
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error("You do not have permission to mark attendance");
  }

  const attendanceDate = new Date(data.date);

  const record = await db.studentAttendance.upsert({
    where: {
      studentId_date: {
        studentId: data.studentId,
        date: attendanceDate,
      },
    },
    update: {
      status: data.status,
      note: data.note || null,
      markedById: session.user.id,
    },
    create: {
      studentId: data.studentId,
      date: attendanceDate,
      status: data.status,
      note: data.note || null,
      markedById: session.user.id,
    },
    include: {
      student: {
        include: {
          guardians: {
            include: {
              parent: {
                include: { user: true },
              },
            },
          },
        },
      },
    },
  });

  // ─── ALERTS (in-app + email + SMS) ───────────
  if (data.status === "ABSENT" || data.status === "LATE") {
    const studentName = `${record.student.firstName} ${record.student.lastName}`;
    const statusLabel = data.status === "ABSENT" ? "absent" : "late";

    const { notifyAbsence } = await import("@/lib/notify");

    // 1. Alert all Admins
    const admins = await db.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true, email: true, phone: true },
    });

    for (const admin of admin
