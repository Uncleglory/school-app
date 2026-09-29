import crypto from "crypto";

export function verifySchoolQrToken(token: string) {
  const expected = process.env.SCHOOL_QR_TOKEN;

  if (!expected || !token) {
    return false;
  }

  if (token.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expected)
  );
}