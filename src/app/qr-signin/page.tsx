"use client";

import { useState } from "react";

export default function QrSignInPage() {
  const [message, setMessage] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleSignIn() {
    setIsSigningIn(true);
    setMessage("");

    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token") || "";

      if (!token) {
        setMessage("Invalid school QR code.");
        return;
      }

      const response = await fetch("/api/attendance/qr-signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not sign in.");
        return;
      }

      setMessage(
        data.status === "PRESENT"
          ? "Attendance recorded successfully. You are PRESENT."
          : "Attendance recorded successfully. You are LATE."
      );
    } catch {
      setMessage("Something went wrong. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-md">
        <h1 className="text-2xl font-bold text-slate-900">
          Staff Attendance
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          You have scanned the school attendance QR code.
        </p>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="mt-6 w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {isSigningIn ? "Signing in..." : "Confirm Staff Sign-in"}
        </button>

        {message && (
          <p className="mt-4 text-center text-sm font-medium text-slate-700">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}