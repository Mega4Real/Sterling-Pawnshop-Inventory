import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';

/**
 * Viewport config — prevents iOS Safari from auto-zooming when a text input
 * is focused (which happens when font-size < 16px). Setting maximum-scale=1
 * disables that zoom without preventing the user from manually pinch-zooming.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Sterling Pawnshop — Staff Portal',
  description: 'Professional pawnshop management system for staff and administrators',
  icons: {
    icon: [
      { url: '/favicon/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon/favicon.ico', sizes: 'any' },
    ],
    apple: [
      { url: '/favicon/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/favicon/site.webmanifest',
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
