"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

async function requireStaffManagementAccess() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

export async function getStaffList() {
  await requireStaffManagementAccess();

  return db.staff.findMany({
    include: {
      // Never return the full User record: passwordHash and other private fields
      // must not cross the server-action boundary.
      user: {
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
      },
      formClasses: true,
      _count: { select: { attendance: true, leaveRequests: true } },
    },
    orderBy: { staffNo: "asc" },
  });
}

export async function getStaffById(id: string) {
  await requireStaffManagementAccess();

  return db.staff.findUnique({
    where: { id },
    include: {
      // Explicit allowlist prevents passwordHash from being returned.
      user: {
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
      },
      formClasses: true,
      attendance: { orderBy: { date: "desc" }, take: 30 },
      leaveRequests: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
}

export async function createStaff(data: {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  staffNo: string;
  department?: string;
  position?: string;
  hireDate: string;
  isTeaching?: boolean;
  role?: Role;
  password?: string;
}) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Only admins can create staff");
  }

  // A School Manager may only create ordinary staff logins. Admin, Accountant
  // and Manager logins would give access to fees, so only an Admin can make them.
  const requestedRole = data.role || (data.isTeaching ? "TEACHER" : "STAFF");
  if (
    session.user.role === "MANAGER" &&
    !["TEACHER", "STAFF", "LIBRARIAN"].includes(requestedRole)
  ) {
    throw new Error("Only the Admin can create this type of login");
  }

  const existingUser = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existingUser) throw new Error("Email already in use");

  const existingStaff = await db.staff.findUnique({ where: { staffNo: data.staffNo } });
  if (existingStaff) throw new Error("Staff number already exists");

  const passwordHash = await bcrypt.hash(data.password || "password123", 12);
  const role = data.role || (data.isTeaching ? "TEACHER" : "STAFF");

  const user = await db.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone || null,
      role,
    },
  });

  const staff = await db.staff.create({
    data: {
      userId: user.id,
      staffNo: data.staffNo,
      department: data.department || null,
      position: data.position || null,
      hireDate: new Date(data.hireDate),
      isTeaching: data.isTeaching ?? false,
    },
  });

  revalidatePath("/dashboard/staff");
  return staff;
}

export async function updateStaff(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    department?: string;
    position?: string;
    isTeaching?: boolean;
    isActive?: boolean;
  }
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const staff = await db.staff.findUnique({ where: { id } });
  if (!staff) throw new Error("Staff not found");

  await db.user.update({
    where: { id: staff.userId },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone || null }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await db.staff.update({
    where: { id },
    data: {
      ...(data.department !== undefined && { department: data.department || null }),
      ...(data.position !== undefined && { position: data.position || null }),
      ...(data.isTeaching !== undefined && { isTeaching: data.isTeaching }),
    },
  });

  revalidatePath("/dashboard/staff");
}
