"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { MaterialType, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getTeacherAssignments, teacherHasSubjectAssignment } from "@/server/teacher-access";

export async function getMaterials(filters?: { classId?: string; subjectId?: string }) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  // Students/Parents only see visible materials, and only for their own class
  // (or their children's classes). Materials with no class are shown to everyone.
  const role = session.user.role;
  const onlyVisible = ["STUDENT", "PARENT"].includes(role);

  let allowedClassIds: string[] | null = null;
  const teacherAssignments = role === "TEACHER" ? await getTeacherAssignments(session.user.id) : null;
  if (teacherAssignments) {
    if (filters?.classId && !teacherAssignments.classIds.includes(filters.classId)) {
      throw new Error("You can only view materials for your assigned classes");
    }
    if (filters?.subjectId && !teacherAssignments.teaching.some((item) =>
      item.subjectId === filters.subjectId && (!filters.classId || item.classId === filters.classId)
    )) {
      throw new Error("You can only view materials for your assigned subjects");
    }
    allowedClassIds = teacherAssignments.classIds;
  } else if (role === "STUDENT") {
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

  const materials = await db.teachingMaterial.findMany({
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

  if (!teacherAssignments) return materials;
  return materials.filter((material) => {
    if (!material.classId && !material.subjectId) return true;
    if (!material.classId && material.subjectId) {
      return teacherAssignments.teaching.some((item) => item.subjectId === material.subjectId);
    }
    if (material.classId && !teacherAssignments.classIds.includes(material.classId)) return false;
    if (material.classId && material.subjectId) {
      return teacherHasSubjectAssignment(teacherAssignments, material.classId, material.subjectId);
    }
    return true;
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
  if (!session?.user || !["ADMIN", "MANAGER", "TEACHER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  if (session.user.role === "TEACHER") {
    const assignments = await getTeacherAssignments(session.user.id);
    if (!data.classId && !data.subjectId) {
      throw new Error("Please choose an assigned class or subject for this material");
    }
    if (data.classId && !assignments.classIds.includes(data.classId)) {
      throw new Error("You can only add materials to your assigned classes");
    }
    if (data.subjectId && (data.classId
      ? !teacherHasSubjectAssignment(assignments, data.classId, data.subjectId)
      : !assignments.teaching.some((item) => item.subjectId === data.subjectId))) {
      throw new Error("You can only add materials for your assigned subjects");
    }
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
  if (!session?.user || !["ADMIN", "MANAGER", "TEACHER"].includes(session.user.role)) {
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
