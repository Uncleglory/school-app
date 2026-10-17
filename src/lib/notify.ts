/**
 * Notification delivery layer
 * - Email: Resend (works on Vercel)
 * - SMS: Africa's Talking or Twilio (optional – enable via env)
 *
 * In-app Notification records are always created by the calling actions.
 * This module only handles external delivery (email / SMS).
 */

import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL =
  process.env.EMAIL_FROM || "School App <onboarding@resend.dev>";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || "http://localhost:3000";

// ─────────────────────────────────────────────
// EMAIL
// ─────────────────────────────────────────────

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  if (!resend) {
    console.log("[email skipped – no RESEND_API_KEY]", opts.to, opts.subject);
    return { ok: false, skipped: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });

    if (error) {
      console.error("[email error]", error);
      return { ok: false, error };
    }
    return { ok: true, id: data?.id };
  } catch (err) {
    console.error("[email exception]", err);
    return { ok: false, error: err };
  }
}

// ─────────────────────────────────────────────
// SMS (Africa's Talking – popular in Africa)
// Set AT_API_KEY + AT_USERNAME to enable
// ─────────────────────────────────────────────

export async function sendSms(opts: { to: string; message: string }) {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  if (!apiKey || !username) {
    console.log("[sms skipped – no AT_API_KEY/AT_USERNAME]", opts.to);
    return { ok: false, skipped: true };
  }

  // Normalize phone to international format if needed
  let phone = opts.to.replace(/\s+/g, "");
  if (phone.startsWith("0")) phone = "234" + phone.slice(1); // Nigeria example
  if (!phone.startsWith("+")) phone = "+" + phone;

  try {
    const res = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        apiKey,
      },
      body: new URLSearchParams({
        username,
        to: phone,
        message: opts.message,
        ...(process.env.AT_SENDER_ID ? { from: process.env.AT_SENDER_ID } : {}),
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error("[sms error]", data);
      return { ok: false, error: data };
    }
    return { ok: true, data };
  } catch (err) {
    console.error("[sms exception]", err);
    return { ok: false, error: err };
  }
}

// ─────────────────────────────────────────────
// Nigerian phone numbers + bulk SMS
// ─────────────────────────────────────────────

/**
 * Turns 0806 302 1584, 08063021584, 2348063021584 or +2348063021584 into
 * +2348063021584. Returns null when it is not a valid Nigerian mobile number.
 */
export function normalizeNgPhone(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0")) d = "234" + d.slice(1);
  return /^234(70|80|81|90|91)\d{8}$/.test(d) ? "+" + d : null;
}

/**
 * Sends one message to many numbers (Africa's Talking accepts up to 1000 per
 * request; we use batches of 100). If AT_SENDER_ID is set (after the sender ID is
 * approved) it is used as the sender name.
 */
export async function sendBulkSms(opts: { numbers: string[]; message: string }) {
  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;
  if (!apiKey || !username) {
    return { ok: false as const, skipped: true, sent: 0, failed: opts.numbers.length, errors: ["SMS is not set up (AT_API_KEY / AT_USERNAME missing)."] };
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < opts.numbers.length; i += 100) {
    const batch = opts.numbers.slice(i, i + 100);
    const body = new URLSearchParams({ username, to: batch.join(","), message: opts.message });
    if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);

    try {
      const res = await fetch("https://api.africastalking.com/version1/messaging", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", apiKey },
        body,
      });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch { /* not JSON */ }

      if (!res.ok || !data?.SMSMessageData) {
        failed += batch.length;
        errors.push(`Batch ${i / 100 + 1}: ${data?.SMSMessageData?.Message || text.slice(0, 120) || res.status}`);
        continue;
      }
      const recipients: any[] = data.SMSMessageData.Recipients || [];
      const ok = recipients.filter((r) => r.status === "Success" || r.statusCode === 100 || r.statusCode === 101 || r.statusCode === 102).length;
      sent += ok;
      failed += batch.length - ok;
      const firstBad = recipients.find((r) => !(r.status === "Success" || [100, 101, 102].includes(r.statusCode)));
      if (firstBad) errors.push(`Some numbers were refused (for example: ${firstBad.status || firstBad.statusCode}).`);
    } catch (err: any) {
      failed += batch.length;
      errors.push(`Batch ${i / 100 + 1}: ${err?.message || "network error"}`);
    }
  }

  return { ok: sent > 0, skipped: false, sent, failed, errors: Array.from(new Set(errors)) };
}

// ─────────────────────────────────────────────
// HIGH-LEVEL HELPERS used by attendance / fees
// ─────────────────────────────────────────────

export async function notifyAbsence(opts: {
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  studentName: string;
  status: string; // absent | late
  date: string;
  note?: string;
  // true = message goes to a parent's phone/email saved on the student record.
  // Those parents have no login, so the message has no dashboard link.
  forParent?: boolean;
}) {
  if (opts.forParent) {
    const school = process.env.SCHOOL_NAME || "Glory Schools";
    const text = `${school}: ${opts.studentName} was marked ${opts.status} on ${opts.date}.${opts.note ? ` Note: ${opts.note}.` : ""} Please contact the school if this is unexpected.`;
    const html = `
      <div style="font-family:sans-serif;max-width:480px">
        <h2 style="color:#1e293b">${school}</h2>
        <p><strong>${opts.studentName}</strong> was marked <strong style="color:#dc2626">${opts.status}</strong> on ${opts.date}.</p>
        ${opts.note ? `<p>Note: ${opts.note}</p>` : ""}
        <p>Please contact the school if this is unexpected.</p>
      </div>
    `;
    const sent = [];
    if (opts.recipientEmail) {
      sent.push(
        await sendEmail({
          to: opts.recipientEmail,
          subject: `${school}: ${opts.studentName} marked ${opts.status}`,
          html,
          text,
        })
      );
    }
    if (opts.recipientPhone) {
      sent.push(await sendSms({ to: opts.recipientPhone, message: text }));
    }
    return sent;
  }

  const subject = `Attendance alert: ${opts.studentName} marked ${opts.status}`;
  const text = `${opts.studentName} was marked ${opts.status} on ${opts.date}.${opts.note ? ` Note: ${opts.note}` : ""}\n\nView details: ${APP_URL}/dashboard/attendance`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px">
      <h2 style="color:#1e293b">Attendance Alert</h2>
      <p><strong>${opts.studentName}</strong> was marked <strong style="color:#dc2626">${opts.status}</strong> on ${opts.date}.</p>
      ${opts.note ? `<p>Note: ${opts.note}</p>` : ""}
      <p><a href="${APP_URL}/dashboard/attendance">Open attendance</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#64748b;font-size:12px">This is an automated message from your school management system.</p>
    </div>
  `;

  const results = [];
  if (opts.recipientEmail) {
    results.push(await sendEmail({ to: opts.recipientEmail, subject, html, text }));
  }
  if (opts.recipientPhone) {
    results.push(
      await sendSms({
        to: opts.recipientPhone,
        message: `${opts.studentName} marked ${opts.status} on ${opts.date}. ${APP_URL}/dashboard/attendance`,
      })
    );
  }
  return results;
}

export async function notifyPayment(opts: {
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  studentName: string;
  amount: string;
  receiptNo: string;
  balance: string;
}) {
  const subject = `Payment received — ${opts.receiptNo}`;
  const text = `Payment of ${opts.amount} received for ${opts.studentName}. Receipt: ${opts.receiptNo}. Balance: ${opts.balance}.\n\n${APP_URL}/dashboard/fees`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px">
      <h2 style="color:#1e293b">Payment Received</h2>
      <p>A payment of <strong>${opts.amount}</strong> was recorded for <strong>${opts.studentName}</strong>.</p>
      <p>Receipt No: <code>${opts.receiptNo}</code></p>
      <p>Outstanding balance: <strong>${opts.balance}</strong></p>
      <p><a href="${APP_URL}/dashboard/fees">View fees</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#64748b;font-size:12px">This is an automated message from your school management system.</p>
    </div>
  `;

  const results = [];
  if (opts.recipientEmail) {
    results.push(await sendEmail({ to: opts.recipientEmail, subject, html, text }));
  }
  if (opts.recipientPhone) {
    results.push(
      await sendSms({
        to: opts.recipientPhone,
        message: `Payment of ${opts.amount} received for ${opts.studentName}. Receipt ${opts.receiptNo}. Balance: ${opts.balance}`,
      })
    );
  }
  return results;
}

export async function notifyStaffAbsence(opts: {
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  staffName: string;
  status: string;
  date: string;
}) {
  const subject = `Staff alert: ${opts.staffName} marked ${opts.status}`;
  const text = `${opts.staffName} was marked ${opts.status} on ${opts.date}.`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px">
      <h2 style="color:#1e293b">Staff Attendance Alert</h2>
      <p><strong>${opts.staffName}</strong> was marked <strong>${opts.status}</strong> on ${opts.date}.</p>
      <p><a href="${APP_URL}/dashboard/attendance?tab=staff">Open attendance</a></p>
    </div>
  `;

  if (opts.recipientEmail) {
    await sendEmail({ to: opts.recipientEmail, subject, html, text });
  }
  if (opts.recipientPhone) {
    await sendSms({
      to: opts.recipientPhone,
      message: `Staff ${opts.staffName} marked ${opts.status} on ${opts.date}`,
    });
  }
}
