"use client";

import { useEffect, useRef } from "react";

export type QueuedEvent = { type: string; at: number; itemId?: string | null; data?: Record<string, unknown> };

type DesktopBridge = {
  version: string;
  on: (cb: (e: { type: string; data?: Record<string, unknown> }) => void) => () => void;
  testStarted: (info: { attemptId: string; title: string; scanApps?: boolean }) => void;
  testEnded: () => void;
};

declare global {
  interface Window {
    labcsDesktop?: DesktopBridge;
  }
}

export type IntegrityOptions = {
  attemptId: string;
  title: string;
  active: boolean;
  blockPaste: boolean;
  scanApps?: boolean;
  currentItem: () => string | null;
  onReturn?: (awayMs: number) => void;
  onFullscreenChange?: (on: boolean) => void;
  onPasteBlocked?: () => void;
};

/** Watches the page for signs of leaving the test and queues events for the heartbeat. */
export function useIntegrity(opts: IntegrityOptions) {
  const queue = useRef<QueuedEvent[]>([]);
  const ref = useRef(opts);
  ref.current = opts;

  const began = useRef(false);
  const push = (type: string, data?: Record<string, unknown>) => {
    queue.current.push({ type, at: Date.now(), itemId: ref.current.currentItem(), data });
    if (queue.current.length > 300) queue.current.splice(0, queue.current.length - 300);
  };

  useEffect(() => {
    if (!opts.active) return;
    const { attemptId } = opts;
    const loadedKey = `attempt:${attemptId}:loaded`;
    // Effects can run twice on mount in development; only the first run counts.
    if (!began.current) {
      began.current = true;
      try {
        if (sessionStorage.getItem(loadedKey)) push("reload");
        else {
          sessionStorage.setItem(loadedKey, "1");
          push("start", { w: innerWidth, h: innerHeight, sw: screen.width, sh: screen.height, dpr: devicePixelRatio });
        }
      } catch {
        push("start");
      }
    }

    let hiddenAt: number | null = null;
    let blurAt: number | null = null;
    let lastCopy = "";
    // In the Lab CS app the app itself reports leaving, screens and the window, so the page
    // doesn't report them again (twice, or as a resize while kiosk mode takes over the screen).
    const inApp = Boolean(window.labcsDesktop);

    const onVisibility = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
        // Switching tabs blurs the window first; count it once, as leaving the tab.
        if (blurAt && hiddenAt - blurAt < 1000) {
          const last = queue.current[queue.current.length - 1];
          if (last?.type === "blur") queue.current.pop();
          blurAt = null;
        }
        push("visibility_hidden");
      } else if (hiddenAt) {
        const away = Date.now() - hiddenAt;
        hiddenAt = null;
        push("visibility_visible", { awayMs: away });
        ref.current.onReturn?.(away);
      }
    };
    const onBlur = () => {
      if (document.hidden || inApp) return;
      blurAt = Date.now();
      push("blur");
    };
    const onFocus = () => {
      if (blurAt) {
        const away = Date.now() - blurAt;
        blurAt = null;
        push("focus", { awayMs: away });
        if (away > 1500) ref.current.onReturn?.(away);
      }
    };
    const onFullscreen = () => {
      const on = Boolean(document.fullscreenElement);
      push(on ? "fullscreen_enter" : "fullscreen_exit");
      ref.current.onFullscreenChange?.(on);
    };
    const onCopy = (e: ClipboardEvent) => {
      lastCopy = (window.getSelection()?.toString() ?? "").trim();
      push(e.type === "cut" ? "cut" : "copy", { chars: lastCopy.length });
    };
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const internal = Boolean(text.trim()) && lastCopy && text.trim() === lastCopy;
      const blocked = ref.current.blockPaste && !internal;
      push("paste", { chars: text.length, internal: Boolean(internal), blocked, sample: text.slice(0, 120) });
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        ref.current.onPasteBlocked?.();
      }
    };
    const onContext = (e: MouseEvent) => {
      push("contextmenu");
      e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (e.key === "F12" || (mod && e.shiftKey && ["i", "j", "c"].includes(k)) || (mod && e.altKey && ["i", "j"].includes(k))) {
        push("shortcut", { combo: "devtools" });
        e.preventDefault();
      } else if (mod && k === "p") {
        push("print");
        e.preventDefault();
      } else if (mod && k === "u") {
        push("shortcut", { combo: "view-source" });
        e.preventDefault();
      } else if (mod && ["t", "n", "w", "tab"].includes(k)) {
        push("shortcut", { combo: `${e.metaKey ? "cmd" : "ctrl"}+${k}` });
      }
    };
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let wasSmall = false;
    const onResize = () => {
      if (inApp) return;
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const small = innerWidth < screen.availWidth * 0.66 && screen.availWidth > 900;
        if (small !== wasSmall) {
          wasSmall = small;
          push("resize", { w: innerWidth, h: innerHeight, sw: screen.availWidth, small });
        }
      }, 600);
    };
    const onPageHide = () => {
      push("unload");
      const body = JSON.stringify({ events: queue.current.splice(0) });
      navigator.sendBeacon?.(`/api/attempts/${attemptId}/beat`, new Blob([body], { type: "application/json" }));
    };

    // Docked developer tools shrink the inner window without a resize of the outer one.
    let devtoolsOpen = false;
    const devtoolsCheck = setInterval(() => {
      const gapW = outerWidth - innerWidth;
      const gapH = outerHeight - innerHeight;
      const open = (gapW > 200 || gapH > 260) && outerWidth > 0 && devicePixelRatio <= 2.5;
      if (open && !devtoolsOpen) push("devtools", { gapW, gapH });
      devtoolsOpen = open;
    }, 2000);

    // Extended displays (Chromium only).
    const scr = screen as Screen & {
      isExtended?: boolean;
      addEventListener?: (t: string, f: () => void) => void;
      removeEventListener?: (t: string, f: () => void) => void;
    };
    if (scr.isExtended && !inApp) push("multi_screen", { extended: true });
    const onScreen = () => scr.isExtended && !inApp && push("multi_screen", { extended: true });
    scr.addEventListener?.("change", onScreen);

    // Idle: no input for 3 minutes while visible.
    let lastInput = Date.now();
    let idleReported = false;
    const onInput = () => {
      lastInput = Date.now();
      idleReported = false;
    };
    const idleCheck = setInterval(() => {
      if (!document.hidden && !idleReported && Date.now() - lastInput > 180_000) {
        idleReported = true;
        push("idle", { ms: Date.now() - lastInput });
      }
    }, 15_000);

    // Desktop app bridge.
    const desk = window.labcsDesktop;
    const offDesk = desk?.on((e) => {
      push(e.type, e.data);
      if (e.type === "desktop_focus" && typeof e.data?.awayMs === "number") ref.current.onReturn?.(e.data.awayMs as number);
    });
    desk?.testStarted({ attemptId, title: opts.title, scanApps: opts.scanApps !== false });

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreen);
    document.addEventListener("copy", onCopy, true);
    document.addEventListener("cut", onCopy, true);
    document.addEventListener("paste", onPaste, true);
    document.addEventListener("contextmenu", onContext);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onInput, true);
    document.addEventListener("keydown", onInput, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      clearInterval(devtoolsCheck);
      clearInterval(idleCheck);
      scr.removeEventListener?.("change", onScreen);
      offDesk?.();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreen);
      document.removeEventListener("copy", onCopy, true);
      document.removeEventListener("cut", onCopy, true);
      document.removeEventListener("paste", onPaste, true);
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onInput, true);
      document.removeEventListener("keydown", onInput, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pagehide", onPageHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.active, opts.attemptId]);

  return {
    push,
    drain: () => queue.current.splice(0),
  };
}
