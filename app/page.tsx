'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format, isPast, isToday, addDays } from 'date-fns';
import Link from 'next/link';
import { TrendingUp, Package, Handshake, Users, AlertTriangle, DollarSign, MessageSquare, Loader2, Check } from 'lucide-react';
import { sendBuybackReminderAction, sendBuybackForfeitureAction } from '@/app/buybacks/sms-actions';
import { useToast } from '@/components/Toast';
import { useCachedData } from '@/lib/data-cache';

// Fetcher functions for cache mapping
const fetchInventory = async () => {
  const { data, error } = await supabase.from('inventory').select('*, customers(full_name)').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

const fetchBuybacks = async () => {
  const { data, error } = await supabase.from('loans')
    .select('*, customers(full_name, phone), inventory(item_name, category)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

const fetchCustomers = async () => {
  const { data, error } = await supabase.from('customers').select('*').order('full_name');
  if (error) throw error;
  return data || [];
};

export default function Dashboard() {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const { showToast } = useToast();

  // Load from client data cache
  const { data: items = [], isLoading: isLoadingInv } = useCachedData('inventory', fetchInventory);
  const { data: rawBuybackList = [], isLoading: isLoadingLoans } = useCachedData('buybacks', fetchBuybacks);
  const { data: customers = [], isLoading: isLoadingCust } = useCachedData('customers', fetchCustomers);

  const loading = isLoadingInv || isLoadingLoans || isLoadingCust;

  // Deriving stats directly from cached data
  const now = new Date();
  const soon = addDays(now, 3);

  const buybackList = rawBuybackList.filter(l => l.status === 'Active');

  const overdueList = buybackList.filter(l => isPast(new Date(l.due_date)) && !isToday(new Date(l.due_date)));
  const dueSoon = buybackList.filter(l => {
    const d = new Date(l.due_date);
    return !isPast(d) && d <= soon;
  });

  const stats = {
    totalItems: items.length,
    availableItems: items.filter(i => i.status === 'Available').length,
    soldItems: items.filter(i => i.status === 'Sold').length,
    activeBuybacks: buybackList.length,
    overdueBuybacks: overdueList.length,
    dueSoonBuybacks: dueSoon.length,
    totalCustomers: customers.length,
    stockValue: items.filter(i => i.status === 'Available').reduce((s, i) => s + i.cost_price, 0),
    potentialRevenue: items.filter(i => i.status === 'Available').reduce((s, i) => s + i.selling_price, 0),
    totalBuybackValue: buybackList.reduce((s, l) => s + l.total_due, 0),
  };

  const handleSendMessage = async (loanId: string, type: 'reminder' | 'forfeiture') => {
    setSendingId(loanId);
    try {
      const action = type === 'reminder' ? sendBuybackReminderAction : sendBuybackForfeitureAction;
      const result = await action(loanId);

      if (result.success) {
        showToast('success', 'Message Sent', `SMS ${type} notice has been sent successfully.`);
        setSentIds(prev => new Set(prev).add(loanId));
      } else {
        showToast('error', 'Send Failed', result.message || 'Could not send SMS.');
      }
    } catch (err) {
      showToast('error', 'Error', 'An unexpected error occurred.');
    } finally {
      setSendingId(null);
    }
  };

  const fmt = (n: number) => `GH₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
      Loading dashboard…
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-2xl sm:text-3xl mb-1 sm:mb-4">Dashboard</h1>
          <p className="text-muted text-xs sm:text-sm">{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
        </div>
      </div>

      {/* Stat cards - 1 column on mobile, 2 on sm, 3 on md, 4 on lg */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard label="Available Items" value={stats.availableItems} icon={<Package size={18} />} color="var(--gold)" />
        <StatCard label="Stock Cost" value={fmt(stats.stockValue)} icon={<DollarSign size={18} />} color="var(--gold)" small />
        <StatCard label="Potential Revenue" value={fmt(stats.potentialRevenue)} icon={<TrendingUp size={18} />} color="var(--success)" small />
        <StatCard label="Active Buybacks" value={stats.activeBuybacks} icon={<Handshake size={18} />} color="var(--info)" />
        <StatCard label="Buyback Value" value={fmt(stats.totalBuybackValue)} icon={<DollarSign size={18} />} color="var(--info)" small />
        <StatCard label="Customers" value={stats.totalCustomers} icon={<Users size={18} />} color="var(--text-muted)" />
      </div>

      {/* Alerts */}
      <div className="grid md:grid-cols-2 gap-16">
        {/* Overdue */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={16} color="var(--danger)" />
            <h3 style={{ fontSize: 15 }}>Overdue Buybacks ({stats.overdueBuybacks})</h3>
          </div>
          {overdueList.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No overdue buybacks 🎉</p>
          ) : overdueList.map(l => (
            <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <Link href="/buybacks" style={{ textDecoration: 'none', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{l.customers?.full_name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{l.customers?.phone}</div>
                    </div>
                    <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>GH₵ {l.total_due?.toFixed(2)}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    {l.inventory?.item_name} · Due {format(new Date(l.due_date), 'dd MMM')}
                  </div>
                </Link>
                <button
                  onClick={() => handleSendMessage(l.id, 'forfeiture')}
                  disabled={sendingId === l.id}
                  className="btn-ghost"
                  style={{ 
                    padding: '6px', 
                    minWidth: 'auto', 
                    border: 'none', 
                    background: sentIds.has(l.id) ? 'rgba(22, 163, 74, 0.1)' : 'var(--red-tint)', 
                    color: sentIds.has(l.id) ? 'var(--success)' : 'var(--red)' 
                  }}
                  title={sentIds.has(l.id) ? "Notice Sent" : "Send Forfeiture Notice"}
                >
                  {sendingId === l.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : sentIds.has(l.id) ? (
                    <Check size={14} />
                  ) : (
                    <MessageSquare size={14} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Due soon */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <AlertTriangle size={16} color="var(--warning)" />
            <h3 style={{ fontSize: 15 }}>Due in 3 Days ({stats.dueSoonBuybacks})</h3>
          </div>
          {dueSoon.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nothing due soon</p>
          ) : dueSoon.map(l => (
            <div key={l.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <Link href="/buybacks" style={{ textDecoration: 'none', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 500 }}>{l.customers?.full_name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{l.customers?.phone}</div>
                    </div>
                    <span style={{ color: 'var(--warning)', fontSize: 12, fontWeight: 600 }}>GH₵ {l.total_due?.toFixed(2)}</span>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                    {l.inventory?.item_name} · Due {format(new Date(l.due_date), 'dd MMM')}
                  </div>
                </Link>
                <button
                  onClick={() => handleSendMessage(l.id, 'reminder')}
                  disabled={sendingId === l.id}
                  className="btn-ghost"
                  style={{ 
                    padding: '6px', 
                    minWidth: 'auto', 
                    border: 'none', 
                    background: sentIds.has(l.id) ? 'rgba(22, 163, 74, 0.1)' : 'rgba(217, 119, 6, 0.1)', 
                    color: sentIds.has(l.id) ? 'var(--success)' : 'var(--warning)' 
                  }}
                  title={sentIds.has(l.id) ? "Reminder Sent" : "Send Reminder SMS"}
                >
                  {sendingId === l.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : sentIds.has(l.id) ? (
                    <Check size={14} />
                  ) : (
                    <MessageSquare size={14} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, small }: any) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div style={{ fontSize: small ? 14 : 20, fontWeight: 700, fontFamily: small ? 'var(--font-body)' : 'var(--font-display)', color: 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}
