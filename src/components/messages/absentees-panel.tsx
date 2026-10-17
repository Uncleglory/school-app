"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAbsentees, sendToAbsentees, type AbsenteeRow } from "@/server/actions/messaging";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const DEFAULT_TEXT =
  "Glory Schools: Dear parent, your child {NAME} was absent from school on {DATE}. Please let the school know the reason. Thank you.";

const PLAIN = /^[\x20-\x7E\n]*$/;

export function AbsenteesPanel({ smsReady }: { smsReady: boolean }) {
  const [date, setDate] = useState("");
  const [shownDate, setShownDate] = useState("");
  const [rows, setRows] = useState<AbsenteeRow[]>([]);
  const [unmarked, setUnmarked] = useState<string[]>([]);
  const [ticked, setTicked] = useState<string[]>([]);
  const [message, setMessage] = useState(DEFAULT_TEXT);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ sent: number; failed: number; skipped: number; errors: string[] } | null>(null);

  const load = useCallback(async (d?: string) => {
    setLoading(true);
    setError("");
    setConfirming(false);
    try {
      const res = await getAbsentees(d || undefined);
      setRows(res.rows);
      setUnmarked(res.unmarkedClasses);
      setShownDate(res.date);
      // Pre-tick everyone who has a usable number
      setTicked(res.rows.filter((r) => r.phone).map((r) => r.studentId));
    } catch (e: any) {
      setError(e?.message || "Could not load absentees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendable = useMemo(() => rows.filter((r) => r.phone && ticked.includes(r.studentId)), [rows, ticked]);
  const parentCount = useMemo(() => new Set(sendable.map((r) => r.phone)).size, [sendable]);
  const withPhone = rows.filter((r) => r.phone);
  const parts = PLAIN.test(message) ? (message.length <= 160 ? 1 : Math.ceil(message.length / 153)) : Math.ceil(message.length / 67);

  const byClass = useMemo(() => {
    const m = new Map<string, AbsenteeRow[]>();
    for (const r of rows) m.set(r.className, [...(m.get(r.className) ?? []), r]);
    return Array.from(m.entries());
  }, [rows]);

  function toggle(id: string) {
    setConfirming(false);
    setTicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function send() {
    setSending(true);
    setError("");
    try {
      const res = await sendToAbsentees({ studentIds: sendable.map((r) => r.studentId), message, date: shownDate });
      setResult(res);
      setConfirming(false);
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
      setConfirming(false);
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">Absent students</CardTitle>
        <CardDescription>
          Everyone marked absent in the attendance register appears here with the parent&apos;s number. Tick, write, and
          send to all of them at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Date:</span>
          <Input
            type="date"
            value={date || shownDate}
            onChange={(e) => {
              setDate(e.target.value);
              setResult(null);
              if (e.target.value) load(e.target.value);
            }}
            className="w-44"
          />
          <Button type="button" variant="outline" size="sm" onClick={() => { setDate(""); setResult(null); load(); }}>
            Today
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => load(date || undefined)} disabled={loading}>
            Refresh
          </Button>
        </div>

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

        {result && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              result.failed === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            <p className="font-medium">
              {result.sent} message{result.sent === 1 ? "" : "s"} sent
              {result.failed ? `, ${result.failed} not delivered` : ""}
              {result.skipped ? `, ${result.skipped} skipped (no valid number)` : ""}.
            </p>
            {result.errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}

        {unmarked.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Attendance has not been marked yet for: {unmarked.join(", ")}. Their absentees will not show until it is marked.
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Looking for absentees...</p>}

        {!loading && rows.length === 0 && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm">No student is marked absent for {shownDate}.</p>
        )}

        {!loading && rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <strong>{rows.length}</strong> absent · <strong>{withPhone.length}</strong> with a parent number
              <Button type="button" variant="outline" size="sm" onClick={() => setTicked(withPhone.map((r) => r.studentId))}>
                Tick all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setTicked([])}>
                Untick all
              </Button>
            </div>

            <div className="max-h-96 space-y-3 overflow-y-auto rounded-md border p-2">
              {byClass.map(([cls, list]) => (
                <div key={cls}>
                  <p className="px-1 text-xs font-semibold uppercase text-muted-foreground">{cls}</p>
                  {list.map((r) => (
                    <label
                      key={r.studentId}
                      className={`flex items-center gap-3 rounded px-2 py-1.5 text-sm ${r.phone ? "cursor-pointer hover:bg-accent" : "opacity-60"}`}
                    >
                      <input
                        type="checkbox"
                        disabled={!r.phone}
                        checked={ticked.includes(r.studentId)}
                        onChange={() => toggle(r.studentId)}
                      />
                      <span className="flex-1 font-medium">{r.name}</span>
                      <span className="text-right text-xs text-muted-foreground">
                        {r.parentName ? `${r.parentName} · ` : ""}
                        {r.phone ? r.rawPhone : r.rawPhone ? `${r.rawPhone} (not valid)` : "no number"}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setConfirming(false);
              }}
              rows={4}
              maxLength={480}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {"{NAME}"} becomes the child&apos;s first name and {"{DATE}"} the date. {message.length}/480 characters ·{" "}
              {parts} SMS part{parts === 1 ? "" : "s"}.
            </p>

            {!confirming && (
              <Button
                type="button"
                disabled={!smsReady || parentCount === 0 || !message.trim() || sending}
                onClick={() => { setResult(null); setConfirming(true); }}
              >
                Review: send to {parentCount} parent{parentCount === 1 ? "" : "s"}
              </Button>
            )}
            {!smsReady && <p className="text-xs text-amber-800">SMS is not switched on yet.</p>}

            {confirming && (
              <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">
                  You are about to send to {parentCount} parent{parentCount === 1 ? "" : "s"} ({sendable.length} absent
                  student{sendable.length === 1 ? "" : "s"}). Example:
                </p>
                <p className="whitespace-pre-wrap rounded bg-white p-3 text-sm shadow-sm">
                  {message
                    .replace(/\{NAME\}/gi, sendable[0]?.name.split(" ").slice(1).join(" ") || "your child")
                    .replace(/\{DATE\}/gi, shownDate)}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
