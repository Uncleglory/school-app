"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getSchoolSettings() {
  let settings = await db.schoolSettings.findFirst();
  if (!settings) {
    settings = await db.schoolSettings.create({
      data: {
        name: "My School",
        motto: "Excellence in Education",
        address: "123 Education Avenue, City",
        phone: "+234 800 000 0000",
        email: "info@myschool.edu",
        principal: "Dr. Principal Name",
      },
    });
  }
  return settings;
}

export async function updateSchoolSettings(data: {
  name: string;
  motto?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  principal?: string;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can update school settings");
  }

  const existing = await db.schoolSettings.findFirst();

  if (existing) {
    await db.schoolSettings.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        motto: data.motto || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        website: data.website || null,
        logoUrl: data.logoUrl || null,
        principal: data.principal || null,
      },
    });
  } else {
    await db.schoolSettings.create({
      data: {
        name: data.name,
        motto: data.motto || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        website: data.website || null,
        logoUrl: data.logoUrl || null,
        principal: data.principal || null,
      },
    });
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard/exams");
}
