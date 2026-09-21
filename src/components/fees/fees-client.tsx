"use client";

import { useState, useTransition } from "react";
import {
  createFeeStructure,
  generateInvoicesForStructure,
  recordPayment,
} from "@/server/actions/fees";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Wallet, FileText, CreditCard, Plus, Zap } from "lucide-react";

type Structure = {
  id: string;
  name: string;
  amount: any;
  dueDate: string;
  autoGenerate: boolean;
  academicYear: { name: string };
  term: { name: string } | null;
  class: { name: string } | null;
  _count: { invoices: number };
};

type Invoice = {
  id: string;
  number: string;
  description: string | null;
  amount: any;
  amountPaid: any;
  status: string;
  dueDate: string;
  student: { firstName: string; lastName: string; admissionNo: string; class: { name: string } | null };
  payments: any[];
};

interface Props {
  structures: Structure[];
  invoices: Invoice[];
  stats: { totalInvoiced: number; totalPaid: number; unpaidCount: number; overdueCount: number };
  years: { id: string; name: string }[];
  terms: { id: string; name: string; academicYearId: string }[];
  classes: { id: string; name: string }[];
  userRole: string;
}

export function FeesClient({ structures, invoices, stats, years, terms, classes, userRole }: Props) {
  const [tab, setTab] = useState<"overview" | "structures" | "invoices">("overview");
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const canManage = ["ADMIN", "ACCOUNTANT"].includes(userRole);

  function handleCreateStructure(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createFeeStructure({
          name: fd.get("name") as string,
          academicYearId: fd.get("academicYearId") as string,
          termId: (fd.get("termId") as string) || undefined,
          classId: (fd.get("classId") as string) || undefined,
          amount: Number(fd.get("amount")),
          dueDate: fd.get("dueDate") as string,
        });
        setShowCreate(false);
        setMessage("Fee structure created");
      } catch (err: any) {
        setMessage(err.message || "Failed");
      }
    });
  }

  function handleGenerate(structureId: string) {
    startTransition(async () => {
      try {
        const res = await generateInvoicesForStructure(structureId);
        setMessage(`Generated ${res.created} invoices`);
      } catch (err: any) {
        setMessage(err.message || "Failed");
      }
    });
  }

  function handlePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payInvoiceId) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await recordPayment({
          invoiceId: payInvoiceId,
          amount: Number(fd.get("amount")),
          method: fd.get("method") as any,
          reference: (fd.get("reference") as string) || undefined,
          note: (fd.get("note") as string) || undefined,
        });
        setPayInvoiceId(null);
        setMessage(`Payment recorded. Opening receipt ${res.receiptNo}…`);
        window.location.href = `/dashboard/fees/receipt/${res.payment.id}`;
      } catch (err: any) {
        setMessage(err.message || "Failed");
      }
    });
  }

  const statusColor: Record<string, string> = {
    UNPAID: "bg-red-100 text-red-800",
    PARTIALLY_PAID: "bg-amber-100 text-amber-800",
    PAID: "bg-emerald-100 text-emerald-800",
    OVERDUE: "bg-rose-100 text-rose-800",
    WAIVED: "bg-slate-100 text-slate-800",
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800">
          {message}
          <button className="ml-3 underline" onClick={() => setMessage("")}>dismiss</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {(["overview", "structures", "invoices"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>
            {t === "overview" && <Wallet className="h-4 w-4 mr-1.5" />}
            {t === "structures" && <FileText className="h-4 w-4 mr-1.5" />}
            {t === "invoices" && <CreditCard className="h-4 w-4 mr-1.5" />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </Button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Invoiced</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(stats.totalInvoiced)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Collected</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalPaid)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-600">{stats.unpaidCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Overdue</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-red-600">{stats.overdueCount}</div></CardContent>
          </Card>
        </div>
      )}

      {/* Structures */}
      {tab === "structures" && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
                <Plus className="h-4 w-4 mr-1.5" /> New Fee Structure
              </Button>
            </div>
          )}

          {showCreate && canManage && (
            <Card>
              <CardHeader><CardTitle className="text-base">Create Fee Structure</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleCreateStructure} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Name</Label>
                    <Input name="name" placeholder="Grade 7 – Term 1 Tuition" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (₦)</Label>
                    <Input name="amount" type="number" min="0" step="0.01" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Academic Year</Label>
                    <select name="academicYearId" required className="flex h-9 w-full rounded-md border px-3 text-sm">
                      {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Term (optional)</Label>
                    <select name="termId" className="flex h-9 w-full rounded-md border px-3 text-sm">
                      <option value="">—</option>
                      {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Class (optional – leave blank for all)</Label>
                    <select name="classId" className="flex h-9 w-full rounded-md border px-3 text-sm">
                      <option value="">All Classes</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due Date</Label>
                    <Input name="dueDate" type="date" required />
                  </div>
                  <div className="sm:col-span-2 flex gap-2">
                    <Button type="submit" disabled={isPending}>Create</Button>
                    <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              {structures.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No fee structures yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Due</th>
                      <th className="pb-2 font-medium">Invoices</th>
                      {canManage && <th className="pb-2 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {structures.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-3">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.academicYear.name} {s.term ? `· ${s.term.name}` : ""} {s.class ? `· ${s.class.name}` : "· All classes"}
                          </div>
                        </td>
                        <td className="py-3">{formatCurrency(Number(s.amount))}</td>
                        <td className="py-3">{formatDate(s.dueDate)}</td>
                        <td className="py-3">{s._count.invoices}</td>
                        {canManage && (
                          <td className="py-3 text-right">
                            <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleGenerate(s.id)}>
                              <Zap className="h-3.5 w-3.5 mr-1" /> Generate Invoices
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices */}
      {tab === "invoices" && (
        <Card>
          <CardContent className="pt-4">
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No invoices yet. Create a fee structure and click “Generate Invoices”.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 font-medium">Invoice</th>
                      <th className="pb-2 font-medium">Student</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Paid</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const balance = Number(inv.amount) - Number(inv.amountPaid);
                      return (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="py-3">
                            <div className="font-mono text-xs">{inv.number}</div>
                            <div className="text-xs text-muted-foreground">{inv.description}</div>
                          </td>
                          <td className="py-3">
                            <div className="font-medium">{inv.student.firstName} {inv.student.lastName}</div>
                            <div className="text-xs text-muted-foreground">{inv.student.class?.name} · {inv.student.admissionNo}</div>
                          </td>
                          <td className="py-3">{formatCurrency(Number(inv.amount))}</td>
                          <td className="py-3">{formatCurrency(Number(inv.amountPaid))}</td>
                          <td className="py-3">
                            <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", statusColor[inv.status])}>
                              {inv.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-1">
                            {inv.payments?.length > 0 && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={`/dashboard/fees/receipt/${inv.payments[0].id}`}>
                                  Receipt
                                </a>
                              </Button>
                            )}
                            {canManage && balance > 0 && (
                              <Button size="sm" variant="outline" onClick={() => setPayInvoiceId(inv.id)}>
                                Record Payment
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Modal (simple) */}
      {payInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Record Payment</CardTitle>
              <CardDescription>Receipt will be auto-generated</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePayment} className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Amount (₦)</Label>
                  <Input name="amount" type="number" min="1" step="0.01" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <select name="method" required className="flex h-9 w-full rounded-md border px-3 text-sm">
                    <option value="CASH">Cash</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="MOBILE_MONEY">Mobile Money</option>
                    <option value="CARD">Card</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Reference (optional)</Label>
                  <Input name="reference" placeholder="Transaction ref" />
                </div>
                <div className="space-y-1.5">
                  <Label>Note (optional)</Label>
                  <Input name="note" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={isPending}>Save Payment</Button>
                  <Button type="button" variant="outline" onClick={() => setPayInvoiceId(null)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
