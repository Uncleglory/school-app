"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getClassesFull() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.class.findMany({
    orderBy: { name: "asc" },
    include: {
      formTeacher: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      _count: { select: { students: true } },
    },
  });
}

export async function createClass(data: {
  name: string;
  level: string;
  capacity?: number;
  formTeacherId?: string;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can create classes");
  }

  const existing = await db.class.findUnique({ where: { name: data.name } });
  if (existing) throw new Error("A class with this name already exists");

  await db.class.create({
    data: {
      name: data.name.trim(),
      level: data.level.trim(),
      capacity: data.capacity ?? 40,
      formTeacherId: data.formTeacherId || null,
    },
  });

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/attendance");
  return { success: true };
}

export async function updateClass(
  id: string,
  data: {
    name?: string;
    level?: string;
    capacity?: number;
    formTeacherId?: string | null;
  }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can update classes");
  }

  if (data.name) {
    const existing = await db.class.findFirst({
      where: { name: data.name, NOT: { id } },
    });
    if (existing) throw new Error("A class with this name already exists");
  }

  await db.class.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name.trim() }),
      ...(data.level && { level: data.level.trim() }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.formTeacherId !== undefined && { formTeacherId: data.formTeacherId }),
    },
  });

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/attendance");
  return { success: true };
}

export async function deleteClass(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can delete classes");
  }

  const studentCount = await db.student.count({ where: { classId: id } });
  if (studentCount > 0) {
    throw new Error(
      `Cannot delete class – it still has ${studentCount} student(s). Re-assign them first.`
    );
  }

  await db.class.delete({ where: { id } });

  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard/attendance");
  return { success: true };
}

export async function getStaffForFormTeacher() {
  return db.staff.findMany({
    where: { isTeaching: true },
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
    orderBy: { staffNo: "asc" },
  });
}
