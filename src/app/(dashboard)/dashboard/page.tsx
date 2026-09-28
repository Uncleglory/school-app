
import { auth } from "@/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignInCard } from "@/components/layout/sign-in-card";
import {
  Users,
  GraduationCap,
  CalendarCheck,
  Wallet,
  School,
  Bell,
} from "lucide-react";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const myStaff = userId
    ? await db.staff.findUnique({
        where: { userId },
        include: {
          attendance: { where: { date: today }, take: 1 },
        },
      })
    : null;

  const alreadySigned = myStaff?.attendance[0]?.status === "PRESENT";
  const checkInLabel = myStaff?.attendance[0]?.checkIn
    ? myStaff.attendance[0].checkIn.toLocaleTimeString("en-NG", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const [
    studentCount,
    staffCount,
    classCount,
    presentToday,
    pendingInvoices,
    unreadAlerts,
    recentStudents,
    recentStaff,
  ] = await Promise.all([
    db.student.count({ where: { status: "ACTIVE" } }),
    db.staff.count(),
    db.class.count(),
    db.studentAttendance.count({
      where: { date: today, status: "PRESENT" },
    }),
    db.invoice.count({
      where: { status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] } },
    }),
    userId
      ? db.notification.count({ where: { userId, isRead: false } })
      : 0,
    db.student.findMany({
      where: { status: "ACTIVE" },
      orderBy: { admittedAt: "desc" },
      take: 6,
      include: { class: true },
    }),
    db.staff.findMany({
      orderBy: { hireDate: "desc" },
      take: 6,
      include: { user: true },
    }),
  ]);

  const stats = [
    {
      title: "Students",
      value: studentCount,
      note: studentCount === 0 ? "None yet — add students" : "Active students",
      href: "/dashboard/students",
      icon: GraduationCap,
      color: "text-blue-600",
    },
    {
      title: "Staff",
      value: staffCount,
      note: staffCount === 0 ? "None yet — add staff" : "Teachers and staff",
      href: "/dashboard/staff",
      icon: Users,
      color: "text-emerald-600",
    },
    {
      title: "Classes",
      value: classCount,
      note: classCount === 0 ? "Add Creche → SSS 3" : "Class groups",
      href: "/dashboard/classes",
      icon: School,
      color: "text-violet-600",
    },
    {
      title: "Present today",
      value: presentToday,
      note: presentToday === 0 ? "No attendance marked today" : "Students marked present",
      href: "/dashboard/attendance",
      icon: CalendarCheck,
      color: "text-amber-600",
    },
    {
      title: "Pending fees",
      value: pendingInvoices,
      note: pendingInvoices === 0 ? "No unpaid invoices" : "Unpaid / overdue invoices",
      href: "/dashboard/fees",
      icon: Wallet,
      color: "text-rose-600",
    },
    {
      title: "Alerts",
      value: unreadAlerts,
      note: unreadAlerts === 0 ? "No new notifications" : "Unread notifications",
      href: "/dashboard/notifications",
      icon: Bell,
      color: "text-orange-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {session?.user?.name?.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          Live numbers from your school records.
        </p>
      </div>

      {myStaff && (
        <SignInCard alreadySigned={alreadySigned} checkInLabel={checkInLabel} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.note}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent students</CardTitle>
            <Link href="/dashboard/students" className="text-sm text-primary">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No students yet. Open Students and add a pupil.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentStudents.map((s) => (
                  <li key={s.id} className="flex justify-between border-b last:border-0 pb-2">
                    <span className="font-medium">
                      {s.lastName} {s.firstName}
                    </span>
                    <span className="text-muted-foreground">
                      {s.class?.name || "No class"} · {s.admissionNo}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent staff</CardTitle>
            <Link href="/dashboard/staff" className="text-sm text-primary">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {recentStaff.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No staff yet. Open Staff and add a teacher.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentStaff.map((s) => (
                  <li key={s.id} className="flex justify-between border-b last:border-0 pb-2">
                    <span className="font-medium">
                      {s.user.lastName} {s.user.firstName}
                    </span>
                    <span className="text-muted-foreground capitalize">
                      {s.user.role.toLowerCase()} · {s.user.email}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
