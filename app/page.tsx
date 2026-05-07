'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TrendingUp, Package, Handshake, Users, AlertTriangle, DollarSign } from 'lucide-react';
import { format, isPast, isToday, addDays } from 'date-fns';
import Link from 'next/link';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalItems: 0, availableItems: 0, soldItems: 0,
    activeBuybacks: 0, overdueBuybacks: 0, dueSoonBuybacks: 0,
    totalCustomers: 0,
    stockValue: 0, potentialRevenue: 0, totalBuybackValue: 0,
  });
  const [overdueList, setOverdueList] = useState<any[]>([]);
  const [dueSoon, setDueSoon] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [inv, loans, customers] = await Promise.all([
        supabase.from('inventory').select('*'),
        supabase.from('loans').select('*, customers(full_name, phone), inventory(item_name)').eq('status', 'Active'),
        supabase.from('customers').select('id'),
      ]);

      const items = inv.data || [];
      const buybackList = loans.data || [];
      const now = new Date();
      const soon = addDays(now, 3);

      const overdue = buybackList.filter(l => isPast(new Date(l.due_date)) && !isToday(new Date(l.due_date)));
      const nearDue = buybackList.filter(l => {
        const d = new Date(l.due_date);
        return !isPast(d) && d <= soon;
      });

      setStats({
        totalItems: items.length,
        availableItems: items.filter(i => i.status === 'Available').length,
        soldItems: items.filter(i => i.status === 'Sold').length,
        activeBuybacks: buybackList.length,
        overdueBuybacks: overdue.length,
        dueSoonBuybacks: nearDue.length,
        totalCustomers: (customers.data || []).length,
        stockValue: items.filter(i => i.status === 'Available').reduce((s, i) => s + i.cost_price, 0),
        potentialRevenue: items.filter(i => i.status === 'Available').reduce((s, i) => s + i.selling_price, 0),
        totalBuybackValue: buybackList.reduce((s, l) => s + l.total_due, 0),
      });
      setOverdueList(overdue);
      setDueSoon(nearDue);
      setLoading(false);
    }
    load();
  }, []);

  const fmt = (n: number) => `GH₵ ${n.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)' }}>
      Loading dashboard…
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>{format(new Date(), 'EEEE, d MMMM yyyy')}</p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <StatCard label="Available Items" value={stats.availableItems} icon={<Package size={18} />} color="var(--gold)" />
        <StatCard label="Stock Cost Value" value={fmt(stats.stockValue)} icon={<DollarSign size={18} />} color="var(--gold)" small />
        <StatCard label="Potential Revenue" value={fmt(stats.potentialRevenue)} icon={<TrendingUp size={18} />} color="var(--success)" small />
        <StatCard label="Active Buybacks" value={stats.activeBuybacks} icon={<Handshake size={18} />} color="var(--info)" />
        <StatCard label="Buyback Value Due" value={fmt(stats.totalBuybackValue)} icon={<DollarSign size={18} />} color="var(--info)" small />
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
            <Link key={l.id} href="/buybacks" style={{ textDecoration: 'none' }}>
              <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontSize: 13 }}>{l.customers?.full_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{l.customers?.phone}</div>
                  </div>
                  <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>GH₵ {l.total_due?.toFixed(2)}</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  {l.inventory?.item_name} · Due {format(new Date(l.due_date), 'dd MMM')}
                </div>
              </div>
            </Link>
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
            <Link key={l.id} href="/buybacks" style={{ textDecoration: 'none' }}>
              <div style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ color: 'var(--text)', fontSize: 13 }}>{l.customers?.full_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{l.customers?.phone}</div>
                  </div>
                  <span style={{ color: 'var(--warning)', fontSize: 12, fontWeight: 600 }}>GH₵ {l.total_due?.toFixed(2)}</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>
                  {l.inventory?.item_name} · Due {format(new Date(l.due_date), 'dd MMM')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, small }: any) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div style={{ fontSize: small ? 18 : 28, fontWeight: 700, fontFamily: small ? 'var(--font-body)' : 'var(--font-display)', color: 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}
