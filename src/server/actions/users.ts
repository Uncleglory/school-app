"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

const STAFF_ROLES: Role[] = ["TEACHER", "STAFF", "LIBRARIAN", "ACCOUNTANT"];

export async function getUsers(roleFilter?: Role) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can view users");
  }

  return db.user.findMany({
    where: roleFilter ? { role: roleFilter } : undefined,
    orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      staff: { select: { id: true, staffNo: true, position: true } },
      parent: { select: { id: true, relationship: true } },
      student: { select: { id: true, admissionNo: true } },
    },
  });
}

export async function createUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: Role;
  // Optional staff fields
  staffNo?: string;
  department?: string;
  position?: string;
  isTeaching?: boolean;
  // Optional parent fields
  relationship?: string;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can create users");
  }

  const existing = await db.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) throw new Error("A user with this email already exists");

  const passwordHash = await bcrypt.hash(data.password, 12);

  const user = await db.user.create({
    data: {
      email: data.email.toLowerCase().trim(),
      passwordHash,
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      phone: data.phone?.trim() || null,
      role: data.role,
      isActive: true,
    },
  });

  // Create related Staff / Parent record if needed
  if (data.role === "TEACHER" || data.role === "STAFF" || data.role === "LIBRARIAN" || data.role === "ACCOUNTANT") {
    const staffNo = data.staffNo || `STF-${Date.now().toString().slice(-6)}`;
    await db.staff.create({
      data: {
        userId: user.id,
        staffNo,
        department: data.department || null,
        position: data.position || data.role,
        hireDate: new Date(),
        isTeaching: data.isTeaching ?? data.role === "TEACHER",
      },
    });
  }

  if (data.role === "PARENT") {
    await db.parent.create({
      data: {
        userId: user.id,
        relationship: data.relationship || "Guardian",
      },
    });
  }

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/staff");
  return { success: true, id: user.id };
}

export async function updateUser(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    role?: Role;
    isActive?: boolean;
    password?: string;
  }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can update users");
  }

  const current = await db.user.findUnique({
    where: { id },
    select: { id: true, email: true, role: true },
  });
  if (!current) throw new Error("User not found");

  // Protect your own account
  if (session.user.id === id) {
    if (data.role && data.role !== "ADMIN") {
      throw new Error("You cannot remove your own Admin role");
    }
    if (data.isActive === false) {
      throw new Error("You cannot deactivate your own account");
    }
  }

  const updateData: any = {
    ...(data.firstName && { firstName: data.firstName.trim() }),
    ...(data.lastName && { lastName: data.lastName.trim() }),
    ...(data.phone !== undefined && { phone: data.phone?.trim() || null }),
    ...(data.role && { role: data.role }),
    ...(data.isActive !== undefined && { isActive: data.isActive }),
  };

  // Email change (must stay unique)
  if (data.email) {
    const newEmail = data.email.toLowerCase().trim();
    if (newEmail !== current.email) {
      const taken = await db.user.findUnique({ where: { email: newEmail } });
      if (taken) throw new Error("Another user already uses this email");
      updateData.email = newEmail;
    }
  }

  // Password change (leave empty to keep the current password)
  if (data.password) {
    if (data.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    updateData.passwordHash = await bcrypt.hash(data.password, 12);
  }

  await db.user.update({
    where: { id },
    data: updateData,
  });

  // If the role changed, make sure the matching Staff / Parent record exists
  if (data.role && data.role !== current.role) {
    if (STAFF_ROLES.includes(data.role)) {
      const hasStaff = await db.staff.findUnique({ where: { userId: id } });
      if (!hasStaff) {
        await db.staff.create({
          data: {
            userId: id,
            staffNo: `STF-${Date.now().toString().slice(-6)}`,
            position: data.role,
            hireDate: new Date(),
            isTeaching: data.role === "TEACHER",
          },
        });
      }
    }

    if (data.role === "PARENT") {
      const hasParent = await db.parent.findUnique({ where: { userId: id } });
      if (!hasParent) {
        await db.parent.create({
          data: {
            userId: id,
            relationship: "Guardian",
          },
        });
      }
    }
  }

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/staff");
  return { success: true };
}

export async function deleteUser(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can delete users");
  }

  if (session.user.id === id) {
    throw new Error("You cannot delete your own account");
  }

  // Cascade will handle related Staff / Parent / Student records
  await db.user.delete({ where: { id } });

  revalidatePath("/dashboard/users");
  revalidatePath("/dashboard/staff");
  return { success: true };
}

export async function toggleUserActive(id: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can change user status");
  }

  const user = await db.user.findUnique({ where: { id }, select: { isActive: true } });
  if (!user) throw new Error("User not found");

  await db.user.update({
    where: { id },
    data: { isActive: !user.isActive },
  });

  revalidatePath("/dashboard/users");
  return { success: true, isActive: !user.isActive };
}
