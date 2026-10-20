"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/cn";

const docs = new Map<string, Promise<PDFDocumentProxy>>();

/** Loads a PDF once per page view, so moving between pages doesn't download it again. */
function loadPdf(url: string) {
  let doc = docs.get(url);
  if (!doc) {
    doc = (async () => {
      // The legacy build carries polyfills that school Chromebooks and older Safari need.
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
      // Fonts a PDF doesn't carry itself, from the same pdf.js version.
      const cdn = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`;
      return pdfjs.getDocument({ url, cMapUrl: `${cdn}/cmaps/`, standardFontDataUrl: `${cdn}/standard_fonts/` }).promise;
    })();
    docs.set(url, doc);
    doc.catch(() => docs.delete(url));
  }
  return doc;
}

/** One page of a PDF, drawn as large as fits in its box. Pages count from 0. */
export function PdfPage({ url, page, onPages, className }: { url: string; page: number; onPages?: (n: number) => void; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const pagesCb = useRef(onPages);
  pagesCb.current = onPages;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!size || size.w < 2 || size.h < 2) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    (async () => {
      try {
        const doc = await loadPdf(url);
        if (cancelled) return;
        pagesCb.current?.(doc.numPages);
        const p = await doc.getPage(Math.min(Math.max(1, page + 1), doc.numPages));
        if (cancelled) return;
        const base = p.getViewport({ scale: 1 });
        const fit = Math.min(size.w / base.width, size.h / base.height);
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const viewport = p.getViewport({ scale: fit * dpr });
        // Draw off screen first, so the old page stays up until the new one is ready.
        const off = document.createElement("canvas");
        off.width = Math.floor(viewport.width);
        off.height = Math.floor(viewport.height);
        const render = p.render({ canvas: off, viewport });
        task = render;
        await render.promise;
        if (cancelled || !canvas.current) return;
        const c = canvas.current;
        c.width = off.width;
        c.height = off.height;
        c.style.width = `${Math.floor(viewport.width / dpr)}px`;
        c.style.height = `${Math.floor(viewport.height / dpr)}px`;
        c.getContext("2d")?.drawImage(off, 0, 0);
        setState("ok");
      } catch (e) {
        if (!cancelled && (e as Error)?.name !== "RenderingCancelledException") setState("error");
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [url, page, size]);

  return (
    <div ref={box} className={cn("relative flex h-full w-full items-center justify-center overflow-hidden", className)}>
      <canvas ref={canvas} className={cn("max-h-full max-w-full bg-white shadow-sm", state !== "ok" && "invisible")} />
      {state === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-sm opacity-70">
          Couldn&apos;t show this PDF here.
          <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            Open the PDF
          </a>
        </div>
      )}
    </div>
  );
}
