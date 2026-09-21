"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Gender, StudentStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getStudents(filters?: { classId?: string; status?: StudentStatus; search?: string }) {
  return db.student.findMany({
    where: {
      ...(filters?.classId ? { classId: filters.classId } : {}),
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
      guardians: { include: { parent: { include: { user: true } } } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function getStudentById(id: string) {
  return db.student.findUnique({
    where: { id },
    include: {
      class: true,
      user: true,
      guardians: { include: { parent: { include: { user: true } } } },
      attendance: { orderBy: { date: "desc" }, take: 30 },
      invoices: { orderBy: { issuedAt: "desc" }, take: 10 },
    },
  });
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
      status: "ACTIVE",
    },
  });

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
    },
  });

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
