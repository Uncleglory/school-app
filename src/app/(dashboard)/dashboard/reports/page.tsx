import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getFeeCollectionReport } from "@/server/actions/reports";
import { getExams } from "@/server/actions/exams";
import { getFeeStats } from "@/server/actions/fees";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [feeReport, feeStats, exams] = await Promise.all([
    getFeeCollectionReport(),
    getFeeStats(),
    getExams(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          Overview of fees, attendance and academic performance.
        </p>
      </div>

      {/* Fee Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total Invoiced</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(feeStats.totalInvoiced)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Collected</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-emerald-600">{formatCurrency(feeStats.totalPaid)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {formatCurrency(feeStats.totalInvoiced - feeStats.totalPaid)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Unpaid / Overdue</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feeStats.unpaidCount} / {feeStats.overdueCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Fee by status */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Collection by Status</CardTitle>
        </CardHeader>
        <CardContent>
          {feeReport.byStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoice data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Count</th>
                  <th className="pb-2 font-medium">Total Amount</th>
                  <th className="pb-2 font-medium">Amount Paid</th>
                </tr>
              </thead>
              <tbody>
                {feeReport.byStatus.map((row) => (
                  <tr key={row.status} className="border-b last:border-0">
                    <td className="py-2 font-medium">{row.status.replace("_", " ")}</td>
                    <td className="py-2">{row._count}</td>
                    <td className="py-2">{formatCurrency(Number(row._sum.amount || 0))}</td>
                    <td className="py-2">{formatCurrency(Number(row._sum.amountPaid || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Recent payments */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
          <CardDescription>Last 10 payments received</CardDescription>
        </CardHeader>
        <CardContent>
          {feeReport.recentPayments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Receipt</th>
                  <th className="pb-2 font-medium">Student</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Method</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {feeReport.recentPayments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{p.receiptNo}</td>
                    <td className="py-2">
                      {p.invoice.student.firstName} {p.invoice.student.lastName}
                    </td>
                    <td className="py-2 font-medium">{formatCurrency(Number(p.amount))}</td>
                    <td className="py-2">{p.method.replace("_", " ")}</td>
                    <td className="py-2">{formatDate(p.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Exams summary */}
      <Card>
        <CardHeader>
          <CardTitle>Exams Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {exams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No exams created yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Exam</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Results Entered</th>
                  <th className="pb-2 font-medium">Published</th>
                </tr>
              </thead>
              <tbody>
                {exams.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{e.name}</td>
                    <td className="py-2">{e.type.replace(/_/g, " ")}</td>
                    <td className="py-2">{e._count.results}</td>
                    <td className="py-2">{e.isPublished ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
