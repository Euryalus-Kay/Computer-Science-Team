"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, Trash2, MonitorPlay, Eye } from "lucide-react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveDeck, deleteDeck, uploadFile, registerBlob, type DeckInput } from "@/lib/admin/decks";
import { previewTestMarkdown } from "@/lib/admin/tests";
import { Segmented } from "@/components/admin/tests/editor/fields";

function split(md: string) {
  return md
    .split(/\n\s*---+\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function DeckEditor({ initial, fileName, blob }: { initial: DeckInput; fileName: string | null; blob: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [deck, setDeck] = useState(initial);
  const [file, setFile] = useState(fileName);
  const [cursor, setCursor] = useState(0);
  const [html, setHtml] = useState("");
  const [saving, startSave] = useTransition();
  const [uploading, setUploading] = useState(false);
  const set = (p: Partial<DeckInput>) => setDeck((d) => ({ ...d, ...p }));

  // Preview the slide the cursor is in.
  const slides = useMemo(() => split(deck.body), [deck.body]);
  const current = useMemo(() => {
    const before = deck.body.slice(0, cursor);
    return Math.min(slides.length - 1, (before.match(/\n\s*---+\s*\n/g) ?? []).length);
  }, [deck.body, cursor, slides.length]);
  useEffect(() => {
    if (deck.kind !== "markdown") return;
    const t = setTimeout(() => previewTestMarkdown(slides[Math.max(0, current)] ?? "").then(setHtml), 200);
    return () => clearTimeout(t);
  }, [deck.kind, slides, current]);

  const save = () =>
    startSave(async () => {
      const r = await saveDeck(deck);
      if (!r.ok) return toast(r.error, "error");
      toast("Saved");
      if (!deck.id && r.data) router.replace(`/admin/slides/${r.data.id}`);
      else router.refresh();
      if (r.data) set({ id: r.data.id });
    });

  const onFile = async (f: File) => {
    if (f.type !== "application/pdf") return toast("Choose a PDF.", "error");
    setUploading(true);
    try {
      if (blob && f.size > 4 * 1024 * 1024) {
        const b = await upload(`slides/${f.name}`, f, { access: "public", handleUploadUrl: "/api/blob" });
        const r = await registerBlob({ url: b.url, name: f.name, size: f.size });
        if (!r.ok || !r.data) throw new Error(r.ok ? "Upload failed" : r.error);
        set({ fileId: r.data.id });
      } else {
        const form = new FormData();
        form.set("file", f);
        const r = await uploadFile(form);
        if (!r.ok || !r.data) throw new Error(r.ok ? "Upload failed" : r.error);
        set({ fileId: r.data.id });
      }
      setFile(f.name);
      if (!deck.title) set({ title: f.name.replace(/\.pdf$/i, "") });
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-3 p-3">
        <input value={deck.title} onChange={(e) => set({ title: e.target.value })} placeholder="Title" className="field min-w-[240px] flex-1 font-medium" />
        <Segmented
          value={deck.kind}
          onChange={(v) => set({ kind: v })}
          options={[
            ["markdown", "Write"],
            ["pdf", "PDF"],
            ["link", "Link"],
          ]}
        />
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <Switch checked={deck.published} onChange={(v) => set({ published: v })} label="Visible to members" /> Visible
        </label>
        <div className="ml-auto flex gap-2">
          {deck.id && (
            <>
              <Button icon={<Eye className="size-4" />} onClick={() => window.open(`/slides/${deck.id}`, "_blank")}>
                View
              </Button>
              {deck.kind === "markdown" && (
                <Button
                  icon={<MonitorPlay className="size-4" />}
                  onClick={async () => {
                    const r = await fetch("/api/board/state", {
                      method: "PATCH",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({ view: "slides", deckId: deck.id, slide: Math.max(0, current) }),
                    });
                    toast(r.ok ? "Showing on the board" : "Couldn't update the board");
                  }}
                >
                  Board
                </Button>
              )}
            </>
          )}
          <Button variant="primary" onClick={save} disabled={saving || uploading}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {deck.kind === "markdown" && (
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="card overflow-hidden">
            <div className="flex h-9 items-center justify-between border-b border-line bg-panel-2 px-3 text-xs text-ink-3">
              <span>Markdown. A line with --- starts a new slide.</span>
              <span className="num">
                {slides.length} slide{slides.length === 1 ? "" : "s"}
              </span>
            </div>
            <textarea
              value={deck.body}
              onChange={(e) => {
                set({ body: e.target.value });
                setCursor(e.target.selectionStart);
              }}
              onSelect={(e) => setCursor((e.target as HTMLTextAreaElement).selectionStart)}
              spellCheck={false}
              className="block h-[62vh] w-full resize-none bg-panel px-4 py-3 font-mono text-[13px] leading-relaxed outline-none"
            />
          </div>
          <div>
            <div data-theme="dark" className="relative aspect-video w-full overflow-hidden rounded-xl bg-[#0b0d10] text-[#eef0f3] shadow-card [container-type:size]">
              <div className="absolute inset-0 px-[6cqw] py-[6cqh]">
                <div className="board-slide prose h-full overflow-hidden" dangerouslySetInnerHTML={{ __html: html }} />
              </div>
              <div className="num absolute right-[2.5cqw] bottom-[2cqh] font-mono text-[1.3cqw] text-white/35">
                {Math.max(0, current) + 1} / {slides.length}
              </div>
            </div>
            <div className="mt-2 text-xs text-ink-3">Preview follows your cursor.</div>
          </div>
        </div>
      )}

      {deck.kind === "pdf" && (
        <div className="card p-6">
          {file ? (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm">
                <FileText className="size-5 text-ink-3" /> {file}
              </span>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-line-2 px-3 text-sm font-medium hover:bg-panel-2">
                <Upload className="size-4" /> Replace
                <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
              </label>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-2 px-6 py-12 text-sm text-ink-3 hover:bg-panel-2">
              <Upload className="size-6" />
              {uploading ? "Uploading…" : "Choose a PDF"}
              <span className="text-xs text-ink-4">{blob ? "Up to 100 MB" : "Up to 4 MB"}</span>
              <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          )}
        </div>
      )}

      {deck.kind === "link" && (
        <div className="card p-4">
          <label className="label">Link</label>
          <input value={deck.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="https://docs.google.com/presentation/d/…" className="field" />
          <div className="hint">Google Slides and Canva links show inside the page. Anything else opens in a new tab.</div>
        </div>
      )}

      {deck.id && (
        <button
          onClick={async () => {
            if (!confirm("Delete this deck?")) return;
            await deleteDeck(deck.id!);
            router.push("/admin/slides");
          }}
          className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-red"
        >
          <Trash2 className="size-4" /> Delete deck
        </button>
      )}
    </div>
  );
}
