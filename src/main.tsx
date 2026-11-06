import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/figtree/wght.css';
import '@fontsource-variable/bricolage-grotesque/wght.css';
import './styles/index.css';
import { envResult } from '@/lib/env';
import { ConfigErrorScreen } from '@/app/ConfigErrorScreen';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');
const root = createRoot(container);

if (!envResult.ok) {
  root.render(
    <StrictMode>
      <ConfigErrorScreen issues={envResult.issues} />
    </StrictMode>,
  );
} else {
  // The router (and therefore Supabase) loads only once configuration is valid.
  void import('@/app/App').then(({ App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
  // Allow the stale-chunk auto-reload again once this version has been running a while.
  window.setTimeout(() => {
    try {
      sessionStorage.removeItem('rally.chunk-reload');
    } catch {
      /* ignore */
    }
  }, 10_000);
}
