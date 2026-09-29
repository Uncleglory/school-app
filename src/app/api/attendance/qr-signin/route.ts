import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { verifySchoolQrToken } from "@/lib/school-qr";
import { sendTelegramMessage } from "@/lib/telegram";
import { revalidatePath } from "next/cache";

export async function POST(req: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token : "";

    if (!verifySchoolQrToken(token)) {
      return NextResponse.json(
        { error: "Invalid QR code" },
        { status: 403 }
      );
    }

    const staff = await db.staff.findUnique({
      where: { userId: session.user.id },
      include: { user: true },
    });

    if (!staff) {
      return NextResponse.json(
        { error: "Staff record not found" },
        { status: 404 }
      );
    }

    // Nigeria time
    const now = new Date();

    const nigeriaTime = new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const getPart = (type: string) =>
      nigeriaTime.find((part) => part.type === type)?.value || "";

    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const hour = Number(getPart("hour"));
    const minute = Number(getPart("minute"));

    const today = new Date(`${year}-${month}-${day}T00:00:00`);

    // Sign-in closes at 3:00 PM
    const currentMinutes = hour * 60 + minute;

    if (currentMinutes >= 15 * 60) {
      return NextResponse.json(
        {
          error:
            "Sign-in is closed for today. School sign-in closes at 3:00 PM.",
        },
        { status: 400 }
      );
    }

    const existing = await db.staffAttendance.findUnique({
      where: {
        staffId_date: {
          staffId: staff.id,
          date: today,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already signed in today." },
        { status: 400 }
      );
    }

    // 7:45 AM or earlier = PRESENT
    // After 7:45 AM = LATE
    const status =
      currentMinutes <= 7 * 60 + 45 ? "PRESENT" : "LATE";

    await db.staffAttendance.create({
      data: {
        staffId: staff.id,
        date: today,
        status,
        checkIn: now,
      },
    });

    const staffName =
      `${staff.user?.firstName || ""} ${staff.user?.lastName || ""}`.trim();

    const timeLabel = new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(now);

    // Notify all active administrators
    const admins = await db.user.findMany({
      where: {
        role: "ADMIN",
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    for (const admin of admins) {
      await db.notification.create({
        data: {
          userId: admin.id,
          type: "GENERAL",
          title: "Staff Sign-in",
          message: `${staffName} signed in at ${timeLabel} (${status}) via school QR.`,
          link: "/dashboard/attendance?tab=staff",
        },
      });
    }

    // Telegram notification
    await sendTelegramMessage(
      `✅ <b>Staff Sign-in</b>\n${staffName} signed in at ${timeLabel} (${status}) via school QR.`
    );

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/attendance");

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error("QR staff sign-in error:", error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}