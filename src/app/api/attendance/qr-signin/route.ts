"use client";

import { useState } from "react";

type Coords = {
  latitude: number;
  longitude: number;
  accuracy: number;
};

function getLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("NO_GEOLOCATION"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("PERMISSION_DENIED"));
        } else if (error.code === error.TIMEOUT) {
          reject(new Error("TIMEOUT"));
        } else {
          reject(new Error("POSITION_UNAVAILABLE"));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  });
}

export default function QrSignInPage() {
  const [message, setMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function handleSignIn() {
    setIsSigningIn(true);
    setMessage("");
    setIsSuccess(false);

    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token") || "";

      if (!token || token === "undefined") {
        setMessage("Invalid school QR code.");
        return;
      }

      // Ask the phone for its location
      setMessage("Checking your location...");

      let coords: Coords;

      try {
        coords = await getLocation();
      } catch (err) {
        const code = err instanceof Error ? err.message : "";

        if (code === "PERMISSION_DENIED") {
          setMessage(
            "Location is blocked. Please allow location for this website in your browser settings, then try again."
          );
        } else if (code === "TIMEOUT") {
          setMessage(
            "Could not get your location in time. Move to an open area and try again."
          );
        } else if (code === "NO_GEOLOCATION") {
          setMessage("This browser cannot share location. Please use Chrome.");
        } else {
          setMessage(
            "Could not find your location. Turn on your phone's location (GPS) and try again."
          );
        }
        return;
      }

      setMessage("Signing you in...");

      const response = await fetch("/api/attendance/qr-signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "Could not sign in.");
        return;
      }

      setIsSuccess(true);

      if (data.verified) {
        setMessage(
          `Your attendance has been confirmed at school. Status: ${data.status}.`
        );
      } else {
        setMessage(
          data.status === "PRESENT"
            ? "Attendance recorded successfully. You are PRESENT."
            : "Attendance recorded successfully. You are LATE."
        );
      }
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
          You have scanned the school attendance QR code. When you tap the
          button, your phone will ask to share your location. Please tap
          Allow.
        </p>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="mt-6 w-full rounded-lg bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {isSigningIn ? "Please wait..." : "Confirm Staff Sign-in"}
        </button>

        {message && (
          <p
            className={`mt-4 text-center text-sm font-medium ${
              isSuccess ? "text-emerald-700" : "text-slate-700"
            }`}
          >
            {message}
          </p>
        )}

        {message && !isSigningIn && (
          <a
            href="/dashboard"
            className="mt-4 block text-center text-sm font-semibold text-emerald-700 underline"
          >
            Go to Dashboard
          </a>
        )}
      </div>
    </main>
  );
            }
