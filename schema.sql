-- PAWNSHOP MANAGEMENT SYSTEM - SUPABASE SCHEMA
-- Run this entire file in your Supabase SQL Editor

-- Clean up existing tables (CAUTION: This will delete all data)
drop table if exists loan_payments cascade;
drop table if exists loans cascade;
drop table if exists inventory cascade;
drop table if exists customers cascade;

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- CUSTOMERS TABLE
create table customers (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  phone text,
  email text,
  id_type text, -- e.g. Ghana Card, Passport, Voter ID
  id_number text,
  address text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- INVENTORY TABLE
create table inventory (
  id uuid primary key default uuid_generate_v4(),
  item_name text not null,
  description text,
  category text, -- e.g. Electronics, Phone, Television, Refrigerator
  condition text default 'Good', -- Good, Fair, Poor
  cost_price numeric(10,2) not null,
  selling_price numeric(10,2) not null,
  status text default 'Available', -- Available, Sold, Buyback
  customer_id uuid references customers(id) on delete set null,
  date_acquired date default current_date,
  date_sold date,
  serial_number text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- LOANS (BUYBACK) TABLE
create table loans (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete set null,
  inventory_id uuid references inventory(id) on delete set null,
  loan_amount numeric(10,2) not null,
  interest_rate numeric(5,2) default 10, -- percentage per period
  interest_period text default 'Monthly', -- Daily, Weekly, Monthly
  due_date date not null,
  total_due numeric(10,2),
  status text default 'Active', -- Active, Redeemed, Forfeited, Extended
  date_issued date default current_date,
  date_closed date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- LOAN PAYMENTS TABLE
create table loan_payments (
  id uuid primary key default uuid_generate_v4(),
  loan_id uuid references loans(id) on delete cascade,
  amount numeric(10,2) not null,
  payment_date date default current_date,
  notes text,
  created_at timestamptz default now()
);

-- Auto-update updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger customers_updated_at before update on customers
  for each row execute function update_updated_at();

create trigger inventory_updated_at before update on inventory
  for each row execute function update_updated_at();

create trigger loans_updated_at before update on loans
  for each row execute function update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- Only authenticated users can read/write data.
-- The anon key is exposed in the browser, so "Allow all"
-- policies would let anyone with the key access all data.
-- ============================================================
alter table customers enable row level security;
alter table inventory enable row level security;
alter table loans enable row level security;
alter table loan_payments enable row level security;

-- Customers: authenticated users only
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

-- Inventory: authenticated users only
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

-- Loans: authenticated users only
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

-- Loan payments: authenticated users only
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
