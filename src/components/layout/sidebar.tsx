"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { Role } from "@prisma/client";

interface SidebarProps {
  role: Role;
  schoolName?: string;
}

export function Sidebar({ role, schoolName = "Glory Schools" }: SidebarProps) {
  const pathname = usePathname();
  const filteredItems = navItems.filter((item) => item.roles.includes(role));
  const brand = schoolName.split(" ")[0] || "GS";
  const initials = brand.slice(0, 2).toUpperCase();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-navy text-ivory">
      <div className="flex h-[4.5rem] items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gold font-display text-lg font-bold text-navy">
          {initials}
        </div>
        <div className="min-w-0 leading-tight">
          <p className="font-display text-lg font-semibold truncate">{schoolName}</p>
          <p className="text-[10px] tracking-[0.18em] uppercase text-gold-soft">360</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {filteredItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-gold text-navy shadow-sm"
                  : "text-ivory/75 hover:bg-white/10 hover:text-ivory"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
