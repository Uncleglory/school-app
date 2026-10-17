"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { LibraryItemType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getTeacherAssignments, teacherHasSubjectAssignment } from "@/server/teacher-access";

const ITEM_TYPES = Object.values(LibraryItemType);

// Only normal web links and files uploaded to our own storage are allowed.
// This blocks "javascript:" and similar links from being saved.
function cleanUrl(value: string) {
  const trimmed = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Please enter a full web address starting with https://");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http or https links are allowed");
  }
  return parsed.toString();
}

function isStaff(role?: string) {
  return ["ADMIN", "MANAGER", "TEACHER"].includes(role as string);
}

export async function getLearningLibrary() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const include = {
    class: { select: { id: true, name: true } },
    subject: { select: { id: true, name: true } },
    addedBy: { select: { firstName: true, lastName: true } },
  };

  // Admins and managers see the full library. Teachers are assignment-scoped.
  if (["ADMIN", "MANAGER"].includes(session.user.role)) {
    return {
      items: await db.libraryItem.findMany({
        include,
        orderBy: [{ topic: "asc" }, { createdAt: "desc" }],
      }),
      studentClass: null as string | null,
    };
  }

  if (session.user.role === "TEACHER") {
    const assignments = await getTeacherAssignments(session.user.id);
    const items = await db.libraryItem.findMany({
      where: { OR: [{ classId: null }, { classId: { in: assignments.classIds } }] },
      include,
      orderBy: [{ topic: "asc" }, { createdAt: "desc" }],
    });
    return {
      items: items.filter((item) => {
        if (!item.classId && !item.subjectId) return true;
        if (!item.classId && item.subjectId) return assignments.teaching.some((t) => t.subjectId === item.subjectId);
        if (item.classId && !assignments.classIds.includes(item.classId)) return false;
        if (item.classId && item.subjectId) return teacherHasSubjectAssignment(assignments, item.classId, item.subjectId);
        return true;
      }),
      studentClass: null as string | null,
    };
  }

  // Students only see items for their own class (plus items meant for all classes)
  if (session.user.role === "STUDENT") {
    const student = await db.student.findUnique({
      where: { userId: session.user.id },
      select: { classId: true, class: { select: { name: true } } },
    });

    if (!student?.classId) {
      return { items: [], studentClass: null as string | null };
    }

    return {
      items: await db.libraryItem.findMany({
        where: { OR: [{ classId: student.classId }, { classId: null }] },
        include,
        orderBy: [{ topic: "asc" }, { createdAt: "desc" }],
      }),
      studentClass: student.class?.name ?? null,
    };
  }

  throw new Error("Unauthorized");
}

export async function createLibraryItem(data: {
  title: string;
  description?: string;
  type: LibraryItemType;
  topic: string;
  sourceName?: string;
  url: string;
  classId?: string;
  subjectId?: string;
}) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const title = data.title.trim();
  const topic = data.topic.trim();
  if (!title) throw new Error("Please enter a title");
  if (!topic) throw new Error("Please enter a topic");
  if (!ITEM_TYPES.includes(data.type)) throw new Error("Invalid material type");

  if (session.user.role === "TEACHER") {
    const assignments = await getTeacherAssignments(session.user.id);
    if (!data.classId && !data.subjectId) {
      throw new Error("Please choose an assigned class or subject for this library item");
    }
    if (data.classId && !assignments.classIds.includes(data.classId)) {
      throw new Error("You can only add items to your assigned classes");
    }
    if (data.subjectId && (data.classId
      ? !teacherHasSubjectAssignment(assignments, data.classId, data.subjectId)
      : !assignments.teaching.some((item) => item.subjectId === data.subjectId))) {
      throw new Error("You can only add items for your assigned subjects");
    }
  }

  const item = await db.libraryItem.create({
    data: {
      title,
      topic,
      description: data.description?.trim() || null,
      type: data.type,
      sourceName: data.sourceName?.trim() || null,
      url: cleanUrl(data.url),
      classId: data.classId || null,
      subjectId: data.subjectId || null,
      addedById: session.user.id,
    },
  });

  revalidatePath("/dashboard/learning-library");
  return item;
}

export async function deleteLibraryItem(id: string) {
  const session = await auth();
  if (!session?.user || !isStaff(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const item = await db.libraryItem.findUnique({ where: { id } });
  if (!item) throw new Error("Not found");

  // Teachers can only delete their own items within their assignment scope.
  if (session.user.role === "TEACHER") {
    if (item.addedById !== session.user.id) {
      throw new Error("You can only delete items you added");
    }
    const assignments = await getTeacherAssignments(session.user.id);
    if (item.classId && !assignments.classIds.includes(item.classId)) {
      throw new Error("You can only manage items for your assigned classes");
    }
    if (item.classId && item.subjectId && !teacherHasSubjectAssignment(assignments, item.classId, item.subjectId)) {
      throw new Error("You can only manage items for your assigned subjects");
    }
    if (!item.classId && item.subjectId && !assignments.teaching.some((t) => t.subjectId === item.subjectId)) {
      throw new Error("You can only manage items for your assigned subjects");
    }
    if (!item.classId && !item.subjectId) {
      throw new Error("Only an admin or manager can delete school-wide items");
    }
  }

  await db.libraryItem.delete({ where: { id } });
  revalidatePath("/dashboard/learning-library");
}
