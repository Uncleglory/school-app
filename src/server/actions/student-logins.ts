"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";

const BATCH_SIZE = 20;

// No lookalike characters (no 0/O, 1/l/I)
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function makePassword(length = 8) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return result;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can manage student logins");
  }
  return session;
}

export async function getStudentLoginOverview() {
  await requireAdmin();

  const classes = await db.class.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      students: {
        where: { status: "ACTIVE" },
        select: { userId: true },
      },
    },
  });

  return classes.map((c) => ({
    id: c.id,
    name: c.name,
    total: c.students.length,
    withLogin: c.students.filter((s) => s.userId).length,
  }));
}

export async function createStudentLogins(classIds: string[]) {
  await requireAdmin();

  if (!classIds || classIds.length === 0) {
    throw new Error("Please choose at least one class");
  }

  const where = {
    status: "ACTIVE" as const,
    userId: null,
    classId: { in: classIds },
  };

  const batch = await db.student.findMany({
    where,
    take: BATCH_SIZE,
    include: { class: { select: { name: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const created: {
    admissionNo: string;
    name: string;
    className: string;
    password: string;
  }[] = [];
  const failed: string[] = [];

  for (const student of batch) {
    try {
      const password = makePassword();
      const passwordHash = await bcrypt.hash(password, 10);

      // Hidden login address (students log in with the admission number)
      const base = slug(student.admissionNo) || student.id;
      let email = `${base}@students.school.local`;
      const taken = await db.user.findUnique({ where: { email } });
      if (taken) {
        email = `${base}-${randomInt(1000, 9999)}@students.school.local`;
      }

      await db.student.update({
        where: { id: student.id },
        data: {
          user: {
            create: {
              email,
              passwordHash,
              firstName: student.firstName,
              lastName: student.lastName,
              role: "STUDENT",
              isActive: true,
            },
          },
        },
      });

      created.push({
        admissionNo: student.admissionNo,
        name: `${student.lastName} ${student.firstName}`,
        className: student.class?.name || "",
        password,
      });
    } catch {
      failed.push(student.admissionNo);
    }
  }

  const remaining = await db.student.count({ where });

  revalidatePath("/dashboard/student-logins");
  revalidatePath("/dashboard/users");
  return { created, failed, remaining };
}
