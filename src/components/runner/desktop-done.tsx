"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Bridge = { testEnded: () => void; quit?: () => void };

/** Inside the desktop app: release lockdown and offer to close the app. */
export function DesktopDone() {
  const [inApp, setInApp] = useState(false);
  useEffect(() => {
    const b = (window as unknown as { labcsDesktop?: Bridge }).labcsDesktop;
    if (b) {
      setInApp(true);
      b.testEnded();
    }
  }, []);
  if (!inApp) return null;
  return (
    <div className="card mb-6 flex items-center justify-between gap-3 p-4">
      <span className="text-sm text-ink-2">Lockdown is off. You can close the app.</span>
      <Button size="sm" variant="primary" onClick={() => (window as unknown as { labcsDesktop?: Bridge }).labcsDesktop?.quit?.()}>
        Close app
      </Button>
    </div>
  );
}
