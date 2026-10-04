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
    icon: <Al
