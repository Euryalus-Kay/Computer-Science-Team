"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loginAction, joinAction, setupAction, type FormState } from "@/lib/auth/actions";

function ErrorLine({ state }: { state: FormState }) {
  if (!state?.error) return null;
  return (
    <div role="alert" className="rounded-md bg-red-soft px-3 py-2 text-sm text-red">
      {state.error}
    </div>
  );
}

function PasswordInput({ id, name, autoComplete, placeholder }: { id: string; name: string; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        className="field pr-9"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-4 hover:text-ink-2"
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ next, signupEnabled }: { next?: string; signupEnabled: boolean }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? "/"} />
      <ErrorLine state={state} />
      <div>
        <label className="label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          defaultValue={state?.values?.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </div>
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      {signupEnabled && (
        <p className="pt-1 text-center text-sm text-ink-3">
          Have a join code?{" "}
          <Link href="/join" className="font-medium text-ink hover:underline">
            Create an account
          </Link>
        </p>
      )}
    </form>
  );
}

export function JoinForm({ code }: { code?: string }) {
  const [state, action, pending] = useActionState(joinAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <ErrorLine state={state} />
      <div>
        <label className="label" htmlFor="code">
          Join code
        </label>
        <input
          id="code"
          name="code"
          defaultValue={state?.values?.code ?? code}
          required
          autoCapitalize="characters"
          spellCheck={false}
          className="field font-mono tracking-[0.18em] uppercase"
          maxLength={12}
        />
      </div>
      <div>
        <label className="label" htmlFor="name">
          Full name
        </label>
        <input id="name" name="name" defaultValue={state?.values?.name} autoComplete="name" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          defaultValue={state?.values?.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <PasswordInput id="password" name="password" autoComplete="new-password" />
        <div className="hint">At least 6 characters.</div>
      </div>
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </Button>
      <p className="pt-1 text-center text-sm text-ink-3">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-ink hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function SetupForm({ needsToken }: { needsToken: boolean }) {
  const [state, action, pending] = useActionState(setupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <ErrorLine state={state} />
      {needsToken && (
        <div>
          <label className="label" htmlFor="token">
            Setup token
          </label>
          <input id="token" name="token" defaultValue={state?.values?.token} required className="field font-mono" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="name">
          Your name
        </label>
        <input id="name" name="name" defaultValue={state?.values?.name} autoComplete="name" required className="field" autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          name="username"
          defaultValue={state?.values?.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </div>
      <label className="flex items-start gap-2.5 rounded-md border border-line bg-panel-2 px-3 py-2.5 text-sm">
        <input
          type="checkbox"
          name="starter"
          defaultChecked={state?.values ? state.values.starter === "on" : true}
          className="mt-0.5 accent-[var(--accent)]"
        />
        <span>
          <span className="font-medium">Load starter content</span>
          <span className="block text-ink-3">Intro logic test, practice problems, ACSL slides.</span>
        </span>
      </label>
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={pending}>
        {pending ? "Setting up…" : "Create admin account"}
      </Button>
    </form>
  );
}
