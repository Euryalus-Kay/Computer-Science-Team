"use client";

import { useEffect, useState } from "react";

/**
 * The current time, ticking every `ms`. It is null on the server and during
 * hydration, so server and client render the same markup.
 */
export function useNow(ms = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
