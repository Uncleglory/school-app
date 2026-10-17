import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getMessagingOverview } from "@/server/actions/messaging";
import { MessagesClient } from "@/components/messages/messages-client";
import { AbsenteesPanel } from "@/components/messages/absentees-panel";

export const maxDuration = 60; // sending to hundreds of parents takes a little while

export default async function MessagesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!["ADMIN", "MANAGER"].includes(session.user.role)) redirect("/dashboard");

  const classes = await getMessagingOverview();
  const smsReady = !!(process.env.AT_API_KEY && process.env.AT_USERNAME);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Message Parents</h1>
        <p className="text-muted-foreground">
          Send one SMS to the parents of one class, several classes, or the whole school.
        </p>
      </div>
      <AbsenteesPanel smsReady={smsReady} />
      <MessagesClient classes={classes} smsReady={smsReady} />
    </div>
  );
}
