'use client';

import { useEffect, useState } from 'react';
import { supabase, Employee, Payroll } from '@/lib/supabase';
import {
  Users,
  Wallet,
  Plus,
  Search,
  Printer,
  Calendar,
  DollarSign,
  FileText,
  Trash2,
  Edit,
  CheckCircle,
  AlertCircle,
  X,
  UserPlus,
  RefreshCw,
  TrendingUp,
  Download,
  Building,
} from 'lucide-react';
import PayslipModal from '@/components/PayslipModal';
import { useToast } from '@/components/Toast';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayrollPage() {
  const { showToast } = useToast();

  // Active Tab: 'payrolls' | 'employees'
  const [activeTab, setActiveTab] = useState<'payrolls' | 'employees'>('payrolls');

  // Data states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [editingPayroll, setEditingPayroll] = useState<Payroll | null>(null);

  const [payslipModalConfig, setPayslipModalConfig] = useState<{
    open: boolean;
    mode: 'monthly' | 'yearly';
    payroll?: Payroll | null;
    employee?: Employee | null;
    year?: number;
    yearlyPayrolls?: Payroll[];
  }>({ open: false, mode: 'monthly' });

  // Employee Form State
  const [empForm, setEmpForm] = useState({
    employee_code: '',
    full_name: '',
    email: '',
    phone: '',
    role_title: 'Sales Associate',
    employment_type: 'Full-Time',
    basic_salary: '',
    allowances: '',
    ssnit_number: '',
    bank_name: '',
    account_number: '',
    status: 'Active',
    hire_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Payroll Form State
  const [payForm, setPayForm] = useState({
    employee_id: '',
    pay_period_month: String(new Date().getMonth() + 1),
    pay_period_year: String(new Date().getFullYear()),
    basic_salary: '',
    allowances: '',
    overtime_pay: '0',
    bonuses: '0',
    payment_status: 'Paid',
    payment_method: 'Bank Transfer',
    payment_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch Employees
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .order('full_name', { ascending: true });

      if (empErr) throw empErr;
      setEmployees(empData || []);

      // Fetch Payrolls with joined Employee info
      const { data: payData, error: payErr } = await supabase
        .from('payrolls')
        .select('*, employees(*)')
        .order('pay_period_year', { ascending: false })
        .order('pay_period_month', { ascending: false });

      if (payErr) throw payErr;
      setPayrolls(payData || []);
    } catch (err: any) {
      console.error('Error loading payroll data:', err);
      showToast('error', 'Database Error', err.message || 'Failed to load payroll data from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);


  // Open Employee Modal for Create or Edit
  const handleOpenEmployeeModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmployee(emp);
      setEmpForm({
        employee_code: emp.employee_code || '',
        full_name: emp.full_name || '',
        email: emp.email || '',
        phone: emp.phone || '',
        role_title: emp.role_title || 'Staff',
        employment_type: emp.employment_type || 'Full-Time',
        basic_salary: String(emp.basic_salary || ''),
        allowances: String(emp.allowances || ''),
        ssnit_number: emp.ssnit_number || '',
        bank_name: emp.bank_name || '',
        account_number: emp.account_number || '',
        status: emp.status || 'Active',
        hire_date: emp.hire_date || new Date().toISOString().split('T')[0],
        notes: emp.notes || '',
      });
    } else {
      setEditingEmployee(null);
      // Auto-generate employee code (e.g. SPS-001)
      const nextNum = employees.length + 1;
      const code = `SPS-${String(nextNum).padStart(3, '0')}`;
      setEmpForm({
        employee_code: code,
        full_name: '',
        email: '',
        phone: '',
        role_title: 'Sales Associate',
        employment_type: 'Full-Time',
        basic_salary: '3500',
        allowances: '500',
        ssnit_number: '',
        bank_name: '',
        account_number: '',
        status: 'Active',
        hire_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
    setShowEmployeeModal(true);
  };

  // Save Employee
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.full_name || !empForm.employee_code) {
      showToast('error', 'Validation Error', 'Full name and Employee Code are required.');
      return;
    }

    const payload = {
      employee_code: empForm.employee_code.trim(),
      full_name: empForm.full_name.trim(),
      email: empForm.email.trim() || null,
      phone: empForm.phone.trim() || null,
      role_title: empForm.role_title.trim() || 'Staff',
      employment_type: empForm.employment_type,
      basic_salary: parseFloat(empForm.basic_salary) || 0,
      allowances: parseFloat(empForm.allowances) || 0,
      ssnit_number: empForm.ssnit_number.trim() || null,
      bank_name: empForm.bank_name.trim() || null,
      account_number: empForm.account_number.trim() || null,
      status: empForm.status,
      hire_date: empForm.hire_date || new Date().toISOString().split('T')[0],
      notes: empForm.notes.trim() || null,
    };

    try {
      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update(payload)
          .eq('id', editingEmployee.id);
        if (error) throw error;
        showToast('success', 'Employee Updated', 'Employee profile updated successfully.');
      } else {
        const { error } = await supabase.from('employees').insert(payload);
        if (error) throw error;
        showToast('success', 'Employee Added', 'New employee added successfully.');
      }

      setShowEmployeeModal(false);
      loadData();
    } catch (err: any) {
      console.error('Error saving employee:', err);
      showToast('error', 'Error Saving Employee', err.message || 'Failed to save employee profile.');
    }
  };

  // Open Payroll Modal for Create or Edit
  const handleOpenPayrollModal = (pay?: Payroll) => {
    if (pay) {
      setEditingPayroll(pay);
      setPayForm({
        employee_id: pay.employee_id,
        pay_period_month: String(pay.pay_period_month),
        pay_period_year: String(pay.pay_period_year),
        basic_salary: String(pay.basic_salary),
        allowances: String(pay.allowances),
        overtime_pay: String(pay.overtime_pay),
        bonuses: String(pay.bonuses),
        payment_status: pay.payment_status || 'Paid',
        payment_method: pay.payment_method || 'Bank Transfer',
        payment_date: pay.payment_date || new Date().toISOString().split('T')[0],
        notes: pay.notes || '',
      });
    } else {
      setEditingPayroll(null);
      const defaultEmp = employees[0];

      setPayForm({
        employee_id: defaultEmp ? defaultEmp.id : '',
        pay_period_month: String(selectedMonth),
        pay_period_year: String(selectedYear),
        basic_salary: String(defaultEmp ? defaultEmp.basic_salary : 0),
        allowances: String(defaultEmp ? defaultEmp.allowances : 0),
        overtime_pay: '0',
        bonuses: '0',
        payment_status: 'Paid',
        payment_method: 'Bank Transfer',
        payment_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
    setShowPayrollModal(true);
  };

  // When selected employee changes in Payroll Modal, auto-populate base values
  const handlePayrollEmployeeChange = (empId: string) => {
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setPayForm((prev) => ({
        ...prev,
        employee_id: empId,
        basic_salary: String(emp.basic_salary || 0),
        allowances: String(emp.allowances || 0),
      }));
    }
  };

  // Save Payslip Record
  const handleSavePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payForm.employee_id) {
      showToast('error', 'Validation Error', 'Please select an employee.');
      return;
    }

    const basic = parseFloat(payForm.basic_salary) || 0;
    const allow = parseFloat(payForm.allowances) || 0;
    const overtime = parseFloat(payForm.overtime_pay) || 0;
    const bonus = parseFloat(payForm.bonuses) || 0;
    const gross = basic + allow + overtime + bonus;

    const payload = {
      employee_id: payForm.employee_id,
      pay_period_month: parseInt(payForm.pay_period_month),
      pay_period_year: parseInt(payForm.pay_period_year),
      basic_salary: basic,
      allowances: allow,
      overtime_pay: overtime,
      bonuses: bonus,
      gross_salary: gross,
      net_salary: gross,
      payment_date: payForm.payment_date,
      payment_status: payForm.payment_status,
      payment_method: payForm.payment_method,
      notes: payForm.notes.trim() || null,
    };

    try {
      if (editingPayroll) {
        const { error } = await supabase
          .from('payrolls')
          .update(payload)
          .eq('id', editingPayroll.id);
        if (error) throw error;
        showToast('success', 'Payslip Updated', 'Payslip record updated successfully.');
      } else {
        const { error } = await supabase.from('payrolls').insert(payload);
        if (error) throw error;
        showToast('success', 'Payslip Generated', 'New payslip generated successfully.');
      }

      setShowPayrollModal(false);
      loadData();
    } catch (err: any) {
      console.error('Error saving payroll:', err);
      showToast('error', 'Error Saving Payslip', err.message || 'Failed to save payslip record.');
    }
  };

  // Batch Process Monthly Payroll for all Active Employees
  const handleBatchProcessPayroll = async () => {
    const activeEmps = employees.filter((e) => e.status === 'Active');
    if (activeEmps.length === 0) {
      showToast('error', 'No Active Staff', 'No active employees found to process payroll.');
      return;
    }

    if (!confirm(`Generate monthly payroll for ${activeEmps.length} active employee(s) for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}?`)) {
      return;
    }

    setLoading(true);
    try {
      const inserts = activeEmps.map((emp) => {
        const basic = emp.basic_salary || 0;
        const allow = emp.allowances || 0;
        const gross = basic + allow;

        return {
          employee_id: emp.id,
          pay_period_month: selectedMonth,
          pay_period_year: selectedYear,
          basic_salary: basic,
          allowances: allow,
          overtime_pay: 0,
          bonuses: 0,
          gross_salary: gross,
          net_salary: gross,
          payment_date: new Date().toISOString().split('T')[0],
          payment_status: 'Paid',
          payment_method: 'Bank Transfer',
        };
      });

      // Upsert payroll records (using ON CONFLICT ignore or merge)
      const { error } = await supabase.from('payrolls').upsert(inserts, {
        onConflict: 'employee_id,pay_period_month,pay_period_year',
      });

      if (error) throw error;

      showToast('success', 'Payroll Processed', `Processed ${activeEmps.length} payslip(s) for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}.`);
      loadData();
    } catch (err: any) {
      console.error('Error processing batch payroll:', err);
      showToast('error', 'Batch Processing Error', err.message || 'Failed to process monthly payroll batch.');
    } finally {
      setLoading(false);
    }
  };

  // Delete Payroll Record
  const handleDeletePayroll = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payslip record?')) return;
    try {
      const { error } = await supabase.from('payrolls').delete().eq('id', id);
      if (error) throw error;
      showToast('success', 'Payslip Deleted', 'Payslip record deleted.');
      loadData();
    } catch (err: any) {
      showToast('error', 'Delete Error', err.message || 'Failed to delete record.');
    }
  };

  // Filtered Payroll Records
  const filteredPayrolls = payrolls.filter((p) => {
    const matchesMonth = p.pay_period_month === selectedMonth;
    const matchesYear = p.pay_period_year === selectedYear;
    const matchesEmp = selectedEmployeeId === 'ALL' || p.employee_id === selectedEmployeeId;
    const empName = p.employees?.full_name || '';
    const empCode = p.employees?.employee_code || '';
    const matchesSearch =
      empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      empCode.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesMonth && matchesYear && matchesEmp && matchesSearch;
  });

  // Calculate Summary Statistics for Current Filtered Selection
  const totalGross = filteredPayrolls.reduce((sum, p) => sum + (p.gross_salary || 0), 0);
  const paidCount = filteredPayrolls.filter((p) => p.payment_status === 'Paid').length;

  // View Annual Payslip Statement for an Employee
  const handleOpenYearlyStatement = (emp: Employee) => {
    const yearlyRecords = payrolls.filter(
      (p) => p.employee_id === emp.id && p.pay_period_year === selectedYear
    );

    setPayslipModalConfig({
      open: true,
      mode: 'yearly',
      employee: emp,
      year: selectedYear,
      yearlyPayrolls: yearlyRecords,
    });
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 bg-red-50 text-red-700 rounded-xl shrink-0">
              <Wallet size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Payroll & Payslip Portal</h1>
              <p className="text-xs sm:text-sm text-slate-500">Manage employee salaries, generate monthly payslips & print annual tax statements.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
          {activeTab === 'payrolls' ? (
            <>
              <button
                onClick={handleBatchProcessPayroll}
                className="w-full sm:w-auto justify-center px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white font-medium rounded-xl text-sm shadow-sm flex items-center gap-2 transition-colors"
              >
                <RefreshCw size={16} />
                Generate Monthly Payroll
              </button>
              <button
                onClick={() => handleOpenPayrollModal()}
                className="w-full sm:w-auto justify-center px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl text-sm shadow-sm flex items-center gap-2 transition-colors"
              >
                <Plus size={16} />
                New Payslip
              </button>
            </>
          ) : (
            <button
              onClick={() => handleOpenEmployeeModal()}
              className="w-full sm:w-auto justify-center px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white font-medium rounded-xl text-sm shadow-sm flex items-center gap-2 transition-colors"
            >
              <UserPlus size={16} />
              Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto scrollbar-none whitespace-nowrap">
        <button
          onClick={() => setActiveTab('payrolls')}
          className={`pb-3 px-4 sm:px-5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
            activeTab === 'payrolls'
              ? 'border-red-700 text-red-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText size={18} />
          Payroll Records & Payslips
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`pb-3 px-4 sm:px-5 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors shrink-0 ${
            activeTab === 'employees'
              ? 'border-red-700 text-red-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users size={18} />
          Employee Directory ({employees.length})
        </button>
      </div>

      {/* PAYROLL TAB CONTENT */}
      {activeTab === 'payrolls' && (
        <div className="space-y-4 sm:space-y-6">
          {/* Controls & Filters Bar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full lg:w-auto text-xs sm:text-sm">
              {/* Month Selector */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <Calendar size={16} className="text-slate-400 shrink-0" />
                  <span className="text-slate-500 text-xs font-semibold">Month:</span>
                </div>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer text-xs sm:text-sm text-right sm:text-left"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx + 1}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Year Selector */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                <span className="text-slate-500 text-xs font-semibold">Year:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer text-xs sm:text-sm text-right sm:text-left"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Employee Filter */}
              <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <Users size={16} className="text-slate-400 shrink-0" />
                  <span className="text-slate-500 text-xs font-semibold">Staff:</span>
                </div>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="bg-transparent font-semibold text-slate-800 outline-none cursor-pointer text-xs sm:text-sm max-w-[140px] truncate"
                >
                  <option value="ALL">All Staff</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Box */}
            <div className="relative w-full lg:w-64">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-red-600 transition-colors"
              />
            </div>
          </div>

          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Payroll</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">GHS {totalGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-slate-500 mt-0.5">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
                <TrendingUp size={24} />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Net Salary Paid</p>
                <p className="text-xl sm:text-2xl font-bold text-red-700 mt-1">GHS {totalGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                <p className="text-xs text-slate-500 mt-0.5">Total Take-Home Pay</p>
              </div>
              <div className="p-3 bg-red-50 text-red-700 rounded-xl shrink-0">
                <DollarSign size={24} />
              </div>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between sm:col-span-2 lg:col-span-1">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payslips Processed</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{paidCount} / {filteredPayrolls.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">Completed Payments</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl shrink-0">
                <CheckCircle size={24} />
              </div>
            </div>
          </div>

          {/* Payroll Records Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-500">
                <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-red-700" />
                Loading payroll records...
              </div>
            ) : filteredPayrolls.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-slate-500">
                <AlertCircle size={32} className="mx-auto mb-2 text-slate-400" />
                <p className="text-base font-semibold text-slate-700">No payroll records found for {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.</p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1">Click "Generate Monthly Payroll" above to batch process payslips for active staff.</p>
              </div>
            ) : (
              <>
                {/* Mobile Card List View (visible on small screens < md) */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {filteredPayrolls.map((p) => {
                    const emp = p.employees;
                    return (
                      <div key={p.id} className="p-4 space-y-3 hover:bg-slate-50/80 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{emp?.full_name || 'Unknown Staff'}</div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">
                              {emp?.employee_code || '-'} • {emp?.role_title || 'Staff'}
                            </div>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                              p.payment_status === 'Paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                          >
                            <CheckCircle size={10} />
                            {p.payment_status || 'Paid'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Pay Period</span>
                            <span className="font-medium text-slate-700">{MONTH_NAMES[p.pay_period_month - 1]} {p.pay_period_year}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payment Method</span>
                            <span className="font-medium text-slate-700">{p.payment_method || 'Bank Transfer'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Gross Salary</span>
                            <span className="font-mono text-slate-800">GHS {p.gross_salary?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Net Pay</span>
                            <span className="font-mono font-bold text-red-700">GHS {p.net_salary?.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            {/* Print Monthly Payslip Button */}
                            <button
                              onClick={() =>
                                setPayslipModalConfig({
                                  open: true,
                                  mode: 'monthly',
                                  payroll: p,
                                  employee: emp,
                                })
                              }
                              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                            >
                              <Printer size={13} />
                              Payslip
                            </button>

                            {/* Print Annual Statement Button */}
                            {emp && (
                              <button
                                onClick={() => handleOpenYearlyStatement(emp)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                              >
                                <FileText size={13} />
                                Yearly
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleOpenPayrollModal(p)}
                              title="Edit Payslip Record"
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                            >
                              <Edit size={16} />
                            </button>

                            <button
                              onClick={() => handleDeletePayroll(p.id)}
                              title="Delete Record"
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table View (hidden on small screens < md) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[11px] tracking-wider font-semibold border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5">Employee</th>
                        <th className="px-5 py-3.5">Pay Period</th>
                        <th className="px-5 py-3.5 text-right">Gross Salary</th>
                        <th className="px-5 py-3.5 text-right">Net Pay</th>
                        <th className="px-5 py-3.5">Method</th>
                        <th className="px-5 py-3.5">Status</th>
                        <th className="px-5 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPayrolls.map((p) => {
                        const emp = p.employees;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-4">
                              <div className="font-semibold text-slate-900">{emp?.full_name || 'Unknown Staff'}</div>
                              <div className="text-xs text-slate-400 font-mono">{emp?.employee_code || '-'} • {emp?.role_title || 'Staff'}</div>
                            </td>
                            <td className="px-5 py-4 font-medium text-slate-700">
                              {MONTH_NAMES[p.pay_period_month - 1]} {p.pay_period_year}
                            </td>
                            <td className="px-5 py-4 text-right font-mono font-medium text-slate-800">
                              GHS {p.gross_salary?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-4 text-right font-mono font-bold text-red-700">
                              GHS {p.net_salary?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-5 py-4 text-xs font-medium text-slate-600">
                              {p.payment_method || 'Bank Transfer'}
                            </td>
                            <td className="px-5 py-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  p.payment_status === 'Paid'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                <CheckCircle size={12} />
                                {p.payment_status || 'Paid'}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Print Monthly Payslip Button */}
                                <button
                                  onClick={() =>
                                    setPayslipModalConfig({
                                      open: true,
                                      mode: 'monthly',
                                      payroll: p,
                                      employee: emp,
                                    })
                                  }
                                  title="Print / Download Monthly Payslip"
                                  className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                                >
                                  <Printer size={14} />
                                  Payslip
                                </button>

                                {/* Print Annual Statement Button */}
                                {emp && (
                                  <button
                                    onClick={() => handleOpenYearlyStatement(emp)}
                                    title="View Annual Tax & Salary Statement"
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                                  >
                                    <FileText size={14} />
                                    Yearly
                                  </button>
                                )}

                                <button
                                  onClick={() => handleOpenPayrollModal(p)}
                                  title="Edit Payslip Record"
                                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                  <Edit size={16} />
                                </button>

                                <button
                                  onClick={() => handleDeletePayroll(p.id)}
                                  title="Delete Record"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* EMPLOYEES TAB CONTENT */}
      {activeTab === 'employees' && (
        <div className="space-y-4 sm:space-y-6">
          <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Staff & Payroll Profiles</h2>
            <div className="relative w-full sm:w-72">
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff name, code, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-red-600 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {employees
              .filter(
                (emp) =>
                  emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  emp.employee_code.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .map((emp) => (
                <div key={emp.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4 hover:border-slate-300 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded">
                        {emp.employee_code}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 mt-1">{emp.full_name}</h3>
                      <p className="text-xs text-slate-500">{emp.role_title || 'Staff'} • {emp.employment_type}</p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase shrink-0 ${
                        emp.status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {emp.status}
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Basic Monthly Salary:</span>
                      <strong className="text-slate-800 font-mono">GHS {(emp.basic_salary || 0).toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fixed Allowances:</span>
                      <strong className="text-slate-800 font-mono">GHS {(emp.allowances || 0).toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1">
                      <span className="text-slate-500">SSNIT / Tax ID:</span>
                      <span className="font-mono text-slate-700">{emp.ssnit_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Bank & Account:</span>
                      <span className="text-slate-700 font-medium truncate max-w-[160px] text-right">{emp.bank_name ? `${emp.bank_name} (${emp.account_number || ''})` : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenYearlyStatement(emp)}
                      className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1"
                    >
                      <FileText size={14} />
                      Yearly Payslips
                    </button>

                    <button
                      onClick={() => handleOpenEmployeeModal(emp)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                    >
                      <Edit size={14} />
                      Edit Profile
                    </button>
                  </div>

                </div>
              ))}
          </div>
        </div>
      )}

      {/* CREATE / EDIT EMPLOYEE MODAL */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 my-auto">
            <div className="flex justify-between items-center px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                {editingEmployee ? 'Edit Employee Profile' : 'Add New Employee'}
              </h3>
              <button onClick={() => setShowEmployeeModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Employee Code *</label>
                  <input
                    type="text"
                    required
                    value={empForm.employee_code}
                    onChange={(e) => setEmpForm({ ...empForm, employee_code: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono focus:border-red-600 outline-none"
                    placeholder="EMP-001"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Status</label>
                  <select
                    value={empForm.status}
                    onChange={(e) => setEmpForm({ ...empForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Terminated">Terminated</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={empForm.full_name}
                  onChange={(e) => setEmpForm({ ...empForm, full_name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                  placeholder="e.g. Samuel Mensah"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Role / Designation</label>
                  <input
                    type="text"
                    value={empForm.role_title}
                    onChange={(e) => setEmpForm({ ...empForm, role_title: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                    placeholder="e.g. Pawnshop Manager"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Employment Type</label>
                  <select
                    value={empForm.employment_type}
                    onChange={(e) => setEmpForm({ ...empForm, employment_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Basic Monthly Salary (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={empForm.basic_salary}
                    onChange={(e) => setEmpForm({ ...empForm, basic_salary: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none font-mono"
                    placeholder="3500.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Monthly Allowances (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={empForm.allowances}
                    onChange={(e) => setEmpForm({ ...empForm, allowances: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none font-mono"
                    placeholder="500.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                    placeholder="024XXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">SSNIT / TIN Tax No.</label>
                  <input
                    type="text"
                    value={empForm.ssnit_number}
                    onChange={(e) => setEmpForm({ ...empForm, ssnit_number: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none font-mono"
                    placeholder="C0001234567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={empForm.bank_name}
                    onChange={(e) => setEmpForm({ ...empForm, bank_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                    placeholder="e.g. GCB Bank / Ecobank"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Account Number</label>
                  <input
                    type="text"
                    value={empForm.account_number}
                    onChange={(e) => setEmpForm({ ...empForm, account_number: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none font-mono"
                    placeholder="1234567890"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl text-sm hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-700 text-white font-medium rounded-xl text-sm hover:bg-red-800"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PAYROLL MODAL */}
      {showPayrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 my-auto">
            <div className="flex justify-between items-center px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                {editingPayroll ? 'Edit Payslip Record' : 'Generate Individual Payslip'}
              </h3>
              <button onClick={() => setShowPayrollModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSavePayroll} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[82vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Select Employee *</label>
                <select
                  required
                  value={payForm.employee_id}
                  onChange={(e) => handlePayrollEmployeeChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                >
                  <option value="" disabled>-- Select Staff Member --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name} ({emp.employee_code}) - Base: GHS {emp.basic_salary}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pay Period Month</label>
                  <select
                    value={payForm.pay_period_month}
                    onChange={(e) => setPayForm({ ...payForm, pay_period_month: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Pay Period Year</label>
                  <select
                    value={payForm.pay_period_year}
                    onChange={(e) => setPayForm({ ...payForm, pay_period_year: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Earnings Inputs */}
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-extrabold uppercase text-slate-500 tracking-wider">Earnings Breakdown (GHS)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Basic Salary</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={payForm.basic_salary}
                      onChange={(e) => setPayForm({ ...payForm, basic_salary: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg font-mono focus:border-red-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Allowances</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payForm.allowances}
                      onChange={(e) => setPayForm({ ...payForm, allowances: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg font-mono focus:border-red-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Overtime Pay</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payForm.overtime_pay}
                      onChange={(e) => setPayForm({ ...payForm, overtime_pay: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg font-mono focus:border-red-600 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Bonuses & Incentives</label>
                    <input
                      type="number"
                      step="0.01"
                      value={payForm.bonuses}
                      onChange={(e) => setPayForm({ ...payForm, bonuses: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg font-mono focus:border-red-600 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Method</label>
                  <select
                    value={payForm.payment_method}
                    onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                  >
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Mobile Money">Mobile Money</option>
                    <option value="Check">Check</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Payment Status</label>
                  <select
                    value={payForm.payment_status}
                    onChange={(e) => setPayForm({ ...payForm, payment_status: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:border-red-600 outline-none"
                  >
                    <option value="Paid">Paid</option>
                    <option value="Draft">Draft</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayrollModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-xl text-sm hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-700 text-white font-medium rounded-xl text-sm hover:bg-red-800"
                >
                  Save Payslip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYSLIP PRINT & EXPORT MODAL */}
      {payslipModalConfig.open && (
        <PayslipModal
          mode={payslipModalConfig.mode}
          payroll={payslipModalConfig.payroll}
          employee={payslipModalConfig.employee}
          year={payslipModalConfig.year}
          yearlyPayrolls={payslipModalConfig.yearlyPayrolls}
          onClose={() => setPayslipModalConfig({ open: false, mode: 'monthly' })}
        />
      )}
    </div>
  );
}
