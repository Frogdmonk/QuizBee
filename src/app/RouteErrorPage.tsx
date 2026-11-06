import { useEffect } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { LogoMark } from '@/components/ui/Logo';

const RELOAD_FLAG = 'rally.chunk-reload';

/** After a new deploy, old lazily-loaded chunks disappear from the CDN. */
function isStaleChunkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Failed to fetch dynamically/i.test(
    message,
  );
}

export function RouteErrorPage() {
  const error = useRouteError();
  const stale = isStaleChunkError(error);

  useEffect(() => {
    if (!stale) return;
    try {
      // Reload once to pick up the new deployment; avoid reload loops.
      if (!sessionStorage.getItem(RELOAD_FLAG)) {
        sessionStorage.setItem(RELOAD_FLAG, '1');
        window.location.reload();
      }
    } catch {
      /* storage unavailable — fall through to the manual button */
    }
  }, [stale]);

  const notFound = isRouteErrorResponse(error) && error.status === 404;
  const title = stale ? 'A new version is available' : notFound ? 'Page not found' : 'Something went wrong';
  const body = stale
    ? 'The app was updated while this page was open. Reload to continue.'
    : notFound
      ? 'The page you are looking for does not exist.'
      : 'An unexpected error occurred. Reloading usually fixes it.';

  if (import.meta.env.DEV && !stale) console.error(error);

  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <div className="max-w-md text-center">
        <LogoMark className="mx-auto size-12" />
        <h1 className="mt-6 text-3xl font-extrabold">{title}</h1>
        <p className="mt-2 text-ink-600">{body}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            leftIcon={<RefreshCw className="size-4" />}
            onClick={() => {
              try {
                sessionStorage.removeItem(RELOAD_FLAG);
              } catch {
                /* ignore */
              }
              window.location.reload();
            }}
          >
            Reload
          </Button>
          <ButtonLink to="/" variant="secondary" reloadDocument>
            Go home
          </ButtonLink>
        </div>
      </div>
    </main>
  );
}
