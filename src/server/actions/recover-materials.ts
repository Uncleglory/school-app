"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { list } from "@vercel/blob";
import { revalidatePath } from "next/cache";

type Kind = "NOTE" | "ASSIGNMENT" | "SLIDE" | "PAST_PAPER" | "VIDEO" | "OTHER";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can recover materials");
  }
  return session.user;
}

// Lists every file in the blob store and marks the ones that already
// have a TeachingMaterial record.
export async function listBlobFiles() {
  await requireAdmin();

  const blobs: {
    url: string;
    pathname: string;
    size: number;
    uploadedAt: string;
  }[] = [];

  let cursor: string | undefined = undefined;
  do {
    const res: Awaited<ReturnType<typeof list>> = await list({
      cursor,
      limit: 1000,
    });
    for (const b of res.blobs) {
      blobs.push({
        url: b.url,
        pathname: b.pathname,
        size: b.size,
        uploadedAt: new Date(b.uploadedAt).toISOString(),
      });
    }
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);

  const existing = await db.teachingMaterial.findMany({
    select: { fileUrl: true },
  });
  const linkedUrls = new Set(existing.map((m) => m.fileUrl));

  return blobs
    .map((b) => ({ ...b, linked: linkedUrls.has(b.url) }))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function getRecoveryOptions() {
  await requireAdmin();

  const [classes, subjects] = await Promise.all([
    db.class.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.subject.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { classes, subjects };
}

// Creates a TeachingMaterial record for each chosen file, owned by the
// admin who runs the recovery. Files that already have a record are skipped.
export async function restoreMaterials(
  items: { url: string; title: string; type: Kind; uploadedAt: string }[],
  opts: { classId?: string; subjectId?: string }
) {
  const user = await requireAdmin();

  if (!items || items.length === 0) {
    throw new Error("No files chosen");
  }

  const existing = await db.teachingMaterial.findMany({
    where: { fileUrl: { in: items.map((i) => i.url) } },
    select: { fileUrl: true },
  });
  const have = new Set(existing.map((e) => e.fileUrl));

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    if (have.has(item.url)) {
      skipped++;
      continue;
    }
    const when = new Date(item.uploadedAt);
    await db.teachingMaterial.create({
      data: {
        title: item.title.trim() || "Untitled material",
        type: item.type,
        fileUrl: item.url,
        classId: opts.classId || null,
        subjectId: opts.subjectId || null,
        uploadedById: user.id,
        visibleToStudents: true,
        ...(isNaN(when.getTime()) ? {} : { createdAt: when }),
      },
    });
    created++;
  }

  revalidatePath("/dashboard/materials");
  revalidatePath("/dashboard/recover-materials");

  return { created, skipped };
