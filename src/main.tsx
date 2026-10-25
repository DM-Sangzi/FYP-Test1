import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * App bootstrap.
 *
 * In mock mode (`VITE_USE_MOCK=true`) we start the MSW Service Worker BEFORE
 * rendering so the very first API call is already intercepted (PRD §5.3).
 * In real-backend mode we skip the worker and render immediately.
 */
async function bootstrap() {
  const useMock = import.meta.env.VITE_USE_MOCK !== 'false';

  if (useMock) {
    const { worker } = await import('./api/browser');
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
      quiet: true,
    });
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
