import type { Metadata } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'Sterling Pawnshop — Staff Portal',
  description: 'Professional pawnshop management system for staff and administrators',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/*
          AppShell renders the sidebar + main wrapper for all pages except /login.
          The /login page gets a clean, full-screen layout.
        */}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
