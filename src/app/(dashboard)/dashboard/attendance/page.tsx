import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getClasses, getStudentsForAttendance, getStaffForAttendance } from "@/server/actions/attendance";
import { AttendanceClient } from "@/components/attendance/attendance-client";

interface PageProps {
  searchParams: Promise<{ tab?: string; date?: string; classId?: string }>;
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const tab = params.tab === "staff" ? "staff" : "students";
  const date = params.date || new Date().toISOString().split("T")[0];
  const classId = params.classId || undefined;

  const [classes, students, staff] = await Promise.all([
    getClasses(),
    tab === "students" ? getStudentsForAttendance(classId, date) : Promise.resolve([]),
    tab === "staff" ? getStaffForAttendance(date) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">
          Mark daily attendance. Absences automatically alert Admin and Parents.
        </p>
      </div>

      <AttendanceClient
        tab={tab}
        date={date}
        classId={classId}
        classes={classes}
        students={students}
        staff={staff}
        userRole={session.user.role}
      />
    </div>
  );
}
