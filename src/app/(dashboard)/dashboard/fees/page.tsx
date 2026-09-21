import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getFeeStructures,
  getInvoices,
  getFeeStats,
  getAcademicYears,
  getTerms,
} from "@/server/actions/fees";
import { getClasses } from "@/server/actions/attendance";
import { FeesClient } from "@/components/fees/fees-client";

export default async function FeesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [structures, invoices, stats, years, terms, classes] = await Promise.all([
    getFeeStructures(),
    getInvoices(),
    getFeeStats(),
    getAcademicYears(),
    getTerms(),
    getClasses(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fees & Payments</h1>
        <p className="text-muted-foreground">
          Manage fee structures, generate invoices, record payments and receipts.
        </p>
      </div>

      <FeesClient
        structures={JSON.parse(JSON.stringify(structures))}
        invoices={JSON.parse(JSON.stringify(invoices))}
        stats={stats}
        years={JSON.parse(JSON.stringify(years))}
        terms={JSON.parse(JSON.stringify(terms))}
        classes={classes}
        userRole={session.user.role}
      />
    </div>
  );
}
