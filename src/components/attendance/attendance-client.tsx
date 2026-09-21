"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { markStudentAttendance, markStaffAttendance } from "@/server/actions/attendance";
import { AttendanceStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Check, X, Clock, AlertCircle, Users, UserSquare2 } from "lucide-react";

type StudentRow = {
  id: string;
  admissionNo: string;
  name: string;
  className: string;
  classId: string | null;
  currentStatus: AttendanceStatus | null;
  note: string | null;
};

type StaffRow = {
  id: string;
  staffNo: string;
  name: string;
  position: string;
  department: string | null;
  currentStatus: AttendanceStatus | null;
  checkIn: Date | null;
  checkOut: Date | null;
  note: string | null;
};

interface Props {
  tab: "students" | "staff";
  date: string;
  classId?: string;
  classes: { id: string; name: string }[];
  students: StudentRow[];
  staff: StaffRow[];
  userRole: string;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PRESENT: {
    label: "Present",
    color: "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200",
    icon: <Check className="h-3.5 w-3.5" />,
  },
  ABSENT: {
    label: "Absent",
    color: "bg-red-100 text-red-800 border-red-200 hover:bg-red-200",
    icon: <X className="h-3.5 w-3.5" />,
  },
  LATE: {
    label: "Late",
    color: "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  EXCUSED: {
    label: "Excused",
    color: "bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  HALF_DAY: {
    label: "Half Day",
    color: "bg-purple-100 text-purple-800 border-purple-200 hover:bg-purple-200",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
};

export function AttendanceClient({
  tab,
  date,
  classId,
  classes,
  students,
  staff,
  userRole,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function updateParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") params.delete(key);
      else params.set(key, value);
    });
    router.push(`/dashboard/attendance?${params.toString()}`);
  }

  async function handleStudentStatus(studentId: string, status: AttendanceStatus) {
    setLoadingId(studentId);
    startTransition(async () => {
      try {
        await markStudentAttendance({ studentId, date, status });
      } catch (err) {
        console.error(err);
        alert("Failed to mark attendance");
      } finally {
        setLoadingId(null);
      }
    });
  }

  async function handleStaffStatus(staffId: string, status: AttendanceStatus) {
    setLoadingId(staffId);
    startTransition(async () => {
      try {
        await markStaffAttendance({ staffId, date, status });
      } catch (err) {
        console.error(err);
        alert("Failed to mark attendance");
      } finally {
        setLoadingId(null);
      }
    });
  }

  const canMarkStudents = ["ADMIN", "TEACHER"].includes(userRole);
  const canMarkStaff = userRole === "ADMIN";

  return (
    <div className="space-y-4">
      {/* Tabs + Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Button
            variant={tab === "students" ? "default" : "outline"}
            size="sm"
            onClick={() => updateParams({ tab: "students" })}
          >
            <Users className="h-4 w-4 mr-1.5" />
            Students
          </Button>
          <Button
            variant={tab === "staff" ? "default" : "outline"}
            size="sm"
            onClick={() => updateParams({ tab: "staff" })}
          >
            <UserSquare2 className="h-4 w-4 mr-1.5" />
            Staff
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => updateParams({ date: e.target.value })}
            className="w-auto"
          />

          {tab === "students" && (
            <select
              value={classId || ""}
              onChange={(e) => updateParams({ classId: e.target.value || undefined })}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Students Table */}
      {tab === "students" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Student Attendance — {date}
              {classId && classes.find((c) => c.id === classId)
                ? ` · ${classes.find((c) => c.id === classId)?.name}`
                : ""}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No students found. Seed sample data or create students first.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Adm No</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Class</th>
                      <th className="pb-3 font-medium">Status</th>
                      {canMarkStudents && <th className="pb-3 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-3 font-mono text-xs">{s.admissionNo}</td>
                        <td className="py-3 font-medium">{s.name}</td>
                        <td className="py-3 text-muted-foreground">{s.className}</td>
                        <td className="py-3">
                          {s.currentStatus ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                STATUS_CONFIG[s.currentStatus].color
                              )}
                            >
                              {STATUS_CONFIG[s.currentStatus].icon}
                              {STATUS_CONFIG[s.currentStatus].label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Not marked</span>
                          )}
                        </td>
                        {canMarkStudents && (
                          <td className="py-3">
                            <div className="flex justify-end gap-1">
                              {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttendanceStatus[]).map(
                                (status) => (
                                  <Button
                                    key={status}
                                    size="sm"
                                    variant="outline"
                                    disabled={isPending || loadingId === s.id}
                                    className={cn(
                                      "h-7 px-2 text-xs",
                                      s.currentStatus === status && STATUS_CONFIG[status].color
                                    )}
                                    onClick={() => handleStudentStatus(s.id, status)}
                                  >
                                    {STATUS_CONFIG[status].label}
                                  </Button>
                                )
                              )}
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
      )}

      {/* Staff Table */}
      {tab === "staff" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Staff Attendance — {date}</CardTitle>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No staff found. Seed sample data or create staff first.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-3 font-medium">Staff No</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Position</th>
                      <th className="pb-3 font-medium">Status</th>
                      {canMarkStaff && <th className="pb-3 font-medium text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40">
                        <td className="py-3 font-mono text-xs">{s.staffNo}</td>
                        <td className="py-3 font-medium">{s.name}</td>
                        <td className="py-3 text-muted-foreground">{s.position}</td>
                        <td className="py-3">
                          {s.currentStatus ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                                STATUS_CONFIG[s.currentStatus].color
                              )}
                            >
                              {STATUS_CONFIG[s.currentStatus].icon}
                              {STATUS_CONFIG[s.currentStatus].label}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">Not marked</span>
                          )}
                        </td>
                        {canMarkStaff && (
                          <td className="py-3">
                            <div className="flex justify-end gap-1">
                              {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttendanceStatus[]).map(
                                (status) => (
                                  <Button
                                    key={status}
                                    size="sm"
                                    variant="outline"
                                    disabled={isPending || loadingId === s.id}
                                    className={cn(
                                      "h-7 px-2 text-xs",
                                      s.currentStatus === status && STATUS_CONFIG[status].color
                                    )}
                                    onClick={() => handleStaffStatus(s.id, status)}
                                  >
                                    {STATUS_CONFIG[status].label}
                                  </Button>
                                )
                              )}
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
      )}

      {/* Info box */}
      <Card className="bg-blue-50/50 border-blue-100">
        <CardContent className="pt-4 text-sm text-blue-900">
          <p className="font-medium mb-1">How alerts work</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-800/80">
            <li>Marking a student <strong>Absent</strong> or <strong>Late</strong> instantly creates notifications for all Admins and the student’s parents.</li>
            <li>Marking a staff member <strong>Absent</strong> or <strong>Late</strong> alerts all Admins.</li>
            <li>You can change the status later — the latest mark is kept.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
