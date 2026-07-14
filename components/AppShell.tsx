/**
 * AppShell.tsx
 * Client component that conditionally renders the sidebar layout.
 *
 * Pages inside the main app (/, /inventory, /loans, /customers) get the
 * full sidebar + main content layout.
 *
 * The /login page gets no sidebar — it renders full-screen on its own.
 *
 * Also triggers a notification check on app load (throttled to once per hour)
 * so staff receive push notifications for due/overdue buybacks without
 * relying solely on the Vercel cron job.
 */

'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import { ToastProvider } from './Toast';

/** Minimum interval (ms) between notification checks — 1 hour. */
const NOTIFY_THROTTLE_MS = 60 * 60 * 1000;

/**
 * Calls /api/notify-due in the background so the server can send push
 * notifications for overdue / due-soon loans.  Throttled via localStorage
 * so it runs at most once per hour per device.
 */
function triggerNotificationCheck() {
  try {
    const lastCheck = localStorage.getItem('notify-due-last');
    const now = Date.now();

    if (lastCheck && now - Number(lastCheck) < NOTIFY_THROTTLE_MS) {
      return; // Already checked recently
    }

    localStorage.setItem('notify-due-last', String(now));

    // Fire-and-forget — we don't need the response in the UI
    fetch('/api/notify-due').catch(() => {
      // Silently ignore network errors
    });
  } catch {
    // localStorage may be unavailable in some contexts — safe to ignore
  }
}

interface AppShellProps {
  /** The page content rendered by Next.js */
  children: React.ReactNode;
}

/**
 * AppShell wraps the root layout children and decides whether to show
 * the sidebar navigation based on the current pathname.
 */
export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  // Trigger a notification check whenever a logged-in user opens the app
  useEffect(() => {
    if (pathname !== '/login') {
      triggerNotificationCheck();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Login page renders without any chrome
  if (pathname === '/login') {
    return (
      <ToastProvider>
        {children}
      </ToastProvider>
    );
  }

  // All other pages get the sidebar + main layout
  return (
    <ToastProvider>
      <div className="flex" style={{ minHeight: '100vh' }}>
        <Sidebar />
        <main
          className="app-container flex-1"
          style={{
            overflowY: 'auto',
            maxHeight: '100vh',
          }}
        >
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}

