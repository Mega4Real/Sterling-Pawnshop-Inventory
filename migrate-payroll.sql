-- PAWNSHOP MANAGEMENT SYSTEM - PAYROLL MIGRATION
-- Run this script in your Supabase SQL Editor to enable Payroll & Payslip capabilities.

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- EMPLOYEES TABLE
create table if not exists employees (
  id uuid primary key default uuid_generate_v4(),
  employee_code text unique not null,
  full_name text not null,
  email text,
  phone text,
  role_title text default 'Staff',
  employment_type text default 'Full-Time', -- Full-Time, Part-Time, Contract
  basic_salary numeric(10,2) not null default 0.00,
  allowances numeric(10,2) not null default 0.00,
  ssnit_number text, -- SSNIT / TIN / Tax ID
  bank_name text,
  account_number text,
  status text default 'Active', -- Active, Inactive, Terminated
  hire_date date default current_date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- PAYROLLS (PAYSLIPS) TABLE
create table if not exists payrolls (
  id uuid primary key default uuid_generate_v4(),
  employee_id uuid references employees(id) on delete cascade not null,
  pay_period_month integer not null check (pay_period_month >= 1 and pay_period_month <= 12),
  pay_period_year integer not null check (pay_period_year >= 2000),
  basic_salary numeric(10,2) not null default 0.00,
  allowances numeric(10,2) not null default 0.00,
  overtime_pay numeric(10,2) not null default 0.00,
  bonuses numeric(10,2) not null default 0.00,
  gross_salary numeric(10,2) not null default 0.00,
  net_salary numeric(10,2) not null default 0.00,
  payment_date date default current_date,
  payment_status text default 'Paid', -- Draft, Pending, Paid
  payment_method text default 'Bank Transfer', -- Bank Transfer, Cash, Mobile Money, Check
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(employee_id, pay_period_month, pay_period_year)
);

-- Triggers for updated_at
drop trigger if exists employees_updated_at on employees;
create trigger employees_updated_at before update on employees
  for each row execute function update_updated_at();

drop trigger if exists payrolls_updated_at on payrolls;
create trigger payrolls_updated_at before update on payrolls
  for each row execute function update_updated_at();

-- ROW LEVEL SECURITY (RLS)
alter table employees enable row level security;
alter table payrolls enable row level security;

-- Employees policies (Allows both authenticated users and anon dev client access)
drop policy if exists "Authenticated users can read employees" on employees;
drop policy if exists "Allow all employees select" on employees;
create policy "Allow all employees select"
  on employees for select
  using (true);

drop policy if exists "Authenticated users can insert employees" on employees;
drop policy if exists "Allow all employees insert" on employees;
create policy "Allow all employees insert"
  on employees for insert
  with check (true);

drop policy if exists "Authenticated users can update employees" on employees;
drop policy if exists "Allow all employees update" on employees;
create policy "Allow all employees update"
  on employees for update
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete employees" on employees;
drop policy if exists "Allow all employees delete" on employees;
create policy "Allow all employees delete"
  on employees for delete
  using (true);

-- Payrolls policies (Allows both authenticated users and anon dev client access)
drop policy if exists "Authenticated users can read payrolls" on payrolls;
drop policy if exists "Allow all payrolls select" on payrolls;
create policy "Allow all payrolls select"
  on payrolls for select
  using (true);

drop policy if exists "Authenticated users can insert payrolls" on payrolls;
drop policy if exists "Allow all payrolls insert" on payrolls;
create policy "Allow all payrolls insert"
  on payrolls for insert
  with check (true);

drop policy if exists "Authenticated users can update payrolls" on payrolls;
drop policy if exists "Allow all payrolls update" on payrolls;
create policy "Allow all payrolls update"
  on payrolls for update
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete payrolls" on payrolls;
drop policy if exists "Allow all payrolls delete" on payrolls;
create policy "Allow all payrolls delete"
  on payrolls for delete
  using (true);

-- ============================================================
-- DEDUCTION REMOVAL MIGRATION
-- Run this block in Supabase SQL Editor to safely drop the
-- deduction columns from an existing database table.
-- ============================================================
alter table payrolls drop column if exists ssnit_deduction;
alter table payrolls drop column if exists tax_deduction;
alter table payrolls drop column if exists other_deductions;
alter table payrolls drop column if exists total_deductions;

-- Update net_salary = gross_salary for any existing records
update payrolls set net_salary = gross_salary where net_salary != gross_salary;
