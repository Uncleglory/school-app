"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getMyNotifications() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  return db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
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

  return db.notification.count({
    where: { userId: session.user.id, isRead: false },
  });
}
