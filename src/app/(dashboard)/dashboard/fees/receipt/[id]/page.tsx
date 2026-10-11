import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { getPaymentReceipt } from "@/server/actions/print";
import { getSchoolSettings } from "@/server/actions/settings";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;

  const payment = await getPaymentReceipt(id).catch(() => null);
  if (!payment) notFound();

  const school = await getSchoolSettings();

  const invoice = payment.invoice;
  const student = invoice.student;
  const total = Number(invoice.amount);
  const paidSoFar = Number(invoice.amountPaid);
  const balance = Math.max(0, total - paidSoFar);
  const receivedBy = payment.receivedBy
    ? `${payment.receivedBy.firstName} ${payment.receivedBy.lastName}`
    : "—";

  return (
    <div className="mx-auto max-w-md space-y-4">
      {/* Buttons (not printed) */}
      <div className="flex gap-2 print:hidden">
        <a
          href="/dashboard/fees"
          className="h-9 rounded-md border px-4 text-sm font-medium inline-flex items-center"
        >
          Back to fees
        </a>
        <div
          dangerouslySetInnerHTML={{
            __html:
              '<button type="button" onclick="window.print()" style="height:36px;border-radius:6px;background:#111;color:#fff;padding:0 16px;font-size:14px;font-weight:500">Print receipt</button>',
          }}
        />
      </div>

      <div className="rounded-md border bg-white p-6 text-sm text-black">
        <div className="text-center space-y-0.5 border-b pb-3">
          <h1 className="text-lg font-bold">{school.name}</h1>
          {school.address && <p className="text-xs">{school.address}</p>}
          {(school.phone || school.email) && (
            <p className="text-xs">
              {[school.phone, school.email].filter(Boolean).join(" · ")}
            </p>
          )}
          <p className="pt-2 font-semibold tracking-wide">PAYMENT RECEIPT</p>
        </div>

        <div className="space-y-1.5 py-3">
          <Row label="Receipt No" value={payment.receiptNo} />
          <Row label="Date" value={formatDate(payment.paidAt)} />
          <Row
            label="Student"
            value={`${student.lastName} ${student.firstName}`}
          />
          <Row label="Admission No" value={student.admissionNo} />
          <Row label="Class" value={student.class?.name || "—"} />
          <Row
            label="Fee"
            value={invoice.description || invoice.feeStructure?.name || invoice.number}
          />
          <Row label="Invoice No" value={invoice.number} />
          {invoice.term && <Row label="Term" value={invoice.term.name} />}
        </div>

        <div className="space-y-1.5 border-t py-3">
          <Row label="Fee amount" value={formatCurrency(total)} />
          <Row
            label="Amount paid now"
            value={formatCurrency(Number(payment.amount))}
            bold
          />
          <Row label="Total paid so far" value={formatCurrency(paidSoFar)} />
          <Row label="Balance" value={formatCurrency(balance)} bold />
        </div>

        <div className="space-y-1.5 border-t py-3">
          <Row label="Method" value={payment.method.replace(/_/g, " ")} />
          {payment.reference && <Row label="Reference" value={payment.reference} />}
          {payment.note && <Row label="Note" value={payment.note} />}
          <Row label="Received by" value={receivedBy} />
        </div>

        <p className="border-t pt-3 text-center text-xs">
          Thank you. Please keep this receipt.
        </p>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-600">{label}</span>
      <span className={bold ? "font-bold text-right" : "text-right"}>{value}</span>
    </div>
  );
    }
