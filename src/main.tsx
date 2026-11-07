import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/styles.css';
import './app/studio.css';

const root = document.getElementById('root');
if (!root) throw new Error('Forma requires a root element.');

const view = createRoot(root);
if (import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  view.render(<p role="status">Opening Forma…</p>);
  void Promise.all([import('./projects/ProjectApp'), import('./projects/client')]).then(([{ ProjectApp }, { configureBackend }]) => {
    const recoveryLink = new URLSearchParams(window.location.hash.slice(1)).get('type') === 'recovery';
    const backend = configureBackend(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    view.render(<StrictMode><ProjectApp backend={backend} recoveryLink={recoveryLink} /></StrictMode>);
  }).catch(() => view.render(<p role="alert">Forma could not load project storage. Reload to try again.</p>));
} else {
  view.render(<StrictMode><App /></StrictMode>);
}
