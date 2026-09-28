"use client";

import { useState, useTransition } from "react";
import { signInAsMyself } from "@/server/actions/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SignInCard({
  alreadySigned,
  checkInLabel,
}: {
  alreadySigned: boolean;
  checkInLabel?: string | null;
}) {
  const [done, setDone] = useState(alreadySigned);
  const [message, setMessage] = useState(
    alreadySigned
      ? `You signed in${checkInLabel ? ` at ${checkInLabel}` : " today"}.`
      : ""
  );
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <CardContent className="pt-4 space-y-3">
        <p className="font-semibold text-emerald-950">
          Staff sign-in
        </p>

        <p className="text-sm text-emerald-900/80">
          When you arrive at school, tap the button to sign in.
        </p>

        {message && (
          <p className="text-sm font-medium text-emerald-800">
            {message}
          </p>
        )}

        <Button
          disabled={isPending || done}
          className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800"
          onClick={() => {
            startTransition(async () => {
              try {
                const result = await signInAsMyself();

                setDone(true);
                setMessage(
                  result.already
                    ? "You already signed in today."
                    : "Signed in successfully."
                );
              } catch (error: unknown) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Could not sign in."
                );
              }
            });
          }}
        >
          {done
            ? "Signed in today"
            : isPending
            ? "Signing in..."
            : "I have arrived — Sign in now"}
        </Button>
      </CardContent>
    </Card>
  );
}
