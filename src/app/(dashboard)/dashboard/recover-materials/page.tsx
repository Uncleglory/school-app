"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listBlobFiles,
  getRecoveryOptions,
  restoreMaterials,
} from "@/server/actions/recover-materials";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Kind = "NOTE" | "ASSIGNMENT" | "SLIDE" | "PAST_PAPER" | "VIDEO" | "OTHER";

type BlobFile = {
  url: string;
  pathname: string;
  size: number;
  uploadedAt: string;
  linked: boolean;
};

type Options = {
  classes: { id: string; name: string }[];
  subjects: { id: string; name: string; code: string }[];
};

const KINDS: Kind[] = [
  "NOTE",
  "ASSIGNMENT",
  "SLIDE",
  "PAST_PAPER",
  "VIDEO",
  "OTHER",
];

function guessTitle(pathname: string) {
  const file = pathname.split("/").pop() || pathname;
  const noExt = file.replace(/\.[^.]+$/, "");
  return noExt.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function guessKind(pathname: string): Kind {
  const ext = (pathname.split(".").pop() || "").toLowerCase();
  if (["mp4", "mov", "webm", "mkv", "avi", "m4v", "3gp"].includes(ext)) {
    return "VIDEO";
  }
  if (["ppt", "pptx", "key"].includes(ext)) return "SLIDE";
  if (["pdf", "doc", "docx", "txt", "rtf"].includes(ext)) return "NOTE";
  return "OTHER";
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RecoverMaterialsPage() {
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState<BlobFile[]>([]);
  const [options, setOptions] = useState<Options>({ classes: [], subjects: [] });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [kinds, setKinds] = useState<Record<string, Kind>>({});
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [f, o] = await Promise.all([listBlobFiles(), getRecoveryOptions()]);
      setFiles(f);
      setOptions(o);
      setTitles((prev) => {
        const next = { ...prev };
        for (const x of f) {
          if (!(x.url in next)) next[x.url] = guessTitle(x.pathname);
        }
        return next;
      });
      setKinds((prev) => {
        const next = { ...prev };
        for (const x of f) {
          if (!(x.url in next)) next[x.url] = guessKind(x.pathname);
        }
        return next;
      });
    } catch (err: any) {
      setMessage(err.message || "Could not load the files");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unlinked = files.filter((f) => !f.linked);

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(unlinked.map((f) => f.url)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function handleRestore() {
    const chosen = files.filter((f) => selected.has(f.url) && !f.linked);
    if (chosen.length === 0) {
      setMessage("Tick at least one file first");
      return;
    }
    startTransition(async () => {
      try {
        const res = await restoreMaterials(
          chosen.map((f) => ({
            url: f.url,
            title: titles[f.url] || guessTitle(f.pathname),
            type: kinds[f.url] || guessKind(f.pathname),
            uploadedAt: f.uploadedAt,
          })),
          { classId: classId || undefined, subjectId: subjectId || undefined }
        );
        setMessage(
          `Restored ${res.created} file(s)` +
            (res.skipped ? `, skipped ${res.skipped} already restored` : "")
        );
        setSelected(new Set());
        await load();
      } catch (err: any) {
        setMessage(err.message || "Restore failed");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recover materials</h1>
        <p className="text-muted-foreground">
          One-time tool. Lists every file in the file store and creates a
          material record for the ones you tick. Do it in batches: tick the
          files for one class and subject, choose them below, then restore.
        </p>
      </div>

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
          <CardTitle className="text-base">
            Apply to the ticked files (optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <select
              className="flex h-9 w-full rounded-md border px-3 text-sm"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              <option value="">No class</option>
              {options.classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <select
              className="flex h-9 w-full rounded-md border px-3 text-sm"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
            >
              <option value="">No subject</option>
              {options.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={selectAll} disabled={isPending}>
          Tick all not yet restored
        </Button>
        <Button size="sm" variant="outline" onClick={selectNone} disabled={isPending}>
          Untick all
        </Button>
        <Button size="sm" onClick={handleRestore} disabled={isPending}>
          Restore {selected.size} ticked file{selected.size === 1 ? "" : "s"}
        </Button>
        <span className="text-sm text-muted-foreground">
          {files.length} file(s) in the store, {unlinked.length} not restored yet
        </span>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Loading files...
            </p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No files found in the file store.
            </p>
          ) : (
            <ul className="space-y-3">
              {files.map((f) => (
                <li
                  key={f.url}
                  className="flex flex-col gap-2 border-b last:border-0 pb-3 sm:flex-row sm:items-center"
                >
                  <div className="flex items-center gap-3 sm:w-1/2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.has(f.url)}
                      disabled={f.linked || isPending}
                      onChange={() => toggle(f.url)}
                    />
                    <div className="min-w-0 flex-1">
                      <Input
                        value={titles[f.url] ?? ""}
                        onChange={(e) =>
                          setTitles((prev) => ({
                            ...prev,
                            [f.url]: e.target.value,
                          }))
                        }
                        disabled={f.linked || isPending}
                      />
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {f.pathname} 路 {formatSize(f.size)} 路{" "}
                        {new Date(f.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {f.linked ? (
                    <span className="text-xs text-emerald-700">
                      Already restored
                    </span>
                  ) : (
                    <select
                      className="h-9 rounded-md border px-3 text-sm"
                      value={kinds[f.url] ?? "OTHER"}
                      onChange={(e) =>
                        setKinds((prev) => ({
                          ...prev,
                          [f.url]: e.target.value as Kind,
                        }))
                      }
                      disabled={isPending}
                    >
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
