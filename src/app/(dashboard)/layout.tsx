import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getSchoolSettings } from "@/server/actions/settings";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const settings = await getSchoolSettings();

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={session.user.role} schoolName={settings.name} />
      <div className="flex flex-1 flex-col min-w-0">
        <Header user={session.user} schoolName={settings.name} />
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
