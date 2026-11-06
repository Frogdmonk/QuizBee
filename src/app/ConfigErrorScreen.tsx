/**
 * Shown when required VITE_* variables are missing or unsafe. Kept free of
 * Motion/Router so it renders even when nothing else can.
 */
export function ConfigErrorScreen({ issues }: { issues: string[] }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6 py-12">
      <div className="w-full max-w-xl rounded-2xl border border-ink-100 bg-surface p-8 shadow-card">
        <p className="text-sm font-semibold tracking-wide text-flame-600 uppercase">Setup needed</p>
        <h1 className="mt-2 text-2xl font-extrabold">The app is not configured yet</h1>
        <p className="mt-3 text-ink-600">
          Create a <code className="rounded bg-ink-100 px-1.5 py-0.5 text-sm">.env.local</code> file from{' '}
          <code className="rounded bg-ink-100 px-1.5 py-0.5 text-sm">.env.example</code> and fill in your Supabase
          project URL and publishable key, then restart <code className="rounded bg-ink-100 px-1.5 py-0.5 text-sm">npm run dev</code>.
          On Cloudflare Pages, set the same variables in the project settings and redeploy.
        </p>
        <ul className="mt-5 space-y-2 rounded-xl bg-rose-50 p-4 text-sm text-rose-600">
          {issues.map((issue) => (
            <li key={issue} className="font-medium">
              {issue}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
