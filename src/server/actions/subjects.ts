"use server";
 
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
 
type Level = "JUNIOR" | "SENIOR" | "BOTH";
 
function refresh() {
  revalidatePath("/dashboard/subjects");
  revalidatePath("/dashboard/classes");
  revalidatePath("/dashboard/materials");
  revalidatePath("/dashboard/exams");
}
 
async function requireAdmin(message: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error(message);
  }
}
 
export async function getSubjectsFull() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
 
  return db.subject.findMany({
    orderBy: { name: "asc" },
    include: {
      classes: {
        orderBy: { class: { name: "asc" } },
        include: {
          class: { select: { id: true, name: true, level: true } },
          teacher: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      },
    },
  });
}
 
export async function getClassOptions() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
 
  return db.class.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, level: true },
  });
}
 
export async function createSubject(data: {
  name: string;
  code: string;
  level: Level;
}) {
  await requireAdmin("Only admins can add subjects");
 
  const name = data.name.trim();
  const code = data.code.trim().toUpperCase();
  if (!name || !code) throw new Error("Name and code are required");
 
  const existing = await db.subject.findUnique({ where: { code } });
  if (existing) {
    throw new Error(`The code ${code} is already used by ${existing.name}`);
  }
 
  await db.subject.create({ data: { name, code, level: data.level } });
 
  refresh();
  return { success: true };
}
 
export async function updateSubject(
  id: string,
  data: { name: string; code: string; level: Level }
) {
  await requireAdmin("Only admins can edit subjects");
 
  const name = data.name.trim();
  const code = data.code.trim().toUpperCase();
  if (!name || !code) throw new Error("Name and code are required");
 
  const existing = await db.subject.findFirst({
    where: { code, NOT: { id } },
  });
  if (existing) {
    throw new Error(`The code ${code} is already used by ${existing.name}`);
  }
 
  await db.subject.update({
    where: { id },
    data: { name, code, level: data.level },
  });
 
  refresh();
  return { success: true };
}
 
export async function deleteSubject(id: string) {
  await requireAdmin("Only admins can delete subjects");
 
  const subject = await db.subject.findUnique({
    where: { id },
    include: { _count: { select: { materials: true, results: true } } },
  });
  if (!subject) throw new Error("Subject not found");
 
  if (subject._count.materials > 0 || subject._count.results > 0) {
    throw new Error(
      `Cannot delete ${subject.name} – it still has ${subject._count.materials} material(s) and ${subject._count.results} exam result(s).`
    );
  }
 
  await db.subject.delete({ where: { id } });
 
  refresh();
  return { success: true };
}
 
export async function assignSubjectToClass(data: {
  subjectId: string;
  classId: string;
  teacherId?: string;
}) {
  await requireAdmin("Only admins can assign subjects");
 
  await db.classSubject.upsert({
    where: {
      classId_subjectId: {
        classId: data.classId,
        subjectId: data.subjectId,
      },
    },
    update: { teacherId: data.teacherId || null },
    create: {
      classId: data.classId,
      subjectId: data.subjectId,
      teacherId: data.teacherId || null,
    },
  });
 
  refresh();
  return { success: true };
}
 
export async function updateAssignmentTeacher(
  classSubjectId: string,
  teacherId: string | null
) {
  await requireAdmin("Only admins can change teachers");
 
  await db.classSubject.update({
    where: { id: classSubjectId },
    data: { teacherId: teacherId || null },
  });
 
  refresh();
  return { success: true };
}
 
export async function removeAssignment(classSubjectId: string) {
  await requireAdmin("Only admins can remove assignments");
 
  await db.classSubject.delete({ where: { id: classSubjectId } });
 
  refresh();
  return { success: true };
}
 













