import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getSchoolSettings } from "@/server/actions/settings";
import { SettingsClient } from "@/components/settings/settings-client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/dashboard");

  const settings = await getSchoolSettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">School Settings</h1>
        <p className="text-muted-foreground">
          Brand your receipts, report cards and system with school details.
        </p>
      </div>
      <SettingsClient settings={JSON.parse(JSON.stringify(settings))} />
    </div>
  );
}
