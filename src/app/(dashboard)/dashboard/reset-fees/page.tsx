import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const CONFIRM_WORD = "RESET FEES";

// One-time tool: wipes ALL fee data (payments, invoices, fee structures and
// the fee notifications). Students, classes, teachers, users, materials and
// academic years/terms are NOT touched. Admin only.
async function resetFees(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Only admins can reset fees");
  }

  const typed = String(formData.get("confirm") || "").trim();
  if (typed !== CONFIRM_WORD) {
    redirect("/dashboard/reset-fees?error=1");
  }

  const [payments, invoices, structures] = await db.$transaction([
    db.payment.deleteMany({}),
    db.invoice.deleteMany({}),
    db.feeStructure.deleteMany({}),
    db.notification.deleteMany({
      where: { type: { in: ["FEE_REMINDER", "PAYMENT_RECEIVED"] } },
    }),
  ]);

  revalidatePath("/dashboard/fees");
  revalidatePath("/dashboard");
  redirect(
    `/dashboard/reset-fees?done=1&p=${payments.count}&i=${invoices.count}&s=${structures.count}`
  );
}

export default async function ResetFeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    done?: string;
    error?: string;
    p?: string;
    i?: string;
    s?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const sp = await searchParams;

  const [payments, invoices, structures] = await Promise.all([
    db.payment.count(),
    db.invoice.count(),
    db.feeStructure.count(),
  ]);

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reset all fees</h1>
        <p className="text-muted-foreground">
          One-time tool. Deletes every fee structure, invoice and payment so
          you can start fresh. Students, classes, teachers, users and
          materials are not touched.
        </p>
      </div>

      {sp.done && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          Done. Removed {sp.p || 0} payment(s), {sp.i || 0} invoice(s) and{" "}
          {sp.s || 0} fee structure(s). You can now set up your fees again.
        </div>
      )}

      {sp.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          Nothing was deleted. You must type {CONFIRM_WORD} exactly.
        </div>
      )}

      <div className="rounded-md border p-4 text-sm space-y-1">
        <p className="font-medium">Currently in the system:</p>
        <p>Fee structures: {structures}</p>
        <p>Invoices: {invoices}</p>
        <p>Payments: {payments}</p>
      </div>

      <form action={resetFees} className="space-y-3">
        <label className="block text-sm font-medium">
          Type {CONFIRM_WORD} to confirm. This cannot be undone.
        </label>
        <input
          name="confirm"
          autoComplete="off"
          placeholder={CONFIRM_WORD}
          className="flex h-9 w-full rounded-md border px-3 text-sm"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-red-600 px-4 text-sm font-medium text-white"
        >
          Delete all fee data
        </button>
      </form>
    </div>
  );
}
