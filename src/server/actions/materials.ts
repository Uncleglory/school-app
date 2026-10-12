"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MaterialType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getMaterials(filters?: { classId?: string; subjectId?: string }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Students/Parents only see visible materials, and only for their own class
  // (or their children's classes). Materials with no class are shown to everyone.
  const role = session.user.role;
  const onlyVisible = ["STUDENT", "PARENT"].includes(role);

  let allowedClassIds: string[] | null = null;
  if (role === "STUDENT") {
    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: { classId: true },
    });
    allowedClassIds = student?.classId ? [student.classId] : [];
  } else if (role === "PARENT") {
    const children = await db.parentStudent.findMany({
      where: { parent: { userId: session.user.id } },
      select: { student: { select: { classId: true } } },
    });
    allowedClassIds = children
      .map((c) => c.student.classId)
      .filter((id): id is string => !!id);
  }

  return db.teachingMaterial.findMany({
    where: {
      ...(onlyVisible ? { visibleToStudents: true } : {}),
      ...(allowedClassIds
        ? { OR: [{ classId: null }, { classId: { in: allowedClassIds } }] }
        : {}),
      ...(filters?.classId ? { classId: filters.classId } : {}),
      ...(filters?.subjectId ? { subjectId: filters.subjectId } : {}),
    },
    include: {
      class: true,
      subject: true,
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createMaterial(data: {
  title: string;
  description?: string;
  type: MaterialType;
  fileUrl: string;
  classId?: string;
  subjectId?: string;
  visibleToStudents?: boolean;
}) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const material = await db.teachingMaterial.create({
    data: {
      title: data.title,
      description: data.description || null,
      type: data.type,
      fileUrl: data.fileUrl,
      classId: data.classId || null,
      subjectId: data.subjectId || null,
      uploadedById: session.user.id,
      visibleToStudents: data.visibleToStudents ?? true,
    },
  });

  revalidatePath("/dashboard/materials");
  return material;
}

export async function deleteMaterial(id: string) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  // Teachers can only delete their own
  const material = await db.teachingMaterial.findUnique({ where: { id } });
  if (!material) throw new Error("Not found");
  if (session.user.role === "TEACHER" && material.uploadedById !== session.user.id) {
    throw new Error("You can only delete your own materials");
  }

  await db.teachingMaterial.delete({ where: { id } });
  revalidatePath("/dashboard/materials");
}
