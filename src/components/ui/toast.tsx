"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Toast = { id: number; text: ReactNode; tone: "default" | "error" | "success" };
const Ctx = createContext<(text: ReactNode, tone?: Toast["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: ReactNode, tone: Toast["tone"] = "default") => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t.slice(-3), { id, text, tone }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3200);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "animate-in pointer-events-auto rounded-lg px-3.5 py-2 text-sm shadow-pop",
              t.tone === "error" ? "bg-red text-white" : "bg-ink text-panel",
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
