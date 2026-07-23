'use client';

import React, { useRef } from 'react';
import { Employee, Payroll } from '@/lib/supabase';
import { X, Printer, Download, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export interface PayslipModalProps {
  mode: 'monthly' | 'yearly';
  payroll?: Payroll | null;
  employee?: Employee | null;
  year?: number;
  yearlyPayrolls?: Payroll[];
  onClose: () => void;
}

export default function PayslipModal({
  mode,
  payroll,
  employee,
  year = new Date().getFullYear(),
  yearlyPayrolls = [],
  onClose,
}: PayslipModalProps) {
  const payslipRef = useRef<HTMLDivElement>(null);

  // Helper format currency
  const fmt = (val: number | undefined | null) => {
    const num = val || 0;
    return `GHS ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handlePrint = () => {
    window.print();
  };

  // PDF Generation for Single Monthly Payslip
  const handleDownloadMonthlyPDF = () => {
    if (!payroll || !employee) return;

    const doc = new jsPDF();
    const periodStr = `${MONTH_NAMES[payroll.pay_period_month - 1]} ${payroll.pay_period_year}`;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(192, 21, 42); // Brand red
    doc.text('STERLING PAWNSHOP', 14, 20);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('Official Monthly Payslip Statement', 14, 26);
    doc.text(`Pay Period: ${periodStr}`, 14, 31);
    doc.text(`Issue Date: ${payroll.payment_date || new Date().toISOString().split('T')[0]}`, 14, 36);

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.line(14, 40, 196, 40);

    // Employee Details Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 26, 46);
    doc.text('Employee Information', 14, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(`Employee Code: ${employee.employee_code || 'N/A'}`, 14, 55);
    doc.text(`Full Name: ${employee.full_name}`, 14, 61);
    doc.text(`Role / Title: ${employee.role_title || 'Staff'}`, 14, 67);
    doc.text(`Employment Type: ${employee.employment_type || 'Full-Time'}`, 14, 73);

    doc.text(`SSNIT / TIN No: ${employee.ssnit_number || 'N/A'}`, 110, 55);
    doc.text(`Bank Name: ${employee.bank_name || 'N/A'}`, 110, 61);
    doc.text(`Account No: ${employee.account_number || 'N/A'}`, 110, 67);
    doc.text(`Payment Method: ${payroll.payment_method || 'Bank Transfer'}`, 110, 73);

    // Earnings Table
    autoTable(doc, {
      startY: 80,
      head: [['Earnings Category', 'Amount (GHS)']],
      body: [
        ['Basic Salary', (payroll.basic_salary || 0).toFixed(2)],
        ['Allowances (Housing / Transport)', (payroll.allowances || 0).toFixed(2)],
        ['Overtime Pay', (payroll.overtime_pay || 0).toFixed(2)],
        ['Bonuses & Performance', (payroll.bonuses || 0).toFixed(2)],
      ],
      foot: [['Gross Earnings', (payroll.gross_salary || 0).toFixed(2)]],
      headStyles: { fillColor: [192, 21, 42], textColor: [255, 255, 255] },
      footStyles: { fillColor: [240, 240, 243], textColor: [26, 26, 46], fontStyle: 'bold' },
      theme: 'grid',
    });

    // Summary Box
    const deductionsFinalY = (doc as any).lastAutoTable.finalY + 12;
    doc.setFillColor(245, 245, 247);
    doc.rect(14, deductionsFinalY, 182, 22, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(192, 21, 42);
    doc.text('NET SALARY PAYABLE:', 20, deductionsFinalY + 14);
    doc.setFontSize(14);
    doc.text(`GHS ${(payroll.net_salary || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 120, deductionsFinalY + 14);

    // Signatures
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('____________________________', 14, deductionsFinalY + 42);
    doc.text('Authorized Signature (Employer)', 14, deductionsFinalY + 48);

    doc.text('____________________________', 120, deductionsFinalY + 42);
    doc.text('Employee Signature & Date', 120, deductionsFinalY + 48);

    doc.save(`Payslip_${employee.full_name.replace(/\s+/g, '_')}_${periodStr.replace(/\s+/g, '_')}.pdf`);
  };

  // PDF Generation for Annual Statement
  const handleDownloadYearlyPDF = () => {
    if (!employee) return;

    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(192, 21, 42);
    doc.text('STERLING PAWNSHOP', 14, 18);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`ANNUAL PAYROLL & SALARY STATEMENT - TAX YEAR ${year}`, 14, 24);
    doc.text(`Employee: ${employee.full_name} (${employee.employee_code || 'N/A'}) | Role: ${employee.role_title || 'Staff'}`, 14, 29);

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 33, 283, 33);

    // Build 12 months data table
    const tableBody = [];
    let totBasic = 0, totAllow = 0, totGross = 0, totNet = 0;

    for (let m = 1; m <= 12; m++) {
      const rec = yearlyPayrolls.find((p) => p.pay_period_month === m);
      const basic = rec?.basic_salary || 0;
      const allow = rec?.allowances || 0;
      const gross = rec?.gross_salary || 0;
      const net = rec?.net_salary || 0;

      totBasic += basic;
      totAllow += allow;
      totGross += gross;
      totNet += net;

      tableBody.push([
        MONTH_NAMES[m - 1],
        rec ? (rec.payment_status || 'Paid') : 'Unprocessed',
        basic ? basic.toFixed(2) : '-',
        allow ? allow.toFixed(2) : '-',
        gross ? gross.toFixed(2) : '-',
        net ? net.toFixed(2) : '-',
      ]);
    }

    autoTable(doc, {
      startY: 38,
      head: [['Month', 'Status', 'Basic (GHS)', 'Allowances', 'Gross Pay', 'Net Salary']],
      body: tableBody,
      foot: [[
        'YTD TOTALS',
        '-',
        totBasic.toFixed(2),
        totAllow.toFixed(2),
        totGross.toFixed(2),
        totNet.toFixed(2)
      ]],
      headStyles: { fillColor: [192, 21, 42], textColor: [255, 255, 255] },
      footStyles: { fillColor: [240, 240, 243], textColor: [26, 26, 46], fontStyle: 'bold' },
      theme: 'grid',
    });

    doc.save(`Annual_Statement_${employee.full_name.replace(/\s+/g, '_')}_${year}.pdf`);
  };

  // Excel export for yearly summary
  const handleExportYearlyExcel = () => {
    if (!employee) return;

    const dataRows = yearlyPayrolls.map((p) => ({
      Month: MONTH_NAMES[p.pay_period_month - 1],
      Year: p.pay_period_year,
      Employee: employee.full_name,
      'Employee Code': employee.employee_code,
      'Basic Salary': p.basic_salary,
      Allowances: p.allowances,
      'Overtime Pay': p.overtime_pay,
      Bonuses: p.bonuses,
      'Gross Salary': p.gross_salary,
      'Net Salary': p.net_salary,
      'Payment Status': p.payment_status,
      'Payment Method': p.payment_method,
      'Payment Date': p.payment_date,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, `Payroll_${year}`);
    XLSX.writeFile(workbook, `Payroll_Summary_${employee.full_name.replace(/\s+/g, '_')}_${year}.xlsx`);
  };

  // Calculate annual YTD totals for yearly mode
  const ytdTotals = yearlyPayrolls.reduce(
    (acc, p) => {
      acc.basic += p.basic_salary || 0;
      acc.allowances += p.allowances || 0;
      acc.gross += p.gross_salary || 0;
      acc.net += p.net_salary || 0;
      return acc;
    },
    { basic: 0, allowances: 0, gross: 0, net: 0 }
  );

  const emp = employee || payroll?.employees;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto modal-backdrop">
      <div className="bg-white text-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[92vh] flex flex-col overflow-hidden printable-area my-auto">
        {/* Modal Toolbar (hidden during print) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 bg-slate-50 no-print">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-base sm:text-lg text-slate-900 truncate">
              {mode === 'monthly' ? 'Monthly Employee Payslip' : `Annual Salary Statement (${year})`}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
            >
              <Printer size={15} />
              Print
            </button>

            {mode === 'monthly' ? (
              <button
                onClick={handleDownloadMonthlyPDF}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
              >
                <Download size={15} />
                PDF
              </button>
            ) : (
              <>
                <button
                  onClick={handleDownloadYearlyPDF}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
                >
                  <Download size={15} />
                  PDF Statement
                </button>
                <button
                  onClick={handleExportYearlyExcel}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
                >
                  <FileSpreadsheet size={15} />
                  Excel
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors ml-auto sm:ml-0"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Printable Content Body */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-white printable-payslip" ref={payslipRef}>
          {mode === 'monthly' && payroll && emp && (
            <div className="space-y-4 sm:space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 pb-4 sm:pb-5 gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-red-700 tracking-tight">STERLING PAWNSHOP</h1>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Staff Management & Payroll Division</p>
                  <p className="text-xs text-slate-400">Accra, Ghana</p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="inline-block bg-red-50 text-red-800 text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full border border-red-200 uppercase tracking-wider mb-1.5">
                    Official Payslip
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-slate-800">
                    Period: {MONTH_NAMES[payroll.pay_period_month - 1]} {payroll.pay_period_year}
                  </p>
                  <p className="text-xs text-slate-500">
                    Payment Date: {payroll.payment_date || new Date().toISOString().split('T')[0]}
                  </p>
                </div>
              </div>

              {/* Employee & Bank Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 text-xs sm:text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">Employee Details</p>
                  <div className="space-y-1">
                    <p><span className="text-slate-500 font-medium">Full Name:</span> <strong className="text-slate-900">{emp.full_name}</strong></p>
                    <p><span className="text-slate-500 font-medium">Employee ID:</span> <span className="font-mono text-slate-700">{emp.employee_code}</span></p>
                    <p><span className="text-slate-500 font-medium">Designation:</span> {emp.role_title || 'Staff'}</p>
                    <p><span className="text-slate-500 font-medium">Employment:</span> {emp.employment_type || 'Full-Time'}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400 tracking-wider mb-1.5">Tax & Payment Info</p>
                  <div className="space-y-1">
                    <p><span className="text-slate-500 font-medium">SSNIT / TIN:</span> <span className="font-mono">{emp.ssnit_number || 'N/A'}</span></p>
                    <p><span className="text-slate-500 font-medium">Bank Name:</span> {emp.bank_name || 'N/A'}</p>
                    <p><span className="text-slate-500 font-medium">Account No:</span> <span className="font-mono">{emp.account_number || 'N/A'}</span></p>
                    <p><span className="text-slate-500 font-medium">Method:</span> <span className="font-medium text-slate-800">{payroll.payment_method || 'Bank Transfer'}</span></p>
                  </div>
                </div>
              </div>

              {/* Earnings Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="bg-slate-800 text-white font-semibold text-xs uppercase px-4 py-2.5 tracking-wider">
                  Earnings Breakdown
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-4 py-2.5 text-slate-600">Basic Salary</td>
                        <td className="px-4 py-2.5 text-right font-medium">{fmt(payroll.basic_salary)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-slate-600">Allowances</td>
                        <td className="px-4 py-2.5 text-right font-medium">{fmt(payroll.allowances)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-slate-600">Overtime Pay</td>
                        <td className="px-4 py-2.5 text-right font-medium">{fmt(payroll.overtime_pay)}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 text-slate-600">Bonuses & Incentives</td>
                        <td className="px-4 py-2.5 text-right font-medium">{fmt(payroll.bonuses)}</td>
                      </tr>
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-900">
                      <tr>
                        <td className="px-4 py-3">Gross Salary</td>
                        <td className="px-4 py-3 text-right text-emerald-700">{fmt(payroll.gross_salary)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Net Pay Callout */}
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between text-center sm:text-left gap-2">
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-red-800">Total Salary Payable</span>
                  <p className="text-xs text-slate-500">Total Earnings for Pay Period</p>
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-red-700 tracking-tight">
                  {fmt(payroll.net_salary)}
                </div>
              </div>

              {payroll.notes && (
                <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <strong>Notes / Remarks:</strong> {payroll.notes}
                </div>
              )}

              {/* Signatures */}
              <div className="pt-6 sm:pt-10 grid grid-cols-2 gap-4 sm:gap-12 text-center text-xs text-slate-500">
                <div>
                  <div className="border-b border-slate-300 mb-2 h-8"></div>
                  <p className="font-semibold text-slate-700">Authorized Signature (Employer)</p>
                  <p className="text-slate-400 text-[10px] sm:text-xs">Sterling Pawnshop Management</p>
                </div>
                <div>
                  <div className="border-b border-slate-300 mb-2 h-8"></div>
                  <p className="font-semibold text-slate-700">Employee Signature & Date</p>
                  <p className="text-slate-400 text-[10px] sm:text-xs">Received & Verified</p>
                </div>
              </div>
            </div>
          )}

          {mode === 'yearly' && emp && (
            <div className="space-y-4 sm:space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start border-b border-slate-200 pb-4 sm:pb-5 gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-red-700 tracking-tight">STERLING PAWNSHOP</h1>
                  <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Annual Salary & Tax Statement</p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="inline-block bg-slate-800 text-white text-[11px] sm:text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-1">
                    Tax Year {year}
                  </div>
                  <p className="text-xs text-slate-500">Generated: {new Date().toLocaleDateString('en-GB')}</p>
                </div>
              </div>

              {/* Employee Summary Card */}
              <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 text-xs sm:text-sm gap-3">
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400 tracking-wider">Employee Name</p>
                  <p className="font-bold text-slate-900 text-sm sm:text-base">{emp.full_name}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400 tracking-wider">Employee Code</p>
                  <p className="font-mono text-slate-800 font-semibold">{emp.employee_code}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400 tracking-wider">Designation</p>
                  <p className="text-slate-800 font-medium">{emp.role_title || 'Staff'}</p>
                </div>
                <div>
                  <p className="text-[10px] sm:text-xs font-semibold uppercase text-slate-400 tracking-wider">SSNIT / TIN No.</p>
                  <p className="font-mono text-slate-800">{emp.ssnit_number || 'N/A'}</p>
                </div>
              </div>

              {/* 12-Month Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left min-w-[550px]">
                    <thead className="bg-slate-800 text-white uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-3 py-3">Month</th>
                        <th className="px-3 py-3">Status</th>
                        <th className="px-3 py-3 text-right">Basic Salary</th>
                        <th className="px-3 py-3 text-right">Allowances</th>
                        <th className="px-3 py-3 text-right">Gross Pay</th>
                        <th className="px-3 py-3 text-right">Net Salary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                        const rec = yearlyPayrolls.find((p) => p.pay_period_month === m);
                        return (
                          <tr key={m} className={rec ? 'hover:bg-slate-50' : 'bg-slate-50/50 text-slate-400'}>
                            <td className="px-3 py-2.5 font-medium">{MONTH_NAMES[m - 1]}</td>
                            <td className="px-3 py-2.5">
                              {rec ? (
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {rec.payment_status || 'Paid'}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-500">
                                  Not Processed
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono">{rec ? fmt(rec.basic_salary) : '-'}</td>
                            <td className="px-3 py-2.5 text-right font-mono">{rec ? fmt(rec.allowances) : '-'}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-medium text-slate-900">{rec ? fmt(rec.gross_salary) : '-'}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">{rec ? fmt(rec.net_salary) : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900">
                      <tr>
                        <td className="px-3 py-3" colSpan={2}>YTD ANNUAL TOTALS</td>
                        <td className="px-3 py-3 text-right font-mono">{fmt(ytdTotals.basic)}</td>
                        <td className="px-3 py-3 text-right font-mono">{fmt(ytdTotals.allowances)}</td>
                        <td className="px-3 py-3 text-right font-mono text-emerald-800">{fmt(ytdTotals.gross)}</td>
                        <td className="px-3 py-3 text-right font-mono text-red-700 text-sm">{fmt(ytdTotals.net)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Signatures */}
              <div className="pt-6 sm:pt-8 grid grid-cols-2 gap-4 sm:gap-12 text-center text-xs text-slate-500">
                <div>
                  <div className="border-b border-slate-300 mb-2 h-8"></div>
                  <p className="font-semibold text-slate-700">Prepared By (Finance Dept)</p>
                </div>
                <div>
                  <div className="border-b border-slate-300 mb-2 h-8"></div>
                  <p className="font-semibold text-slate-700">Approved By (Pawnshop Manager)</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
