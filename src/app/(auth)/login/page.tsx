"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: LoginState = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="hidden md:flex flex-col justify-between bg-navy text-ivory p-10">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-gold font-display text-xl font-bold text-navy">
            GS
          </div>
          <div>
            <p className="font-display text-2xl font-semibold leading-none">Glory Schools</p>
            <p className="text-[11px] tracking-[0.22em] uppercase text-gold-soft mt-1">360</p>
          </div>
        </div>
        <div>
          <h1 className="font-display text-5xl leading-tight">A richer way to run the school.</h1>
          <p className="mt-4 max-w-sm text-ivory/70">
            Students, staff, fees, attendance and results — in one calm, gold-and-navy workspace.
          </p>
        </div>
        <p className="text-xs text-ivory/40">Excellence in education</p>
      </div>

      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold font-display text-lg font-bold text-navy">
              GS
            </div>
            <p className="font-display text-xl font-semibold">Glory Schools 360</p>
          </div>
          <h2 className="font-display text-3xl text-navy">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">Use your school email and password.</p>

          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@school.com"
                required
                autoComplete="email"
                disabled={isPending}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                disabled={isPending}
                className="h-11"
              />
            </div>

            {state?.error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 font-semibold" disabled={isPending}>
              {isPending ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
