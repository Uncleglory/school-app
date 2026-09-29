import QRCode from "qrcode";
import { headers } from "next/headers";

export default async function SchoolQrPage() {
  const requestHeaders = await headers();

  const host = requestHeaders.get("host");
  const protocol =
    requestHeaders.get("x-forwarded-proto") || "https";

  const signInUrl = `${protocol}://${host}/qr-signin?token=${process.env.SCHOOL_QR_TOKEN}`;

  const qrCode = await QRCode.toDataURL(signInUrl, {
    width: 500,
    margin: 2,
  });

  return (
    <main className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">
          Glory Schools
        </h1>

        <p className="mt-2 text-lg font-semibold text-slate-700">
          Staff Attendance QR Code
        </p>

        <p className="mt-2 text-sm text-slate-500">
          Staff should scan this QR code when they arrive at school.
        </p>

        <div className="mt-6 flex justify-center">
          <img
            src={qrCode}
            alt="Glory Schools staff attendance QR code"
            className="w-[320px] h-[320px]"
          />
        </div>

        <p className="mt-4 text-sm font-medium text-slate-600">
          Scan → Confirm Sign-in
        </p>
      </div>
    </main>
  );
}