-- ============================================================
-- RLS MIGRATION SCRIPT
-- Run this in your Supabase SQL Editor to upgrade existing
-- "Allow all" policies to auth-scoped policies.
--
-- This script is SAFE to run on an existing database —
-- it does NOT drop or recreate tables.
-- ============================================================

-- Drop the old permissive "Allow all" policies
drop policy if exists "Allow all" on customers;
drop policy if exists "Allow all" on inventory;
drop policy if exists "Allow all" on loans;
drop policy if exists "Allow all" on loan_payments;

-- Ensure RLS is enabled (idempotent)
alter table customers enable row level security;
alter table inventory enable row level security;
alter table loans enable row level security;
alter table loan_payments enable row level security;

-- ── Customers ──
create policy "Authenticated users can read customers"
  on customers for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert customers"
  on customers for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update customers"
  on customers for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete customers"
  on customers for delete
  using (auth.role() = 'authenticated');

-- ── Inventory ──
create policy "Authenticated users can read inventory"
  on inventory for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert inventory"
  on inventory for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update inventory"
  on inventory for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete inventory"
  on inventory for delete
  using (auth.role() = 'authenticated');

-- ── Loans ──
create policy "Authenticated users can read loans"
  on loans for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert loans"
  on loans for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update loans"
  on loans for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete loans"
  on loans for delete
  using (auth.role() = 'authenticated');

-- ── Loan Payments ──
create policy "Authenticated users can read loan_payments"
  on loan_payments for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert loan_payments"
  on loan_payments for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update loan_payments"
  on loan_payments for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete loan_payments"
  on loan_payments for delete
  using (auth.role() = 'authenticated');
