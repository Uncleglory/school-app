"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { normalizeNgPhone, sendBulkSms } from "@/lib/notify";

// Only the proprietor and the school manager may message parents in bulk.
async function requireSender() {
  const session = await auth();
  if (!session?.user || !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Only the proprietor or school manager can message parents");
  }
  return session;
}

const MAX_MESSAGE = 480; // 3 SMS parts

function cleanMessage(message: string) {
  const text = (message || "").trim();
  if (!text) throw new Error("Please type a message");
  if (text.length > MAX_MESSAGE) {
    throw new Error(`Message is too long (${text.length}). Keep it under ${MAX_MESSAGE} characters.`);
  }
  return text;
}

/** Classes with how many active students have a usable parent phone. */
export async function getMessagingOverview() {
  await requireSender();

  const [classes, students] = await Promise.all([
    db.class.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.student.findMany({
      where: { status: "ACTIVE" },
      select: { classId: true, parentPhone: true },
    }),
  ]);

  return classes.map((c) => {
    const inClass = students.filter((s) => s.classId === c.id);
    return {
      id: c.id,
      name: c.name,
      total: inClass.length,
      withPhone: inClass.filter((s) => normalizeNgPhone(s.parentPhone)).length,
    };
  });
}

async function collectRecipients(classIds: string[]) {
  if (!classIds.length) return { phones: [] as string[], students: 0, missing: 0, invalid: 0 };

  const students = await db.student.findMany({
    where: { status: "ACTIVE", classId: { in: classIds } },
    select: { parentPhone: true },
  });

  const phones = new Set<string>();
  let missing = 0;
  let invalid = 0;
  for (const s of students) {
    if (!s.parentPhone || !s.parentPhone.trim()) {
      missing++;
      continue;
    }
    const n = normalizeNgPhone(s.parentPhone);
    if (!n) invalid++;
    else phones.add(n);
  }
  return { phones: Array.from(phones), students: students.length, missing, invalid };
}

/** How many parents would get the message. Nothing is sent. */
export async function previewRecipients(classIds: string[]) {
  await requireSender();
  const r = await collectRecipients(classIds);
  return {
    students: r.students,
    parents: r.phones.length, // brothers and sisters share one parent number: one SMS
    missing: r.missing,
    invalid: r.invalid,
  };
}

/** Sends the message to the selected classes' parents. */
export async function sendMessageToParents(data: { classIds: string[]; message: string; expectedParents: number }) {
  const session = await requireSender();
  const message = cleanMessage(data.message);
  const r = await collectRecipients(data.classIds);

  if (r.phones.length === 0) throw new Error("No parent phone numbers found in the selected classes");
  // Guards against the list changing between preview and send
  if (r.phones.length !== data.expectedParents) {
    throw new Error(
      `The number of parents changed from ${data.expectedParents} to ${r.phones.length}. Please check the preview again.`
    );
  }

  const result = await sendBulkSms({ numbers: r.phones, message });
  console.log(`[bulk-sms] by ${session.user.id}: ${result.sent} sent, ${result.failed} failed`);
  return { sent: result.sent, failed: result.failed, errors: result.errors };
}

/** Sends the message to one number (your own phone) so you can see it first. */
export async function sendTestMessage(data: { phone: string; message: string }) {
  await requireSender();
  const message = cleanMessage(data.message);
  const phone = normalizeNgPhone(data.phone);
  if (!phone) throw new Error("That is not a valid Nigerian phone number");

  const result = await sendBulkSms({ numbers: [phone], message });
  return { sent: result.sent, failed: result.failed, errors: result.errors };
}
