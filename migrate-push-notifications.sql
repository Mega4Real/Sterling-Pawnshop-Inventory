-- ============================================================
-- PUSH SUBSCRIPTIONS TABLE
-- Run this in your Supabase SQL Editor:
--   https://supabase.com → Your Project → SQL Editor → New Query
-- ============================================================

-- Table: stores each device's Web Push subscription object
create table if not exists push_subscriptions (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  -- endpoint is unique so we can upsert (handles key rotation)
  endpoint     text        not null unique,
  -- Full PushSubscriptionJSON object: { endpoint, expirationTime, keys: { p256dh, auth } }
  subscription jsonb       not null,
  created_at   timestamptz not null default now()
);

-- Index for fast lookup by user
create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions (user_id);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table push_subscriptions enable row level security;

-- Authenticated users can read, insert, update, delete their OWN subscriptions
create policy "Users manage own push subscriptions"
  on push_subscriptions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- The service role (used by the cron job) bypasses RLS automatically in Supabase,
-- so no extra policy is needed for the cron to read all subscriptions.
