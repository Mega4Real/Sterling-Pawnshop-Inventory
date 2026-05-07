/**
 * Sidebar.tsx
 * Main navigation sidebar for the Sterling Pawnshop staff portal.
 * Shows the logged-in user's email and a Sign Out button at the bottom.
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
  { href: '/loans', label: 'Buybacks / Loans', icon: Handshake },
  { href: '/customers', label: 'Customers', icon: Users },
];

export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  /** Load the current authenticated user's email on mount */
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

  /** Inner sidebar content — shared by desktop and mobile drawer */
  const SidebarContent = () => (
    <div
      style={{
        width: 220,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 0',
        minHeight: '100vh',
        flexShrink: 0,
      }}
    >
      {/* ── Logo ── */}
      <div
        style={{
          padding: '0 20px 28px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, var(--red), var(--red-dim))',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              color: '#ffffff',
              fontSize: 18,
              boxShadow: '0 2px 8px rgba(192,21,42,0.3)',
            }}
          >
            S
          </div>
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text)',
              }}
            >
              Sterling
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Pawnshop Manager
            </div>
          </div>
        </div>
      </div>

      {/* ── Nav links ── */}
      <nav
        style={{
          flex: 1,
          padding: '0 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
        }}
      >
        {nav.map(({ href, label, icon: Icon }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                background: active ? 'var(--red-tint)' : 'transparent',
                color: active ? 'var(--red)' : 'var(--text-muted)',
                fontWeight: active ? 600 : 400,
                fontSize: 14,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* ── User + Sign Out ── */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Logged-in email */}
        {userEmail && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={userEmail}
          >
            {userEmail}
          </div>
        )}

        {/* Sign Out button */}
        <button
          id="sidebar-sign-out"
          onClick={handleSignOut}
          disabled={signingOut}
          className="btn-ghost"
          style={{
            width: '100%',
            justifyContent: 'center',
            fontSize: 13,
            padding: '7px 12px',
            color: signingOut ? 'var(--text-dim)' : 'var(--text-muted)',
          }}
        >
          <LogOut size={14} />
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>

        <div style={{ fontSize: 10, color: 'var(--text-dim)', textAlign: 'center' }}>
          © 2025 Sterling Pawnshop
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex" style={{ position: 'sticky', top: 0, height: '100vh' }}>
        <SidebarContent />
      </div>

      {/* Mobile hamburger toggle */}
      <div className="md:hidden" style={{ position: 'fixed', top: 16, left: 16, zIndex: 200 }}>
        <button className="btn-ghost" style={{ padding: 8 }} onClick={() => setOpen(!open)}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 150 }}
          onClick={() => setOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', left: 0, top: 0, bottom: 0 }}>
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
