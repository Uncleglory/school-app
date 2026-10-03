"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createStudentLogins } from "@/server/actions/student-logins";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type ClassRow = { id: string; name: string; total: number; withLogin: number };

type Created = {
  admissionNo: string;
  name: string;
  className: string;
  password: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function StudentLoginsClient({ classes }: { classes: ClassRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [created, setCreated] = useState<Created[]>([]);
  const [failedCount, setFailedCount] = useState(0);
  const [message, setMessage] = useState("");

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((c) => c !== id) : [...current, id]
    );
  }

  const pendingTotal = classes
    .filter((c) => selected.includes(c.id))
    .reduce((sum, c) => sum + (c.total - c.withLogin), 0);

  async function run() {
    if (selected.length === 0) {
      setMessage("Please tick at least one class.");
      return;
    }

    setRunning(true);
    setMessage("");
    setCreated([]);
    setFailedCount(0);

    let all: Created[] = [];
    let failures = 0;

    try {
      for (let round = 0; round < 60; round++) {
        const res = await createStudentLogins(selected);
        all = [...all, ...res.created];
        failures += res.failed.length;
        setCreated(all);
        setFailedCount(failures);

        if (res.remaining === 0 || res.created.length === 0) break;
      }

      setMessage(
        all.length === 0
          ? "Nobody needed a login in these classes."
          : `Done. ${all.length} logins created. Print or save the list now: the passwords cannot be shown again.`
      );
      router.refresh();
    } catch (err: any) {
      setMessage(err?.message || "Something went wrong. Try again.");
    } finally {
      setRunning(false);
    }
  }

  const sorted = [...created].sort(
    (a, b) =>
      a.className.localeCompare(b.className, undefined, { numeric: true }) ||
      a.name.localeCompare(b.name)
  );

  function printList() {
    const w = window.open("", "_blank");
    if (!w) {
      setMessage("Please allow pop-ups for this site, then try again.");
      return;
    }
    const rows = sorted
      .map(
        (r) =>
          `<tr><td>${escapeHtml(r.className)}</td><td>${escapeHtml(r.name)}</td><td>${escapeHtml(
            r.admissionNo
          )}</td><td style="font-family:monospace;font-size:15px">${escapeHtml(
            r.password
          )}</td></tr>`
      )
      .join("");
    w.document.write(`<html><head><title>Student logins</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #999;padding:6px 8px;text-align:left;font-size:13px}
        th{background:#eee}
        h2{margin:0 0 4px}
        p{margin:0 0 12px;color:#444;font-size:13px}
      </style></head><body>
      <h2>Student login list</h2>
      <p>Login ID = admission number. Keep this list private.</p>
      <table><tr><th>Class</th><th>Name</th><th>Login ID (admission no.)</th><th>Password</th></tr>${rows}</table>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  function downloadCsv() {
    const lines = [
      "Class,Name,Admission No (login ID),Password",
      ...sorted.map((r) =>
        [r.className, r.name, r.admissionNo, r.password]
          .map((v) => `"${v.replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-logins.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-2 text-sm text-emerald-800">
          {message}
          <button className="ml-3 underline" onClick={() => setMessage("")}>
            dismiss
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose the classes</CardTitle>
          <CardDescription>
            Students log in with their admission number and a password. Parents of younger children use their child's login.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelected(classes.map((c) => c.id))}
              disabled={running}
            >
              Select all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setSelected([])}
              disabled={running}
            >
              Clear
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-96 overflow-y-auto rounded-md border p-3">
            {classes.map((c) => {
              const missing = c.total - c.withLogin;
              return (
                <label key={c.id} className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(c.id)}
                    onChange={() => toggle(c.id)}
                    disabled={running}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    <span className="font-medium">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.total} students ·{" "}
                      {missing === 0 ? "all have logins" : `${missing} need logins`}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={run} disabled={running || selected.length === 0}>
              {running ? "Creating logins…" : "Create logins for selected classes"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {selected.length} class{selected.length === 1 ? "" : "es"} ticked ·{" "}
              {pendingTotal} login{pendingTotal === 1 ? "" : "s"} to create
            </span>
          </div>

          {running && (
            <p className="text-xs text-muted-foreground">
              {created.length} created so far. Keep this page open.
            </p>
          )}
        </CardContent>
      </Card>

      {created.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              New logins ({created.length})
            </CardTitle>
            <CardDescription>
              Print or save this list now. Passwords are scrambled and cannot be shown again.
              {failedCount > 0 && ` ${failedCount} student(s) could not be created, run it again to retry.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Button type="button" onClick={printList}>
                Print list
              </Button>
              <Button type="button" variant="outline" onClick={downloadCsv}>
                Download for Excel
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Login ID</th>
                    <th className="pb-2 font-medium">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((r) => (
                    <tr key={r.admissionNo} className="border-b last:border-0">
                      <td className="py-2">{r.className}</td>
                      <td className="py-2">{r.name}</td>
                      <td className="py-2 font-mono text-xs">{r.admissionNo}</td>
                      <td className="py-2 font-mono">{r.password}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
