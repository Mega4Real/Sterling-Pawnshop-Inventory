/**
 * Sidebar.tsx
 * Main navigation sidebar for the Sterling Pawnshop staff portal.
 * Shows the logged-in user's email and a Sign Out button at the bottom.
 *
 * Accessibility:
 * - All icon-only buttons carry aria-label attributes.
 * - Active nav links are marked with aria-current="page".
 * - Desktop and mobile sign-out buttons use unique IDs to avoid duplicate-ID warnings.
 * - Mobile overlay is hidden from assistive tech when closed (aria-hidden).
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Package, Handshake, Users, Menu, X, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { createAuthClient } from '@/lib/supabase-auth';

/** Navigation items for the sidebar */
const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/buybacks', label: 'Buybacks', icon: Handshake },
  { href: '/customers', label: 'Customers', icon: Users },
];

interface SidebarContentProps {
  /**
   * Unique suffix so that each rendered instance (desktop / mobile) gets
   * its own distinct element IDs, preventing duplicate-ID accessibility errors.
   */
  instanceId: 'desktop' | 'mobile';
  path: string;
  userEmail: string | null;
  signingOut: boolean;
  onNavClick: () => void;
  onSignOut: () => void;
}

/**
 * Inner sidebar content — shared by the desktop rail and the mobile drawer.
 * Accepts an instanceId to ensure all IDs remain unique across instances.
 */
function SidebarContent({
  instanceId,
  path,
  userEmail,
  signingOut,
  onNavClick,
  onSignOut,
}: SidebarContentProps) {
  return (
    <div className="sidebar">
      {/* ── Logo ── */}
      <div className="sidebar-logo-section">
        <div className="sidebar-logo-row">
          {/* Brand mark — decorative, hidden from screen readers */}
          <div className="sidebar-logo-mark" aria-hidden="true">
            S
          </div>
          <div>
            <div className="sidebar-logo-name">Sterling</div>
            <div className="sidebar-logo-sub">Pawnshop Manager</div>
          </div>
        </div>
      </div>

      {/* ── Nav links ── */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavClick}
              className={`sidebar-nav-link${active ? ' sidebar-nav-link-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── User + Sign Out ── */}
      <div className="sidebar-footer">
        {/* Logged-in email — truncated with title tooltip for long addresses */}
        {userEmail && (
          <div className="sidebar-email" title={userEmail}>
            {userEmail}
          </div>
        )}

        {/* Sign Out button — unique ID per instance avoids duplicate-ID warnings */}
        <button
          id={`sidebar-sign-out-${instanceId}`}
          onClick={onSignOut}
          disabled={signingOut}
          className={`btn-ghost sidebar-sign-out-btn${signingOut ? ' sidebar-sign-out-btn--busy' : ''}`}
          aria-label={signingOut ? 'Signing out, please wait' : 'Sign out of your account'}
        >
          <LogOut size={14} aria-hidden="true" />
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>

        <div className="sidebar-copyright">© 2025 Sterling Pawnshop</div>
      </div>
    </div>
  );
}

/** Root sidebar component — renders both desktop rail and mobile drawer. */
export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  /** Load the current authenticated user's email on mount. */
  useEffect(() => {
    const supabase = createAuthClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  /**
   * Signs the user out via Supabase Auth and redirects to /login.
   */
  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createAuthClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <div className="hidden md:flex sidebar-desktop-wrapper">
        <SidebarContent
          instanceId="desktop"
          path={path}
          userEmail={userEmail}
          signingOut={signingOut}
          onNavClick={() => {}}
          onSignOut={handleSignOut}
        />
      </div>

      {/* ── Mobile hamburger toggle ── */}
      <div className="md:hidden sidebar-mobile-toggle">
        <button
          className="btn-ghost sidebar-mobile-toggle-btn"
          onClick={() => setOpen((prev) => !prev)}
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls="sidebar-mobile-drawer"
        >
          {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      <div
        className={`md:hidden sidebar-mobile-overlay${open ? ' sidebar-mobile-overlay--open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      >
        <div
          id="sidebar-mobile-drawer"
          className={`sidebar-mobile-drawer${open ? ' sidebar-mobile-drawer--open' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <SidebarContent
            instanceId="mobile"
            path={path}
            userEmail={userEmail}
            signingOut={signingOut}
            onNavClick={() => setOpen(false)}
            onSignOut={handleSignOut}
          />
        </div>
      </div>
    </>
  );
}
