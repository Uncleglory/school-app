"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { LoanStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

export async function getBooks(search?: string) {
  return db.book.findMany({
    where: search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { author: { contains: search, mode: "insensitive" } },
            { isbn: { contains: search, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { loans: true } } },
    orderBy: { title: "asc" },
  });
}

export async function createBook(data: {
  title: string;
  author: string;
  isbn?: string;
  category?: string;
  totalCopies: number;
  shelfLocation?: string;
}) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const book = await db.book.create({
    data: {
      title: data.title,
      author: data.author,
      isbn: data.isbn || null,
      category: data.category || null,
      totalCopies: data.totalCopies,
      availableCopies: data.totalCopies,
      shelfLocation: data.shelfLocation || null,
    },
  });

  revalidatePath("/dashboard/library");
  return book;
}

export async function updateBook(
  id: string,
  data: { title?: string; author?: string; category?: string; shelfLocation?: string; totalCopies?: number }
) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const book = await db.book.findUnique({ where: { id } });
  if (!book) throw new Error("Book not found");

  let availableCopies = book.availableCopies;
  if (data.totalCopies !== undefined) {
    const diff = data.totalCopies - book.totalCopies;
    availableCopies = Math.max(0, book.availableCopies + diff);
  }

  await db.book.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.author !== undefined && { author: data.author }),
      ...(data.category !== undefined && { category: data.category || null }),
      ...(data.shelfLocation !== undefined && { shelfLocation: data.shelfLocation || null }),
      ...(data.totalCopies !== undefined && { totalCopies: data.totalCopies, availableCopies }),
    },
  });

  revalidatePath("/dashboard/library");
}

export async function loanBook(data: { bookId: string; borrowerId: string; dueDate: string }) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const book = await db.book.findUnique({ where: { id: data.bookId } });
  if (!book || book.availableCopies < 1) throw new Error("No copies available");

  const loan = await db.bookLoan.create({
    data: {
      bookId: data.bookId,
      borrowerId: data.borrowerId,
      dueDate: new Date(data.dueDate),
      status: "ACTIVE",
    },
  });

  await db.book.update({
    where: { id: data.bookId },
    data: { availableCopies: { decrement: 1 } },
  });

  revalidatePath("/dashboard/library");
  return loan;
}

export async function returnBook(loanId: string, fine: number = 0) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "LIBRARIAN"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const loan = await db.bookLoan.findUnique({ where: { id: loanId } });
  if (!loan || loan.status === "RETURNED") throw new Error("Invalid loan");

  await db.bookLoan.update({
    where: { id: loanId },
    data: {
      status: "RETURNED",
      returnedAt: new Date(),
      fine: new Decimal(fine),
    },
  });

  await db.book.update({
    where: { id: loan.bookId },
    data: { availableCopies: { increment: 1 } },
  });

  revalidatePath("/dashboard/library");
}

export async function getActiveLoans() {
  return db.bookLoan.findMany({
    where: { status: { in: ["ACTIVE", "OVERDUE"] } },
    include: {
      book: true,
      borrower: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function getBorrowers() {
  // Students and staff who can borrow
  return db.user.findMany({
    where: {
      isActive: true,
      role: { in: ["STUDENT", "TEACHER", "STAFF", "ADMIN"] },
    },
    select: { id: true, firstName: true, lastName: true, email: true, role: true },
    orderBy: { lastName: "asc" },
  });
}
