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
