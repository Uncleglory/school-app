import { db } from "@/lib/db";

export async function getTeacherAssignments(userId: string) {
  const staff = await db.staff.findUnique({
    where: { userId },
    select: {
      id: true,
      formClasses: { select: { id: true } },
      teaching: { select: { classId: true, subjectId: true } },
    },
  });

  const teaching = staff?.teaching ?? [];
  const classIds = new Set<string>([
    ...(staff?.formClasses.map((item) => item.id) ?? []),
    ...teaching.map((item) => item.classId),
  ]);

  return {
    staffId: staff?.id ?? null,
    classIds: Array.from(classIds),
    teaching,
  };
}

export function teacherHasSubjectAssignment(
  assignments: Awaited<ReturnType<typeof getTeacherAssignments>>,
  classId: string,
  subjectId: string
) {
  return assignments.teaching.some(
    (item) => item.classId === classId && item.subjectId === subjectId
  );
}
