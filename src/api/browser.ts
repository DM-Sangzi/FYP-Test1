/**
 * Browser-side MSW setup (PRD §5.3).
 *
 * `setupWorker` registers the Service Worker that intercepts fetch calls.
 * The worker is started in `main.tsx` before the app renders, but only when
 * `VITE_USE_MOCK=true`.
 */
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
