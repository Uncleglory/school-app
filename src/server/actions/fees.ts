"use server";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { InvoiceStatus, PaymentMethod, Role, NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { Decimal } from "@prisma/client/runtime/library";

// ─────────────────────────────────────────────
// FEE STRUCTURES
// ─────────────────────────────────────────────

export async function createFeeStructure(data: {
  name: string;
  academicYearId: string;
  termId?: string;
  classId?: string;
  amount: number;
  dueDate: string;
  autoGenerate?: boolean;
}) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const structure = await db.feeStructure.create({
    data: {
      name: data.name,
      academicYearId: data.academicYearId,
      termId: data.termId || null,
      classId: data.classId || null,
      amount: new Decimal(data.amount),
      dueDate: new Date(data.dueDate),
      autoGenerate: data.autoGenerate ?? true,
    },
  });

  revalidatePath("/dashboard/fees");
  return structure;
}

export async function getFeeStructures() {
  return db.feeStructure.findMany({
    include: {
      academicYear: true,
      term: true,
      class: true,
      _count: { select: { invoices: true } },
    },
    orderBy: { dueDate: "desc" },
  });
}

// ─────────────────────────────────────────────
// AUTO-GENERATE INVOICES
// ─────────────────────────────────────────────

export async function generateInvoicesForStructure(feeStructureId: string) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const structure = await db.feeStructure.findUnique({
    where: { id: feeStructureId },
    include: { class: true },
  });
  if (!structure) throw new Error("Fee structure not found");

  // Get target students
  const students = await db.student.findMany({
    where: {
      status: "ACTIVE",
      ...(structure.classId ? { classId: structure.classId } : {}),
    },
  });

  let created = 0;
  const year = new Date().getFullYear();

  for (const student of students) {
    // Skip if invoice already exists for this structure + student
    const existing = await db.invoice.findFirst({
      where: {
        studentId: student.id,
        feeStructureId: structure.id,
      },
    });
    if (existing) continue;

    // Generate unique invoice number
    const count = await db.invoice.count();
    const number = `INV-${year}-${String(count + 1).padStart(5, "0")}`;

    await db.invoice.create({
      data: {
        number,
        studentId: student.id,
        feeStructureId: structure.id,
        termId: structure.termId,
        description: structure.name,
        amount: structure.amount,
        amountPaid: 0,
        status: "UNPAID",
        dueDate: structure.dueDate,
      },
    });
    created++;
  }

  revalidatePath("/dashboard/fees");
  return { created };
}

// ─────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────

export async function getInvoices(filters?: {
  status?: InvoiceStatus;
  studentId?: string;
  classId?: string;
}) {
  return db.invoice.findMany({
    where: {
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.studentId ? { studentId: filters.studentId } : {}),
      ...(filters?.classId
        ? { student: { classId: filters.classId } }
        : {}),
    },
    include: {
      student: { include: { class: true } },
      feeStructure: true,
      term: true,
      payments: true,
    },
    orderBy: { issuedAt: "desc" },
  });
}

export async function getInvoiceById(id: string) {
  return db.invoice.findUnique({
    where: { id },
    include: {
      student: { include: { class: true, guardians: { include: { parent: { include: { user: true } } } } } },
      feeStructure: true,
      term: true,
      payments: { include: { receivedBy: true }, orderBy: { paidAt: "desc" } },
    },
  });
}

// ─────────────────────────────────────────────
// PAYMENTS + RECEIPTS
// ─────────────────────────────────────────────

export async function recordPayment(data: {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
    throw new Error("Unauthorized");
  }

  const invoice = await db.invoice.findUnique({
    where: { id: data.invoiceId },
    include: {
      student: {
        include: {
          guardians: { include: { parent: { include: { user: true } } } },
        },
      },
    },
  });
  if (!invoice) throw new Error("Invoice not found");

  const payAmount = new Decimal(data.amount);
  const newPaid = new Decimal(invoice.amountPaid).plus(payAmount);
  const total = new Decimal(invoice.amount);

  let newStatus: InvoiceStatus = "PARTIALLY_PAID";
  if (newPaid.greaterThanOrEqualTo(total)) {
    newStatus = "PAID";
  } else if (newPaid.equals(0)) {
    newStatus = "UNPAID";
  }

  // Generate receipt number
  const year = new Date().getFullYear();
  const count = await db.payment.count();
  const receiptNo = `RCP-${year}-${String(count + 1).padStart(5, "0")}`;

  const payment = await db.payment.create({
    data: {
      invoiceId: data.invoiceId,
      receiptNo,
      amount: payAmount,
      method: data.method,
      reference: data.reference || null,
      note: data.note || null,
      receivedById: session.user.id,
    },
  });

  await db.invoice.update({
    where: { id: data.invoiceId },
    data: {
      amountPaid: newPaid,
      status: newStatus,
    },
  });

  // Notify parents + admins (in-app + email + SMS)
  const { notifyPayment } = await import("@/lib/notify");
  const studentName = `${invoice.student.firstName} ${invoice.student.lastName}`;
  const amountStr = `₦${data.amount.toLocaleString()}`;
  const balanceStr = `₦${total.minus(newPaid).toNumber().toLocaleString()}`;

  for (const g of invoice.student.guardians) {
    await db.notification.create({
      data: {
        userId: g.parent.userId,
        type: "PAYMENT_RECEIVED",
        title: `Payment received — ${receiptNo}`,
        message: `Payment of ${amountStr} received for ${studentName} (${invoice.number}). New balance: ${balanceStr}`,
        link: `/dashboard/fees?invoice=${invoice.id}`,
      },
    });
    notifyPayment({
      recipientEmail: g.parent.user.email,
      recipientPhone: g.parent.user.phone,
      studentName,
      amount: amountStr,
      receiptNo,
      balance: balanceStr,
    }).catch(() => {});
  }

  const admins = await db.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true, email: true, phone: true },
  });
  for (const admin of admins) {
    await db.notification.create({
      data: {
        userId: admin.id,
        type: "PAYMENT_RECEIVED",
        title: `Payment received — ${receiptNo}`,
        message: `${studentName} paid ${amountStr} for ${invoice.description || invoice.number}`,
        link: `/dashboard/fees?invoice=${invoice.id}`,
      },
    });
    notifyPayment({
      recipientEmail: admin.email,
      recipientPhone: admin.phone,
      studentName,
      amount: amountStr,
      receiptNo,
      balance: balanceStr,
    }).catch(() => {});
  }

  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard");
  return { payment, receiptNo, newStatus };
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

export async function getAcademicYears() {
  return db.academicYear.findMany({ orderBy: { startDate: "desc" } });
}

export async function getTerms(academicYearId?: string) {
  return db.term.findMany({
    where: academicYearId ? { academicYearId } : undefined,
    orderBy: { startDate: "asc" },
  });
}

export async function getFeeStats() {
  const [totalInvoiced, totalPaid, unpaidCount, overdueCount] = await Promise.all([
    db.invoice.aggregate({ _sum: { amount: true } }),
    db.invoice.aggregate({ _sum: { amountPaid: true } }),
    db.invoice.count({ where: { status: "UNPAID" } }),
    db.invoice.count({ where: { status: "OVERDUE" } }),
  ]);

  return {
    totalInvoiced: totalInvoiced._sum.amount?.toNumber() || 0,
    totalPaid: totalPaid._sum.amountPaid?.toNumber() || 0,
    unpaidCount,
    overdueCount,
  };
}
