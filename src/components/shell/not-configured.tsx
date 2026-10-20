import { LogoMark } from "./logo";

export function NotConfigured() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md">
        <LogoMark size={28} className="mb-6 text-ink" />
        <h1 className="text-xl font-semibold">Connect a database</h1>
        <p className="mt-2 text-sm text-ink-2">
          This deployment has no <code className="font-mono text-[13px]">DATABASE_URL</code>. In Vercel, open the project,
          go to Storage, create a Neon Postgres database and connect it, then redeploy.
        </p>
        <ol className="mt-5 space-y-2 text-sm text-ink-2">
          <li>1. Vercel project → Storage → Create Database → Neon</li>
          <li>2. Connect it to Production and Preview</li>
          <li>3. Deployments → Redeploy</li>
        </ol>
      </div>
    </div>
  );
}
