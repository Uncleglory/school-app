"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Gender, StudentStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Roles that may read student records (students and parents may not)
const STAFF_ROLES: Role[] = ["ADMIN", "TEACHER", "ACCOUNTANT", "LIBRARIAN", "STAFF"];

async function requireStaff() {
  const session = await auth();
  if (!session?.user || !STAFF_ROLES.includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

// A teacher may only see students in class(es) they are the form teacher
// of, or where they teach a subject. An unassigned teacher sees none.
async function getTeacherAllowedClassIds(userId: string): Promise<string[]> {
  const staff = await db.staff.findUnique({
    where: { userId },
    include: {
      formClasses: { select: { id: true } },
      teaching: { select: { classId: true } },
    },
  });

  if (!staff) return [];

  const ids = new Set<string>();
  staff.formClasses.forEach((c) => ids.add(c.id));
  staff.teaching.forEach((t) => ids.add(t.classId));
  return Array.from(ids);
}

// Only safe user fields: never include the password hash
const SAFE_USER = {
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
    role: true,
    isActive: true,
    avatarUrl: true,
  },
} as const;

export async function getStudents(filters?: { classId?: string; status?: StudentStatus; search?: string }) {
  const session = await requireStaff();

  let effectiveClassIds: string[] | null = null; // null = no restriction

  if (session.user.role === "TEACHER") {
    const allowed = await getTeacherAllowedClassIds(session.user.id);
    if (filters?.classId) {
      if (!allowed.includes(filters.classId)) {
        throw new Error("You can only view students in your own class");
      }
      effectiveClassIds = [filters.classId];
    } else {
      effectiveClassIds = allowed; // [] if the teacher isn't assigned to any class
    }
  } else if (filters?.classId) {
    effectiveClassIds = [filters.classId];
  }

  return db.student.findMany({
    where: {
      ...(effectiveClassIds ? { classId: { in: effectiveClassIds } } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              { firstName: { contains: filters.search, mode: "insensitive" } },
              { lastName: { contains: filters.search, mode: "insensitive" } },
              { admissionNo: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      class: true,
      guardians: { include: { parent: { include: { user: SAFE_USER } } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getStudentById(id: string) {
  const session = await requireStaff();

  if (session.user.role === "TEACHER") {
    const student = await db.student.findUnique({ where: { id }, select: { classId: true } });
    const allowed = await getTeacherAllowedClassIds(session.user.id);
    if (!student?.classId || !allowed.includes(student.classId)) {
      throw new Error("You can only view students in your own class");
    }
  }

  return db.student.findUnique({
    where: { id },
    include: {
      class: true,
      user: SAFE_USER,
      guardians: { include: { parent: { include: { user: SAFE_USER } } } },
      attendance: { orderBy: { date: "desc" }, take: 30 },
      invoices: { orderBy: { issuedAt: "desc" }, take: 10 },
    },
  });
}

// Bills a student for the fees their class already pays.
// A fee is only used if it is set to auto-generate AND invoices for it have
// already been generated for this student's class (so unreleased fees, such as
// next term's, are never billed by surprise). Students who already have an
// invoice for a fee are skipped, so running this twice is safe.
async function autoInvoiceStudent(studentId: string): Promise<number> {
  try {
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { id: true, classId: true, status: true },
    });
    if (!student || !student.classId || student.status !== "ACTIVE") return 0;

    const structures = await db.feeStructure.findMany({
      where: {
        autoGenerate: true,
        OR: [
          { classId: student.classId },
          { classId: null, invoices: { some: { student: { classId: student.classId } } } },
        ],
        invoices: { some: {} },
      },
    });
    if (structures.length === 0) return 0;

    const already = await db.invoice.findMany({
      where: {
        studentId: student.id,
        feeStructureId: { in: structures.map((s) => s.id) },
      },
      select: { feeStructureId: true },
    });
    const have = new Set(already.map((i) => i.feeStructureId));

    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const last = await db.invoice.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    let sequence = last ? parseInt(last.number.slice(prefix.length), 10) || 0 : 0;

    let created = 0;
    for (const s of structures) {
      if (have.has(s.id)) continue;
      sequence += 1;
      await db.invoice.create({
        data: {
          number: `${prefix}${String(sequence).padStart(5, "0")}`,
          studentId: student.id,
          feeStructureId: s.id,
          termId: s.termId,
          description: s.name,
          amount: s.amount,
          amountPaid: 0,
          status: "UNPAID",
          dueDate: s.dueDate,
        },
      });
      created++;
    }

    if (created > 0) {
      revalidatePath("/dashboard/fees");
      revalidatePath("/dashboard");
    }
    return created;
  } catch (err) {
    // Billing must never stop a student from being saved.
    console.error("Auto-invoice failed for student", studentId, err);
    return 0;
  }
}

export async function createStudent(data: {
  admissionNo: string;
  firstName: string;
  lastName: string;
  otherName?: string;
  gender: Gender;
  dateOfBirth: string;
  address?: string;
  classId?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
}) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const existing = await db.student.findUnique({ where: { admissionNo: data.admissionNo } });
  if (existing) throw new Error("Admission number already exists");

  const student = await db.student.create({
    data: {
      admissionNo: data.admissionNo,
      firstName: data.firstName,
      lastName: data.lastName,
      otherName: data.otherName || null,
      gender: data.gender,
      dateOfBirth: new Date(data.dateOfBirth),
      address: data.address || null,
      classId: data.classId || null,
      parentName: data.parentName?.trim() || null,
      parentPhone: data.parentPhone?.trim() || null,
      parentEmail: data.parentEmail?.trim().toLowerCase() || null,
      status: "ACTIVE",
    },
  });

  if (student.classId) await autoInvoiceStudent(student.id);

  revalidatePath("/dashboard/students");
  return student;
}

export async function updateStudent(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    otherName?: string;
    gender?: Gender;
    dateOfBirth?: string;
    address?: string;
    classId?: string | null;
    status?: StudentStatus;
    parentName?: string;
    parentPhone?: string;
    parentEmail?: string;
  }
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const student = await db.student.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.otherName !== undefined && { otherName: data.otherName || null }),
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.dateOfBirth !== undefined && { dateOfBirth: new Date(data.dateOfBirth) }),
      ...(data.address !== undefined && { address: data.address || null }),
      ...(data.classId !== undefined && { classId: data.classId || null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.parentName !== undefined && { parentName: data.parentName.trim() || null }),
      ...(data.parentPhone !== undefined && { parentPhone: data.parentPhone.trim() || null }),
      ...(data.parentEmail !== undefined && {
        parentEmail: data.parentEmail.trim().toLowerCase() || null,
      }),
    },
  });

  // New class or re-activated student: bill the fees of their class.
  if (data.classId !== undefined || data.status !== undefined) {
    await autoInvoiceStudent(student.id);
  }

  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${id}`);
  return student;
}

export async function deleteStudent(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can delete students");
  }

  await db.student.delete({ where: { id } });
  revalidatePath("/dashboard/students");
}
