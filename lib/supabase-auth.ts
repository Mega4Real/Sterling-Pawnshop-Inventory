/**
 * supabase-auth.ts
 * Browser-side Supabase client for authentication operations.
 * Uses @supabase/ssr so the session is stored in cookies — readable by
 * the Next.js middleware for server-side route protection.
 *
 * Use this client for: signIn, signOut, getUser
 * Use lib/supabase.ts for: all data queries (inventory, loans, customers)
 */

import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase browser client that persists the auth session in cookies.
 * Call this inside a component or hook — not at module level.
 */
export function createAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
