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

// ─── Absentees: pick up everyone marked absent and message their parents ───

/** Today's date in Nigeria (Africa/Lagos) as YYYY-MM-DD. */
function lagosToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}

function parseDay(date?: string) {
  const day = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : lagosToday();
  const d = new Date(`${day}T00:00:00.000Z`); // same way the register stores dates
  if (isNaN(d.getTime())) throw new Error("Invalid date");
  return { day, d };
}

export type AbsenteeRow = {
  studentId: string;
  name: string;
  className: string;
  parentName: string | null;
  phone: string | null; // normalised, null if missing or invalid
  rawPhone: string | null;
};

/** Everyone marked ABSENT on the day (default today), with the parent's number. */
export async function getAbsentees(date?: string) {
  await requireSender();
  const { day, d } = parseDay(date);

  const [records, markedStudents, classes] = await Promise.all([
    db.studentAttendance.findMany({
      where: { date: d, status: "ABSENT", student: { status: "ACTIVE" } },
      select: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            parentName: true,
            parentPhone: true,
            class: { select: { name: true } },
          },
        },
      },
    }),
    db.studentAttendance.findMany({
      where: { date: d, student: { status: "ACTIVE" } },
      select: { student: { select: { classId: true } } },
    }),
    db.class.findMany({
      select: { id: true, name: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } },
    }),
  ]);

  const rows: AbsenteeRow[] = records
    .map(({ student: s }) => ({
      studentId: s.id,
      name: `${s.lastName.toUpperCase()} ${s.firstName}`.trim(),
      className: s.class?.name ?? "No class",
      parentName: s.parentName?.trim() || null,
      phone: normalizeNgPhone(s.parentPhone),
      rawPhone: s.parentPhone?.trim() || null,
    }))
    .sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) || a.name.localeCompare(b.name));

  const markedClassIds = new Set(markedStudents.map((m) => m.student.classId).filter(Boolean));
  const unmarkedClasses = classes
    .filter((c) => c._count.students > 0 && !markedClassIds.has(c.id))
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return { date: day, rows, unmarkedClasses };
}

const MAX_ABSENTEE_SEND = 150;

/** Sends to the parents of the ticked absent students. {NAME} and {DATE} are filled in per child. */
export async function sendToAbsentees(data: { studentIds: string[]; message: string; date?: string }) {
  const session = await requireSender();
  const message = cleanMessage(data.message);
  const { day } = parseDay(data.date);
  const ids = Array.from(new Set(data.studentIds || []));
  if (ids.length === 0) throw new Error("Tick at least one student");
  if (ids.length > MAX_ABSENTEE_SEND) throw new Error(`Please send to at most ${MAX_ABSENTEE_SEND} students at a time`);

  // Re-check on the server: only students really marked absent on that day
  const { rows } = await getAbsentees(day);
  const chosen = rows.filter((r) => ids.includes(r.studentId));
  if (chosen.length === 0) throw new Error("None of the ticked students are marked absent for that day. Please refresh the list.");

  // Brothers and sisters share one parent number: one SMS naming them both
  const byPhone = new Map<string, string[]>();
  let skipped = 0;
  for (const r of chosen) {
    if (!r.phone) {
      skipped++;
      continue;
    }
    byPhone.set(r.phone, [...(byPhone.get(r.phone) ?? []), r.name]);
  }
  if (byPhone.size === 0) throw new Error("None of the ticked students has a valid parent number");

  const pretty = new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const personal = /\{NAME\}/i.test(message);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  if (!personal) {
    const text = message.replace(/\{DATE\}/gi, pretty);
    const res = await sendBulkSms({ numbers: Array.from(byPhone.keys()), message: text });
    sent = res.sent;
    failed = res.failed;
    errors.push(...res.errors);
  } else {
    for (const [phone, names] of byPhone) {
      const first = names.map((n) => {
        const parts = n.split(" ");
        return parts.slice(1).join(" ") || parts[0]; // "ADEDEJI Anuoluwa" -> "Anuoluwa"
      });
      const who = first.length > 1 ? `${first.slice(0, -1).join(", ")} and ${first[first.length - 1]}` : first[0];
      const text = message.replace(/\{NAME\}/gi, who).replace(/\{DATE\}/gi, pretty);
      const res = await sendBulkSms({ numbers: [phone], message: text });
      sent += res.sent;
      failed += res.failed;
      for (const e of res.errors) if (!errors.includes(e)) errors.push(e);
    }
  }

  console.log(`[absentee-sms] by ${session.user.id}: ${sent} sent, ${failed} failed, ${skipped} skipped`);
  return { sent, failed, skipped, errors };
}
