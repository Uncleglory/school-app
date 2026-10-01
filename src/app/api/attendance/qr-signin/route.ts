import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { verifySchoolQrToken } from "@/lib/school-qr";
import { sendTelegramMessage } from "@/lib/telegram";
import { revalidatePath } from "next/cache";

const QR_NOTE = "QR verified";

// ─── SCHOOL LOCATION (Glory Schools) ───
const SCHOOL_LATITUDE = 8.01896;
const SCHOOL_LONGITUDE = 4.66679;

// How far from the school (in metres) a phone may be and still sign in
const ALLOWED_RADIUS_METERS = 150;

// If the phone's GPS is less accurate than this (in metres), ask to retry
const MAX_GPS_ACCURACY_METERS = 300;

// Distance between two GPS points in metres (Haversine formula)
function distanceInMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

async function notifyAdmins(
  staffName: string,
  timeLabel: string,
  status: string,
  title: string,
  action: string
) {
  // App notifications for all active administrators
  const admins = await db.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true },
  });

  for (const admin of admins) {
    await db.notification.create({
      data: {
        userId: admin.id,
        type: "GENERAL",
        title,
        message: `${staffName} ${action} at ${timeLabel} (${status}) via school QR.`,
        link: "/dashboard/attendance?tab=staff",
      },
    });
  }

  // Telegram notification (a Telegram failure must not break sign-in)
  try {
    await sendTelegramMessage(
      `✅ <b>${title}</b>\n${staffName} ${action} at ${timeLabel} (${status}) via school QR.`
    );
  } catch (err) {
    console.error("Telegram notification failed:", err);
  }
}

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

    // ─── LOCATION CHECK ───
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    const accuracy = Number(body?.accuracy);

    if (
      body?.latitude === undefined ||
      body?.longitude === undefined ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return NextResponse.json(
        {
          error:
            "Your location is required. Please allow location access and try again.",
        },
        { status: 400 }
      );
    }

    if (Number.isFinite(accuracy) && accuracy > MAX_GPS_ACCURACY_METERS) {
      return NextResponse.json(
        {
          error:
            "Your location is not accurate enough. Turn on GPS, move to an open area, and try again.",
        },
        { status: 400 }
      );
    }

    const distance = distanceInMeters(
      latitude,
      longitude,
      SCHOOL_LATITUDE,
      SCHOOL_LONGITUDE
    );

    if (distance > ALLOWED_RADIUS_METERS) {
      return NextResponse.json(
        {
          error:
            "You are not at school. You must be at school to sign in with the QR code.",
        },
        { status: 403 }
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
    const currentMinutes = hour * 60 + minute;

    const staffName =
      `${staff.user?.firstName || ""} ${staff.user?.lastName || ""}`.trim();

    const timeLabel = new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(now);

    const existing = await db.staffAttendance.findUnique({
      where: {
        staffId_date: {
          staffId: staff.id,
          date: today,
        },
      },
    });

    // CASE 1: Already has attendance today
    if (existing) {
      // Already confirmed by QR earlier: no repeat notification
      if (existing.note === QR_NOTE) {
        return NextResponse.json(
          { error: "You have already signed in today." },
          { status: 400 }
        );
      }

      // Signed in another way earlier: mark it as QR-verified
      // and send the notifications now
      await db.staffAttendance.update({
        where: { id: existing.id },
        data: { note: QR_NOTE },
      });

      await notifyAdmins(
        staffName,
        timeLabel,
        existing.status,
        "Staff QR Verified",
        "confirmed attendance"
      );

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/attendance");

      return NextResponse.json({
        success: true,
        status: existing.status,
        verified: true,
      });
    }

    // CASE 2: First sign-in of the day through the QR

    // Sign-in closes at 3:00 PM
    if (currentMinutes >= 15 * 60) {
      return NextResponse.json(
        {
          error:
            "Sign-in is closed for today. School sign-in closes at 3:00 PM.",
        },
        { status: 400 }
      );
    }

    // 7:45 AM or earlier = PRESENT, after that = LATE
    const status = currentMinutes <= 7 * 60 + 45 ? "PRESENT" : "LATE";

    await db.staffAttendance.create({
      data: {
        staffId: staff.id,
        date: today,
        status,
        checkIn: now,
        note: QR_NOTE,
      },
    });

    await notifyAdmins(
      staffName,
      timeLabel,
      status,
      "Staff Sign-in",
      "signed in"
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
