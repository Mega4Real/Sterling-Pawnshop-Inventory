/**
 * AppShell.tsx
 * Client component that conditionally renders the sidebar layout.
 *
 * Pages inside the main app (/, /inventory, /loans, /customers) get the
 * full sidebar + main content layout.
 *
 * The /login page gets no sidebar — it renders full-screen on its own.
 */

'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';

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

  // Login page renders without any chrome
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // All other pages get the sidebar + main layout
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          padding: '32px',
          overflowY: 'auto',
          maxHeight: '100vh',
        }}
      >
        {children}
      </main>
    </div>
  );
}
