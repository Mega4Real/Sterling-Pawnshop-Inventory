/**
 * app/login/page.tsx
 * Full-screen login page for Sterling Pawnshop.
 * Uses Supabase Auth (cookie-based) via createBrowserClient.
 * On success → hard redirect to / so auth cookies are fully committed
 * before the middleware session check runs.
 */

'use client';

import { useState } from 'react';
import { createAuthClient } from '@/lib/supabase-auth';
import { Lock, Mail, Eye, EyeOff, Shield } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Handles the sign-in form submission.
   * Calls Supabase Auth signInWithPassword; on success navigates to dashboard.
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    const supabase = createAuthClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (authError) {
      // Show a friendly message; don't expose Supabase internals
      setError('Invalid email or password. Please try again.');
      return;
    }

    // Auth succeeded — hard redirect to ensure the auth cookie is committed
    // to the browser before the middleware session check runs on the next request.
    window.location.href = '/';
  }

  return (
    <div className="login-page">
      {/* Decorative background orbs */}
      <div className="login-orb login-orb-1" aria-hidden="true" />
      <div className="login-orb login-orb-2" aria-hidden="true" />

      <div className="login-card">
        {/* ── Logo ── */}
        <div className="login-logo">
          <div className="login-logo-icon">
            <Shield size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div className="login-logo-name">Sterling Pawnshop</div>
            <div className="login-logo-sub">Staff Portal</div>
          </div>
        </div>

        {/* ── Heading ── */}
        <div className="login-heading">
          <h1 className="login-title">Welcome back</h1>
          <p className="login-subtitle">Sign in to access the management system</p>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div className="login-field">
            <label htmlFor="login-email" className="label">
              Email address
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <Mail size={15} />
              </span>
              <input
                id="login-email"
                type="email"
                className="input login-input"
                placeholder="you@sterling.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
          </div>

          {/* Password */}
          <div className="login-field">
            <label htmlFor="login-password" className="label">
              Password
            </label>
            <div className="login-input-wrap">
              <span className="login-input-icon">
                <Lock size={15} />
              </span>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                className="input login-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            id="login-submit"
            type="submit"
            className="btn-gold login-btn"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* ── Footer note ── */}
        <p className="login-footer-note">
          Contact your administrator to get access.
        </p>
      </div>
    </div>
  );
}
