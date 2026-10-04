"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { NotificationType, Role } from "@prisma/client";

// Financial notification types must never reach roles that aren't
// explicitly allowed to see money matters, even if a stray record
// somehow ends up pointed at the wrong user.
const FINANCIAL_TYPES: NotificationType[] = ["PAYMENT_RECEIVED", "FEE_REMINDER"];
const FINANCIAL_ALLOWED_ROLES: Role[] = ["ADMIN", "ACCOUNTANT", "PARENT"];

export async function getMyNotifications() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  if (FINANCIAL_ALLOWED_ROLES.includes(session.user.role)) {
    return notifications;
  }

  return notifications.filter((n) => !FINANCIAL_TYPES.includes(n.type));
}

export async function markNotificationRead(id: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { isRead: true },
  });

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  await db.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}

export async function getUnreadCount() {
  const session = await auth();
  if (!session?.user) return 0;

  const where = FINANCIAL_ALLOWED_ROLES.includes(session.user.role)
    ? { userId: session.user.id, isRead: false }
    : {
        userId: session.user.id,
        isRead: false,
        type: { notIn: FINANCIAL_TYPES },
      };

  return db.notification.count({ where });
}
