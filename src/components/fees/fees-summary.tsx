"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

type SummaryInvoice = {
  amount: any;
  amountPaid: any;
  status: string;
  student: {
    firstName: string;
    lastName: string;
    admissionNo: string;
    class: { name: string } | null;
  };
};

type Row = {
  key: string;
  name: string;
  className: string;
  billed: number;
  paid: number;
  owing: number;
  state: "PAID" | "PART" | "NONE";
};

type ClassTotals = {
  className: string;
  full: number;
  part: number;
  none: number;
  paid: number;
  owing: number;
};

const UNASSIGNED = "Unassigned";

// One row per student, adding up all of that student's invoices
// (school fees, assignment book, etc). Waived invoices are ignored.
function buildRows(invoices: SummaryInvoice[]): Row[] {
  const map = new Map<string, Row>();
  for (const inv of invoices) {
    if (inv.status === "WAIVED") continue;
    const s = inv.student;
    const key = s.admissionNo;
    const row =
      map.get(key) ||
      ({
        key,
        name: `${s.firstName} ${s.lastName}`,
        className: s.class?.name || UNASSIGNED,
        billed: 0,
        paid: 0,
        owing: 0,
        state: "NONE",
      } as Row);
    row.billed += Number(inv.amount);
    row.paid += Number(inv.amountPaid);
    map.set(key, row);
  }

  const rows: Row[] = [];
  map.forEach((row) => {
    if (row.billed <= 0) return;
    row.owing = Math.max(row.billed - row.paid, 0);
    row.state = row.owing <= 0 ? "PAID" : row.paid > 0 ? "PART" : "NONE";
    rows.push(row);
  });
  return rows;
}

const byClass = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function FeesSummary({ invoices }: { invoices: SummaryInvoice[] }) {
  const rows = buildRows(invoices);

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Summary</CardTitle>
          <CardDescription>No invoices yet. The summary appears once fees are billed.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Totals per class
  const classMap = new Map<string, ClassTotals>();
  for (const r of rows) {
    const c =
      classMap.get(r.className) ||
      { className: r.className, full: 0, part: 0, none: 0, paid: 0, owing: 0 };
    if (r.state === "PAID") c.full += 1;
    else if (r.state === "PART") c.part += 1;
    else c.none += 1;
    c.paid += r.paid;
    c.owing += r.owing;
    classMap.set(r.className, c);
  }
  const classes = Array.from(classMap.values()).sort((a, b) => byClass(a.className, b.className));

  const full = rows.filter((r) => r.state === "PAID");
  const part = rows.filter((r) => r.state === "PART");
  const none = rows.filter((r) => r.state === "NONE");
  const sum = (list: Row[], f: (r: Row) => number) => list.reduce((t, r) => t + f(r), 0);

  const grandPaid = sum(rows, (r) => r.paid);
  const grandOwing = sum(rows, (r) => r.owing);
  const debtors = rows.filter((r) => r.owing > 0);
  const debtorClasses = classes.filter((c) => c.part + c.none > 0);

  // Debtors grouped by class for the name list
  const debtorsByClass = new Map<string, Row[]>();
  for (const r of debtors) {
    const list = debtorsByClass.get(r.className) || [];
    list.push(r);
    debtorsByClass.set(r.className, list);
  }
  const debtorGroups = Array.from(debtorsByClass.entries()).sort((a, b) => byClass(a[0], b[0]));

  // Everyone who has paid something (full or part), grouped by class
  const payersByClass = new Map<string, Row[]>();
  for (const r of rows.filter((x) => x.paid > 0)) {
    const list = payersByClass.get(r.className) || [];
    list.push(r);
    payersByClass.set(r.className, list);
  }
  const payerGroups = Array.from(payersByClass.entries()).sort((a, b) => byClass(a[0], b[0]));

  return (
    <div className="space-y-4">
      {/* Three categories */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fully Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{full.length} students</div>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(sum(full, (r) => r.paid))} paid
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Part Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{part.length} students</div>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(sum(part, (r) => r.paid))} paid, {formatCurrency(sum(part, (r) => r.owing))} still owing
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Not Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{none.length} students</div>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(sum(none, (r) => r.owing))} owing
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT: money received */}
        <Card>
          <CardHeader>
            <CardTitle>Paid, by class</CardTitle>
            <CardDescription>Money received so far. Part payers are counted here too.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Class</th>
                  <th className="pb-2 font-medium text-right">Full</th>
                  <th className="pb-2 font-medium text-right">Part</th>
                  <th className="pb-2 font-medium text-right">Amount paid</th>
                </tr>
              </thead>
              <tbody>
                {classes
                  .filter((c) => c.full + c.part > 0)
                  .map((c) => (
                    <tr key={c.className} className="border-b last:border-0">
                      <td className="py-2 font-medium">{c.className}</td>
                      <td className="py-2 text-right">{c.full}</td>
                      <td className="py-2 text-right">{c.part}</td>
                      <td className="py-2 text-right">{formatCurrency(c.paid)}</td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td className="pt-2">Grand total</td>
                  <td className="pt-2 text-right">{full.length}</td>
                  <td className="pt-2 text-right">{part.length}</td>
                  <td className="pt-2 text-right text-emerald-600">{formatCurrency(grandPaid)}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        {/* RIGHT: debtors */}
        <Card>
          <CardHeader>
            <CardTitle>Debtors, by class</CardTitle>
            <CardDescription>Students who still owe, including part payers.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {debtorClasses.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nobody owes anything. All fees are fully paid.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium text-right">Part</th>
                    <th className="pb-2 font-medium text-right">Not paid</th>
                    <th className="pb-2 font-medium text-right">Owing</th>
                  </tr>
                </thead>
                <tbody>
                  {debtorClasses.map((c) => (
                    <tr key={c.className} className="border-b last:border-0">
                      <td className="py-2 font-medium">{c.className}</td>
                      <td className="py-2 text-right">{c.part}</td>
                      <td className="py-2 text-right">{c.none}</td>
                      <td className="py-2 text-right">{formatCurrency(c.owing)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="pt-2">Total owing</td>
                    <td className="pt-2 text-right">{part.length}</td>
                    <td className="pt-2 text-right">{none.length}</td>
                    <td className="pt-2 text-right text-red-600">{formatCurrency(grandOwing)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Names of those who have paid, class by class */}
      {payerGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Who has paid</CardTitle>
            <CardDescription>
              Tap a class to see the students and how much each has paid. Part payers are included.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {payerGroups.map(([cls, list]) => (
              <details key={cls} className="rounded-md border px-3 py-2">
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
                  <span>
                    {cls} ({list.length})
                  </span>
                  <span className="text-emerald-600">{formatCurrency(sum(list, (r) => r.paid))}</span>
                </summary>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-1 font-medium">Student</th>
                      <th className="pb-1 font-medium">Status</th>
                      <th className="pb-1 font-medium text-right">Paid</th>
                      <th className="pb-1 font-medium text-right">Still owing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...list]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((r) => (
                        <tr key={r.key} className="border-b last:border-0">
                          <td className="py-1.5">{r.name}</td>
                          <td className="py-1.5">
                            <span
                              className={
                                r.state === "PAID"
                                  ? "rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                                  : "rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                              }
                            >
                              {r.state === "PAID" ? "Fully paid" : "Part paid"}
                            </span>
                          </td>
                          <td className="py-1.5 text-right font-medium">{formatCurrency(r.paid)}</td>
                          <td className="py-1.5 text-right">
                            {r.owing > 0 ? formatCurrency(r.owing) : "-"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </details>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Names of debtors, class by class */}
      {debtorGroups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Who owes what</CardTitle>
            <CardDescription>Tap a class to see the students and what each one owes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {debtorGroups.map(([cls, list]) => (
              <details key={cls} className="rounded-md border px-3 py-2">
                <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
                  <span>
                    {cls} ({list.length})
                  </span>
                  <span className="text-red-600">{formatCurrency(sum(list, (r) => r.owing))}</span>
                </summary>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-1 font-medium">Student</th>
                      <th className="pb-1 font-medium">Status</th>
                      <th className="pb-1 font-medium text-right">Paid</th>
                      <th className="pb-1 font-medium text-right">Owing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...list]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((r) => (
                        <tr key={r.key} className="border-b last:border-0">
                          <td className="py-1.5">{r.name}</td>
                          <td className="py-1.5">
                            <span
                              className={
                                r.state === "PART"
                                  ? "rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800"
                                  : "rounded bg-red-100 px-2 py-0.5 text-xs text-red-800"
                              }
                            >
                              {r.state === "PART" ? "Part paid" : "Not paid"}
                            </span>
                          </td>
                          <td className="py-1.5 text-right">{formatCurrency(r.paid)}</td>
                          <td className="py-1.5 text-right font-medium">{formatCurrency(r.owing)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </details>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
