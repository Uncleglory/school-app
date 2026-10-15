import {
  LayoutDashboard,
  Users,
  GraduationCap,
  UserSquare2,
  CalendarCheck,
  Wallet,
  Book,
  BookOpen,
  Settings,
  Bell,
  ClipboardList,
  BarChart3,
  School,
  KeyRound,
  BookMarked,
  Library,
  Trophy,
} from "lucide-react";
import { Role } from "@prisma/client";

export type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
};

// Students and parents only see Materials and Notifications for now.
// The pages that show school-wide data (Fees, Attendance, Exams, Library)
// are staff-only until they are changed to show one child's records.
export const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "MANAGER", "TEACHER", "LIBRARIAN", "ACCOUNTANT", "STAFF"],
  },
  {
    title: "Users",
    href: "/dashboard/users",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    title: "Student Logins",
    href: "/dashboard/student-logins",
    icon: KeyRound,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    title: "Classes",
    href: "/dashboard/classes",
    icon: School,
    roles: ["ADMIN", "MANAGER"],
  },
    {
    title: "Subjects",
    href: "/dashboard/subjects",
    icon: BookMarked,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    title: "Students",
    href: "/dashboard/students",
    icon: GraduationCap,
    roles: ["ADMIN", "MANAGER", "TEACHER"],
  },
  {
    title: "Staff",
    href: "/dashboard/staff",
    icon: UserSquare2,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    title: "Attendance",
    href: "/dashboard/attendance",
    icon: CalendarCheck,
    roles: ["ADMIN", "MANAGER", "TEACHER"],
  },
  {
    title: "Fees",
    href: "/dashboard/fees",
    icon: Wallet,
    roles: ["ADMIN", "ACCOUNTANT"],
  },
  {
    title: "Exams",
    href: "/dashboard/exams",
    icon: ClipboardList,
    roles: ["ADMIN", "MANAGER", "TEACHER"],
  },
  {
    title: "Results",
    href: "/dashboard/results",
    icon: Trophy,
    roles: ["ADMIN", "MANAGER", "TEACHER"],
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    title: "Library",
    href: "/dashboard/library",
    icon: Book,
    roles: ["ADMIN", "MANAGER", "LIBRARIAN", "TEACHER"],
  },
  {
    title: "Learning Library",
    href: "/dashboard/learning-library",
    icon: Library,
    roles: ["ADMIN", "MANAGER", "TEACHER", "STUDENT"],
  },
  {
    title: "Materials",
    href: "/dashboard/materials",
    icon: BookOpen,
    roles: ["ADMIN", "MANAGER", "TEACHER", "STUDENT", "PARENT"],
  },
  {
    title: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    roles: ["ADMIN", "MANAGER", "TEACHER", "STUDENT", "PARENT", "LIBRARIAN", "ACCOUNTANT", "STAFF"],
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["ADMIN"],
  },
];
