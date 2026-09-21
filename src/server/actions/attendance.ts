"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
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

    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: "ABSENCE_ALERT",
          title: `Student ${statusLabel}: ${studentName}`,
          message: `${studentName} was marked ${statusLabel} on ${data.date}.${data.note ? ` Note: ${data.note}` : ""}`,
          link: `/dashboard/attendance?date=${data.date}`,
        },
      });
      // Email/SMS to admin (non-blocking)
      notifyAbsence({
        recipientEmail: admin.email,
        recipientPhone: admin.phone,
        studentName,
        status: statusLabel,
        date: data.date,
        note: data.note,
      }).catch(() => {});
    }

    // 2. Alert parents of this student
    for (const guardian of record.student.guardians) {
      await db.notification.create({
        data: {
          userId: guardian.parent.userId,
          type: "ABSENCE_ALERT",
          title: `Your child was marked ${statusLabel}`,
          message: `${studentName} was marked ${statusLabel} on ${data.date}.${data.note ? ` Note: ${data.note}` : ""}`,
          link: `/dashboard/attendance?date=${data.date}`,
        },
      });
      notifyAbsence({
        recipientEmail: guardian.parent.user.email,
        recipientPhone: guardian.parent.user.phone,
        studentName,
        status: statusLabel,
        date: data.date,
        note: data.note,
      }).catch(() => {});
    }
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function bulkMarkStudentAttendance(data: {
  classId: string;
  date: string;
  records: { studentId: string; status: AttendanceStatus }[];
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const allowedRoles: Role[] = ["ADMIN", "TEACHER"];
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error("You do not have permission");
  }

  const attendanceDate = new Date(data.date);

  for (const rec of data.records) {
    await markStudentAttendance({
      studentId: rec.studentId,
      date: data.date,
      status: rec.status,
    });
  }

  revalidatePath("/dashboard/attendance");
  return { success: true, count: data.records.length };
}

// ─────────────────────────────────────────────
// STAFF ATTENDANCE
// ─────────────────────────────────────────────

export async function markStaffAttendance(data: {
  staffId: string;
  date: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  note?: string;
}) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const allowedRoles: Role[] = ["ADMIN"];
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error("Only admins can mark staff attendance");
  }

  const attendanceDate = new Date(data.date);

  const record = await db.staffAttendance.upsert({
    where: {
      staffId_date: {
        staffId: data.staffId,
        date: attendanceDate,
      },
    },
    update: {
      status: data.status,
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      note: data.note || null,
    },
    create: {
      staffId: data.staffId,
      date: attendanceDate,
      status: data.status,
      checkIn: data.checkIn ? new Date(data.checkIn) : null,
      checkOut: data.checkOut ? new Date(data.checkOut) : null,
      note: data.note || null,
    },
    include: {
      staff: {
        include: { user: true },
      },
    },
  });

  // Alert Admins on staff absence/late
  if (data.status === "ABSENT" || data.status === "LATE") {
    const staffName = `${record.staff.user.firstName} ${record.staff.user.lastName}`;
    const statusLabel = data.status === "ABSENT" ? "absent" : "late";

    const admins = await db.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    for (const admin of admins) {
      // Don't notify the person who just marked it if they are the only admin (optional)
      await db.notification.create({
        data: {
          userId: admin.id,
          type: "STAFF_ABSENCE_ALERT",
          title: `Staff ${statusLabel}: ${staffName}`,
          message: `${staffName} (${record.staff.position || "Staff"}) was marked ${statusLabel} on ${data.date}.`,
          link: `/dashboard/attendance?tab=staff&date=${data.date}`,
        },
      });
    }
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard");
  return { success: true };
}

// ─────────────────────────────────────────────
// QUERIES
// ─────────────────────────────────────────────

export async function getStudentsForAttendance(classId?: string, date?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const attendanceDate = date ? new Date(date) : new Date();
  attendanceDate.setHours(0, 0, 0, 0);

  const students = await db.student.findMany({
    where: {
      status: "ACTIVE",
      ...(classId ? { classId } : {}),
    },
    include: {
      class: true,
      attendance: {
        where: { date: attendanceDate },
      },
    },
    orderBy: [{ class: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
  });

  return students.map((s) => ({
    id: s.id,
    admissionNo: s.admissionNo,
    name: `${s.firstName} ${s.lastName}`,
    className: s.class?.name || "Unassigned",
    classId: s.classId,
    currentStatus: s.attendance[0]?.status || null,
    note: s.attendance[0]?.note || null,
  }));
}

export async function getStaffForAttendance(date?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const attendanceDate = date ? new Date(date) : new Date();
  attendanceDate.setHours(0, 0, 0, 0);

  const staff = await db.staff.findMany({
    include: {
      user: true,
      attendance: {
        where: { date: attendanceDate },
      },
    },
    orderBy: { staffNo: "asc" },
  });

  return staff.map((s) => ({
    id: s.id,
    staffNo: s.staffNo,
    name: `${s.user.firstName} ${s.user.lastName}`,
    position: s.position || "Staff",
    department: s.department,
    currentStatus: s.attendance[0]?.status || null,
    checkIn: s.attendance[0]?.checkIn,
    checkOut: s.attendance[0]?.checkOut,
    note: s.attendance[0]?.note || null,
  }));
}

export async function getClasses() {
  return db.class.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
