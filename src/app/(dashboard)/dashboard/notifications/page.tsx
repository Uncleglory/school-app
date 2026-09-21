import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMyNotifications } from "@/server/actions/notifications";
import { NotificationsClient } from "@/components/attendance/notifications-client";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await getMyNotifications();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">
          Alerts about absences, fees, library and more.
        </p>
      </div>

      <NotificationsClient notifications={notifications} />
    </div>
  );
}
