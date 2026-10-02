"use client";

import { useState, useTransition } from "react";
import {
  createFeeStructure,
  generateInvoicesForStructure,
  hideFeeStructure,
  recordPayment,
  updateFeeStructure,
} from "@/server/actions/fees";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { Wallet, FileText, CreditCard, Plus, Zap, Pencil, EyeOff, Banknote } from "lucide-react";

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

const UNASSIGNED = "Unassigned";

function balanceOf(inv: Invoice) {
  return Number(inv.amount) - Number(inv.amountPaid);
}

function className(inv: Invoice) {
  return inv.student.class?.name || UNASSIGNED;
}

export function FeesClient({ structures, invoices, stats, years, terms, classes, userRole }: Props) {
  const [tab, setTab] = useState<"overview" | "structures" | "invoices">("overview");
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Structure | null>(null);
  const [message, setMessage] = useState("");

  // Payment form state
  const [payOpen, setPayOpen] = useState(false);
  const [payClass, setPayClass] = useState("");
  const [payStudent, setPayStudent] = useState("");
  const [payInvoiceId, setPayInvoiceId] = useState("");
  const [payAmount, setPayAmount] = useState("");

  const canManage = ["ADMIN", "ACCOUNTANT"].includes(userRole);

  // Invoices that still owe money
  const owing = invoices.filter(
    (inv) => inv.status !== "WAIVED" && balanceOf(inv) > 0
  );

  // Classes that have at least one student who still owes
  const classOptions = Array.from(new Set(owing.map((inv) => className(inv)))).sort();

  // Students in the chosen class who still owe
  const studentOptions = (() => {
    const map = new Map<string, { admissionNo: string; name: string }>();
    owing
      .filter((inv) => className(inv) === payClass)
      .forEach((inv) => {
        if (!map.has(inv.student.admissionNo)) {
          map.set(inv.student.admissionNo, {
            admissionNo: inv.student.admissionNo,
            name: `${inv.student.firstName} ${inv.student.lastName}`,
          });
        }
      });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Unpaid invoices of the chosen student
  const invoiceOptions = owing.filter(
    (inv) => className(inv) === payClass && inv.student.admissionNo === payStudent
  );

  const selectedInvoice = invoices.find((inv) => inv.id === payInvoiceId) || null;
  const selectedBalance = selectedInvoice ? balanceOf(selectedInvoice) : 0;

  function openPayment(inv?: Invoice) {
    if (inv) {
      setPayClass(className(inv));
      setPayStudent(inv.student.admissionNo);
      setPayInvoiceId(inv.id);
      setPayAmount(String(balanceOf(inv)));
    } else {
      setPayClass("");
      setPayStudent("");
      setPayInvoiceId("");
      setPayAmount("");
    }
    setPayOpen(true);
  }

  function closePayment() {
    setPayOpen(false);
    setPayClass("");
    setPayStudent("");
    setPayInvoiceId("");
    setPayAmount("");
  }

  function handleClassChange(value: string) {
    setPayClass(value);
    setPayStudent("");
    setPayInvoiceId("");
    setPayAmount("");
  }

  function handleStudentChange(value: string) {
    setPayStudent(value);
    const first = owing.find(
      (inv) => className(inv) === payClass && inv.student.admissionNo === value
    );
    if (first) {
      setPayInvoiceId(first.id);
      setPayAmount(String(balanceOf(first)));
    } else {
      setPayInvoiceId("");
      setPayAmount("");
    }
  }

  function handleInvoiceChange(value: string) {
    setPayInvoiceId(value);
    const inv = invoices.find((i) => i.id === value);
    setPayAmount(inv ? String(balanceOf(inv)) : "");
  }

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

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateFeeStructure(editing.id, {
          name: fd.get("name") as string,
          amount: Number(fd.get("amount")),
          dueDate: fd.get("dueDate") as string,
        });
        setEditing(null);
        setMessage("Fee amount and details saved.");
      } catch (err: any) {
        setMessage(err.message || "Failed");
      }
    });
  }

  function handleHide(id: string, name: string) {
    if (!confirm(`Hide / remove “${name}”? This only works if no invoices were generated yet.`)) return;
    startTransition(async () => {
      try {
        await hideFeeStructure(id);
        setMessage("Fee structure hidden.");
      } catch (err: any) {
        setMessage(err.message || "Failed");
      }
    });
  }

  function handlePayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payInvoiceId) {
      setMessage("Please choose the class, the student and the fee first.");
      return;
    }
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setMessage("Please enter the amount paid.");
      return;
    }
    if (amount > selectedBalance) {
      setMessage(
        `The amount is more than the balance (${formatCurrency(selectedBalance)}). Please check it.`
      );
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        const res = await recordPayment({
          invoiceId: payInvoiceId,
          amount,
          method: fd.get("method") as any,
          reference: (fd.get("reference") as string) || undefined,
          note: (fd.get("note") as string) || undefined,
        });
        closePayment();
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

      <div className="flex flex-wrap items-center justify-between gap-2">
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

        {canManage && (
          <Button size="sm" onClick={() => openPayment()}>
            <Banknote className="h-4 w-4 mr-1.5" /> Record Payment
          </Button>
        )}
      </div>

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
                    <Input name="name" placeholder="Primary 1 – Term 1 Tuition" required />
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

          {editing && canManage && (
            <Card className="gold-card">
              <CardHeader>
                <CardTitle className="text-base">Edit fee — add or change the amount</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdate} className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Name</Label>
                    <Input name="name" required defaultValue={editing.name} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount (₦)</Label>
                    <Input name="amount" type="number" min="0" step="0.01" required defaultValue={Number(editing.amount)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due Date</Label>
                    <Input name="dueDate" type="date" required defaultValue={String(editing.dueDate).slice(0, 10)} />
                  </div>
                  <div className="sm:col-span-3 flex gap-2">
                    <Button type="submit" disabled={isPending}>Save amount</Button>
                    <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
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
                <div className="overflow-x-auto">
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
                              <div className="flex justify-end gap-1 flex-wrap">
                                <Button size="sm" variant="outline" onClick={() => { setEditing(s); setShowCreate(false); }}>
                                  <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                                </Button>
                                <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleHide(s.id, s.name)}>
                                  <EyeOff className="h-3.5 w-3.5 mr-1" /> Hide
                                </Button>
                                <Button size="sm" variant="outline" disabled={isPending} onClick={() => handleGenerate(s.id)}>
                                  <Zap className="h-3.5 w-3.5 mr-1" /> Generate Invoices
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "invoices" && (
        <Card>
          <CardContent className="pt-4">
            {invoices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No invoices yet. Go to Structures and click “Generate Invoices” on a fee.
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
                      const balance = balanceOf(inv);
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
                                <a href={`/dashboard/fees/receipt/${inv.payments[0].id}`}>Receipt</a>
                              </Button>
                            )}
                            {canManage && balance > 0 && (
                              <Button size="sm" variant="outline" onClick={() => openPayment(inv)}>
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

      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Record Payment</CardTitle>
              <CardDescription>Choose the class, the student and the amount paid. A receipt is made automatically.</CardDescription>
            </CardHeader>
            <CardContent>
              {owing.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    There are no unpaid invoices yet. First open Structures and click “Generate Invoices” on each fee. Then come back here.
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" onClick={() => { closePayment(); setTab("structures"); }}>
                      Go to Structures
                    </Button>
                    <Button type="button" variant="outline" onClick={closePayment}>Close</Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePayment} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Class</Label>
                    <select
                      value={payClass}
                      onChange={(e) => handleClassChange(e.target.value)}
                      required
                      className="flex h-9 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="">Choose class…</option>
                      {classOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Student</Label>
                    <select
                      value={payStudent}
                      onChange={(e) => handleStudentChange(e.target.value)}
                      required
                      disabled={!payClass}
                      className="flex h-9 w-full rounded-md border px-3 text-sm disabled:opacity-50"
                    >
                      <option value="">Choose student…</option>
                      {studentOptions.map((s) => (
                        <option key={s.admissionNo} value={s.admissionNo}>
                          {s.name} ({s.admissionNo})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Which fee</Label>
                    <select
                      value={payInvoiceId}
                      onChange={(e) => handleInvoiceChange(e.target.value)}
                      required
                      disabled={!payStudent}
                      className="flex h-9 w-full rounded-md border px-3 text-sm disabled:opacity-50"
                    >
                      <option value="">Choose fee…</option>
                      {invoiceOptions.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {(inv.description || inv.number)} — balance {formatCurrency(balanceOf(inv))}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedInvoice && (
                    <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
                      Fee: {formatCurrency(Number(selectedInvoice.amount))} · Paid so far: {formatCurrency(Number(selectedInvoice.amountPaid))} · Balance: <strong>{formatCurrency(selectedBalance)}</strong>
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <Label>Amount paid (₦)</Label>
                    <Input
                      name="amount"
                      type="number"
                      min="1"
                      max={selectedBalance || undefined}
                      step="0.01"
                      required
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                    />
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
                    <Button type="button" variant="outline" onClick={closePayment}>Cancel</Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
