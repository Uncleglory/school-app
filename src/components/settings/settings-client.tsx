"use client";

import { useState, useTransition } from "react";
import { updateSchoolSettings } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Settings = {
  id: string;
  name: string;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  principal: string | null;
};

export function SettingsClient({ settings }: { settings: Settings }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await updateSchoolSettings({
          name: fd.get("name") as string,
          motto: (fd.get("motto") as string) || undefined,
          address: (fd.get("address") as string) || undefined,
          phone: (fd.get("phone") as string) || undefined,
          email: (fd.get("email") as string) || undefined,
          website: (fd.get("website") as string) || undefined,
          logoUrl: (fd.get("logoUrl") as string) || undefined,
          principal: (fd.get("principal") as string) || undefined,
        });
        setMessage("Settings saved. Receipts and report cards will use these details.");
      } catch (err: any) {
        setMessage(err.message || "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {message && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800">
          {message}
          <button className="ml-3 underline" onClick={() => setMessage("")}>dismiss</button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>School Profile</CardTitle>
          <CardDescription>
            These details appear on receipts, report cards and official documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>School Name *</Label>
                <Input name="name" defaultValue={settings.name} required />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Motto</Label>
                <Input name="motto" defaultValue={settings.motto || ""} placeholder="Excellence in Education" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Address</Label>
                <Input name="address" defaultValue={settings.address || ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input name="phone" defaultValue={settings.phone || ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input name="email" type="email" defaultValue={settings.email || ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Website</Label>
                <Input name="website" defaultValue={settings.website || ""} placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label>Principal / Head Teacher</Label>
                <Input name="principal" defaultValue={settings.principal || ""} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Logo URL (optional)</Label>
                <Input name="logoUrl" defaultValue={settings.logoUrl || ""} placeholder="https://..." />
              </div>
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
