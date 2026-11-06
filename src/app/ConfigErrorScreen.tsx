/**
 * Shown when required VITE_* variables are missing or unsafe. Kept free of
 * Motion/Router so it renders even when nothing else can.
 */
export function ConfigErrorScreen({ issues }: { issues: string[] }) {
  const code = 'rounded-xs bg-paper-sunk px-1.5 py-0.5 font-mono text-body-sm';
  return (
    <main className="min-h-dvh bg-paper px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-xl border-t-[3px] border-ink-950 pt-8">
        <p className="type-kicker">Setup needed</p>
        <h1 className="type-display mt-3 text-display-lg">The app is not configured yet</h1>
        <p className="mt-4 text-body text-ink-700">
          Create a <code className={code}>.env.local</code> file from <code className={code}>.env.example</code> and fill in
          your Supabase project URL and publishable key, then restart <code className={code}>npm run dev</code>. On
          Cloudflare Pages, set the same variables in the project settings and redeploy.
        </p>
        <ul className="relative mt-6 space-y-2 overflow-hidden rounded-sm bg-error-50 py-4 pr-4 pl-6 text-body-sm text-ink-900">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-error-600" />
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
