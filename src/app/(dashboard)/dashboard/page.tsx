import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  GraduationCap,
  CalendarCheck,
  Wallet,
  Book,
  Bell,
} from "lucide-react";

const stats = [
  { title: "Total Students", value: "—", icon: GraduationCap, color: "text-blue-600" },
  { title: "Total Staff", value: "—", icon: Users, color: "text-emerald-600" },
  { title: "Today's Attendance", value: "—", icon: CalendarCheck, color: "text-amber-600" },
  { title: "Pending Fees", value: "—", icon: Wallet, color: "text-rose-600" },
  { title: "Library Loans", value: "—", icon: Book, color: "text-indigo-600" },
  { title: "Unread Alerts", value: "—", icon: Bell, color: "text-orange-600" },
];

export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          Here’s what’s happening in your school today.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Data will appear after seeding
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>
            Core modules are live. Use the sidebar to navigate.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>✅ Authentication & role-based access</p>
          <p>✅ Students & Staff management</p>
          <p>✅ Attendance + automatic alerts</p>
          <p>✅ Fees, invoices, payments & receipts</p>
          <p>✅ Exams, results & reports</p>
          <p>✅ Library (books & loans)</p>
          <p>✅ Teaching materials</p>
          <p>✅ Printable receipts & report cards</p>
        </CardContent>
      </Card>
    </div>
  );
}
