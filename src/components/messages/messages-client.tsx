"use client";

import { useEffect, useMemo, useState } from "react";
import { previewRecipients, sendMessageToParents, sendTestMessage } from "@/server/actions/messaging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type ClassRow = { id: string; name: string; total: number; withPhone: number };

const TEMPLATES: { label: string; text: string }[] = [
  {
    label: "School resumes",
    text: "Glory Schools: School resumes on [DATE]. Please make sure your child is on time and fully kitted. Thank you.",
  },
  {
    label: "Fee reminder",
    text: "Glory Schools: Dear parent, this is a reminder that school fees for this term are due by [DATE]. Please pay promptly. Thank you.",
  },
  {
    label: "Meeting / event",
    text: "Glory Schools: You are invited to [EVENT] on [DATE] at [TIME]. We look forward to seeing you.",
  },
];

// Plain letters, numbers and common symbols fit in one SMS of 160 characters.
// Anything else (like the naira sign) forces a shorter 70-character SMS.
const PLAIN = /^[\x20-\x7E\n]*$/;

function smsParts(text: string) {
  if (!text) return 0;
  if (PLAIN.test(text)) return text.length <= 160 ? 1 : Math.ceil(text.length / 153);
  return text.length <= 70 ? 1 : Math.ceil(text.length / 67);
}

export function MessagesClient({ classes, smsReady }: { classes: ClassRow[]; smsReady: boolean }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ students: number; parents: number; missing: number; invalid: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testNote, setTestNote] = useState("");

  const allIds = useMemo(() => classes.map((c) => c.id), [classes]);
  const unicode = !PLAIN.test(message);
  const parts = smsParts(message);

  // Refresh the recipient count whenever the class selection changes
  useEffect(() => {
    setConfirming(false);
    setResult(null);
    if (selected.length === 0) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoadingPreview(true);
    previewRecipients(selected)
      .then((p) => !cancelled && setPreview(p))
      .catch((e) => !cancelled && setError(e?.message || "Could not count parents"))
      .finally(() => !cancelled && setLoadingPreview(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((c) => c !== id) : [...cur, id]));
  }

  const canReview = smsReady && !!preview && preview.parents > 0 && message.trim().length > 0 && !sending;

  async function send() {
    if (!preview) return;
    setSending(true);
    setError("");
    try {
      const res = await sendMessageToParents({ classIds: selected, message, expectedParents: preview.parents });
      setResult(res);
      setConfirming(false);
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Nothing more was sent.");
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  async function sendTest() {
    setTestNote("");
    setError("");
    try {
      const res = await sendTestMessage({ phone: testPhone, message });
      setTestNote(
        res.sent > 0
          ? "Test sent. Check your phone."
          : `Test was not delivered. ${res.errors.join(" ") || "Check your Africa's Talking balance and settings."}`
      );
    } catch (e: any) {
      setTestNote(e?.message || "Test failed.");
    }
  }

  return (
    <div className="space-y-4">
      {!smsReady && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          SMS is not switched on yet (the Africa&apos;s Talking keys are missing). You can prepare a message, but nothing can be sent.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
          <button className="ml-3 underline" onClick={() => setError("")}>dismiss</button>
        </div>
      )}

      {result && (
        <div
          className={`rounded-md border px-4 py-3 text-sm ${
            result.failed === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          <p className="font-medium">
            {result.sent} message{result.sent === 1 ? "" : "s"} sent{result.failed ? `, ${result.failed} not delivered` : ""}.
          </p>
          {result.errors.map((e) => (
            <p key={e}>{e}</p>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Who should get it?</CardTitle>
          <CardDescription>
            Tick the classes. Brothers and sisters with the same parent number get only one SMS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(allIds)}>
              Whole school
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-accent"
              >
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                  <span className="font-medium">{c.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {c.withPhone}/{c.total} have a number
                </span>
              </label>
            ))}
          </div>

          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            {selected.length === 0 && "No class selected yet."}
            {selected.length > 0 && loadingPreview && "Counting parents..."}
            {selected.length > 0 && !loadingPreview && preview && (
              <>
                <strong>{preview.parents}</strong> parent number{preview.parents === 1 ? "" : "s"} will get this message.
                {preview.missing + preview.invalid > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    {preview.missing} student{preview.missing === 1 ? " has" : "s have"} no number
                    {preview.invalid > 0 ? ` and ${preview.invalid} have a number that is not valid` : ""}; they are skipped.
                  </span>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">2. Write the message</CardTitle>
          <CardDescription>Start from an example, then change the words in [BRACKETS].</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t) => (
              <Button key={t.label} type="button" variant="outline" size="sm" onClick={() => setMessage(t.text)}>
                {t.label}
              </Button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setConfirming(false);
            }}
            rows={5}
            maxLength={480}
            placeholder="Type your message to parents here..."
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {message.length}/480 characters · {parts} SMS part{parts === 1 ? "" : "s"} per parent.
            {unicode && (
              <span className="text-amber-700">
                {" "}
                This message has special characters (like the naira sign ₦ or curly quotes), which make each SMS
                shorter and more costly. Write N instead of ₦.
              </span>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className="text-sm text-muted-foreground">Send a test to my phone first:</span>
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="0806 302 1584"
              className="w-44"
              inputMode="tel"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!smsReady || !message.trim() || !testPhone.trim()}
              onClick={sendTest}
            >
              Send test
            </Button>
            {testNote && <span className="text-sm">{testNote}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">3. Check and send</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!confirming && (
            <Button type="button" disabled={!canReview} onClick={() => setConfirming(true)}>
              Review before sending
            </Button>
          )}
          {confirming && preview && (
            <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">
                You are about to send this to {preview.parents} parent{preview.parents === 1 ? "" : "s"}:
              </p>
              <p className="whitespace-pre-wrap rounded bg-white p-3 text-sm shadow-sm">{message}</p>
              <p className="text-xs text-amber-900">
                Up to {preview.parents * parts} SMS units will be used from your Africa&apos;s Talking balance. This
                cannot be undone once sent.
              </p>
              <div className="flex gap-2">
                <Button type="button" onClick={send} disabled={sending}>
                  {sending ? "Sending..." : "Yes, send now"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setConfirming(false)} disabled={sending}>
                  Go back
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
