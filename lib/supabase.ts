import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types
export type Customer = {
  id: string;
  full_name: string;
  phone: string;
  email: string;
  id_type: string;
  id_number: string;
  address: string;
  notes: string;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  item_name: string;
  description: string;
  category: string;
  condition: string;
  cost_price: number;
  selling_price: number;
  status: string;
  customer_id: string | null;
  date_acquired: string;
  date_sold: string | null;
  serial_number: string;
  notes: string;
  created_at: string;
  customers?: Customer;
};

export type Buyback = {
  id: string;
  customer_id: string;
  inventory_id: string;
  loan_amount: number;
  interest_rate: number;
  interest_period: string;
  due_date: string;
  total_due: number;
  status: string;
  date_issued: string;
  date_closed: string | null;
  notes: string;
  created_at: string;
  customers?: Customer;
  inventory?: InventoryItem;
};

export type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role_title: string;
  employment_type: string;
  basic_salary: number;
  allowances: number;
  ssnit_number: string | null;
  bank_name: string | null;
  account_number: string | null;
  status: string;
  hire_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Payroll = {
  id: string;
  employee_id: string;
  pay_period_month: number;
  pay_period_year: number;
  basic_salary: number;
  allowances: number;
  overtime_pay: number;
  bonuses: number;
  gross_salary: number;
  net_salary: number;
  payment_date: string;
  payment_status: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employees?: Employee;
};

