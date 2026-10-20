"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { changeOwnPassword } from "@/lib/admin/members";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  return (
    <form
      className="mt-4 max-w-sm space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (next !== confirm) return setError("New passwords don't match.");
        start(async () => {
          const r = await changeOwnPassword(current, next);
          if (!r.ok) setError(r.error);
          else {
            setCurrent("");
            setNext("");
            setConfirm("");
            toast("Password updated");
            router.refresh();
          }
        });
      }}
    >
      {error && <div className="rounded-md bg-red-soft px-3 py-2 text-sm text-red">{error}</div>}
      <div>
        <label className="label" htmlFor="current-password">
          Current password
        </label>
        <input id="current-password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="new-password">
          New password
        </label>
        <input id="new-password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="confirm-password">
          Confirm new password
        </label>
        <input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required className="field" />
      </div>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Update password"}
      </Button>
    </form>
  );
}
