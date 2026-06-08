'use client';
import { useEffect, useState } from 'react';
import { supabase, Customer } from '@/lib/supabase';
import { Plus, Search, X, CheckCircle, Edit2, User, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useCachedData, useMutation, invalidateCache } from '@/lib/data-cache';

const fetchCustomers = async () => {
  const { data, error } = await supabase.from('customers').select('*').order('full_name');
  if (error) throw error;
  return data || [];
};

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

const ID_TYPES = ['Ghana Card', 'Passport', 'Voter ID', 'Driver License', 'Other'];

export default function CustomersPage() {
  const { data: customers = [], isLoading: loading, refetch: refetchCustomers } = useCachedData('customers', fetchCustomers);
  const { data: inventory = [], refetch: refetchInventory } = useCachedData('inventory', fetchInventory);
  const { data: buybacks = [], refetch: refetchBuybacks } = useCachedData('buybacks', fetchBuybacks);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [form, setForm] = useState(defaultForm());

  function defaultForm() {
    return { full_name: '', phone: '', email: '', id_type: 'Ghana Card', id_number: '', address: '', notes: '' };
  }

  async function load() {
    await Promise.all([refetchCustomers(), refetchInventory(), refetchBuybacks()]);
  }

  function loadStats(customer: Customer) {
    setSelected(customer);
  }

  const customerStats = (() => {
    if (!selected) return { items: 0, activeBuybacks: 0, totalBuybacks: 0, buybacks: [] };
    const itemsList = inventory.filter(i => i.customer_id === selected.id);
    const buybacksList = buybacks.filter(b => b.customer_id === selected.id);
    return {
      items: itemsList.length,
      activeBuybacks: buybacksList.filter(l => l.status === 'Active').length,
      totalBuybacks: buybacksList.length,
      buybacks: buybacksList,
    };
  })();

  function openAdd() { setForm(defaultForm()); setEditing(null); setShowModal(true); }
  function openEdit(c: Customer) {
    setForm({ full_name: c.full_name, phone: c.phone || '', email: c.email || '', id_type: c.id_type || 'Ghana Card', id_number: c.id_number || '', address: c.address || '', notes: c.notes || '' });
    setEditing(c); setShowModal(true);
  }

  async function remove(id: string) {
    if (!confirm('Are you sure you want to delete this customer? This will fail if they have linked buybacks or inventory.')) return;
    
    const { error } = await supabase.from('customers').delete().eq('id', id);
    if (error) {
      alert(`Error deleting customer: ${error.message}`);
    } else {
      invalidateCache('customers');
      invalidateCache('inventory');
      invalidateCache('buybacks');
      await load();
      if (selected?.id === id) setSelected(null);
    }
  }

  async function save() {
    try {
      let error;
      if (editing) {
        ({ error } = await supabase.from('customers').update(form).eq('id', editing.id));
      } else {
        ({ error } = await supabase.from('customers').insert(form));
      }

      if (error) {
        console.error('Supabase Error:', error);
        alert(`Error saving customer: ${error.message}`);
        return;
      }

      invalidateCache('customers');
      invalidateCache('inventory');
      invalidateCache('buybacks');

      setShowModal(false);
      await load();
    } catch (err: any) {
      console.error('Unexpected Error:', err);
      alert(`An unexpected error occurred: ${err.message}`);
    }
  }

  const { execute: executeRemove, loading: removeLoading } = useMutation(remove);
  const { execute: executeSave, loading: saveLoading } = useMutation(save);

  const filtered = customers.filter(c =>
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.id_number || '').includes(search)
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-3xl mb-4">Customers</h1>
          <p className="text-muted">{customers.length} registered customers</p>
        </div>
        <button className="btn-gold" onClick={openAdd}><Plus size={16} /> Add Customer</button>
      </div>

      <div className="flex flex-col md:flex-row gap-16">
        {/* List */}
        <div className="flex-1">
          <div className="search-wrapper mb-16">
            <Search size={14} className="search-icon" />
            <input className="input search-input" placeholder="Search by name, phone, ID…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div className="card p-0">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Customer</th><th>Phone</th><th>ID</th><th>Since</th><th></th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="text-center text-muted p-40">Loading…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="text-center text-muted p-40">No customers found</td></tr>
                  ) : filtered.map(c => (
                    <tr key={c.id} className="pointer" onClick={() => loadStats(c)}>
                      <td>
                        <div className="flex items-center gap-10">
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <User size={14} color="var(--gold)" />
                          </div>
                          <div>
                            <div className="font-medium">{c.full_name}</div>
                            {c.email && <div className="text-muted text-sm">{c.email}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="text-muted">{c.phone || '—'}</td>
                      <td>
                        {c.id_type && <div className="text-sm text-muted">{c.id_type}</div>}
                        <div className="text-sm">{c.id_number || '—'}</div>
                      </td>
                      <td className="text-muted text-sm">{format(new Date(c.created_at), 'dd MMM yy')}</td>
                      <td>
                        <div className="flex gap-4">
                          <button className="btn-ghost p-6 text-sm" onClick={e => { e.stopPropagation(); openEdit(c); }}>
                            <Edit2 size={12} /> Edit
                          </button>
                          <button className="btn-ghost p-6 text-sm text-danger" onClick={e => { e.stopPropagation(); executeRemove(c.id); }} disabled={removeLoading}>
                            {removeLoading ? <Loader2 className="animate-spin" size={12} /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-full md:w-[280px] flex-shrink-0">
            <div className="card">
              <div className="modal-header">
                <h3 className="text-lg">{selected.full_name}</h3>
                <div className="flex gap-4">
                  <button className="btn-ghost p-4" onClick={() => executeRemove(selected.id)} disabled={removeLoading} title="Delete Customer">
                    {removeLoading ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} color="var(--danger)" />}
                  </button>
                  <button className="btn-ghost p-4" onClick={() => setSelected(null)} title="Close"><X size={14} /></button>
                </div>
              </div>
              <div className="flex flex-col gap-10">
                {[
                  { label: 'Phone', value: selected.phone },
                  { label: 'Email', value: selected.email },
                  { label: 'ID', value: selected.id_number ? `${selected.id_type}: ${selected.id_number}` : null },
                  { label: 'Address', value: selected.address },
                ].map(({ label, value }) => value ? (
                  <div key={label}>
                    <div className="text-xs text-muted text-uppercase tracking-wide">{label}</div>
                    <div className="text-sm">{value}</div>
                  </div>
                ) : null)}
              </div>
              <div className="stats-grid">
                <div className="stats-card">
                  <div className="text-xl font-bold">{customerStats.items || 0}</div>
                  <div className="text-xs text-muted">Items</div>
                </div>
                <div className="stats-card">
                  <div className="text-xl font-bold" style={{ color: customerStats.activeBuybacks ? 'var(--warning)' : 'var(--text)' }}>{customerStats.activeBuybacks || 0}</div>
                  <div className="text-xs text-muted">Active Buybacks</div>
                </div>
              </div>
              {selected.notes && (
                <div className="mt-12 p-10 text-muted text-sm" style={{ background: 'var(--bg-elevated)', borderRadius: 8 }}>
                  {selected.notes}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-xl">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
              <button className="btn-ghost p-6" onClick={() => setShowModal(false)} title="Close"><X size={16} /></button>
            </div>
            <div className="form-grid">
              <div className="full">
                <label className="label">Full Name *</label>
                <input className="input" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="e.g. Kwame Mensah" />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="e.g. 0244000000" />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="label">ID Type</label>
                <select className="input" value={form.id_type} onChange={e => setForm({ ...form, id_type: e.target.value })} title="ID Type">
                  {ID_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">ID Number</label>
                <input className="input" value={form.id_number} onChange={e => setForm({ ...form, id_number: e.target.value })} placeholder="ID number" />
              </div>
              <div className="full">
                <label className="label">Address</label>
                <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Optional" />
              </div>
              <div className="full">
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowModal(false)} disabled={saveLoading}>Cancel</button>
              <button className="btn-gold" onClick={() => executeSave()} disabled={saveLoading || !form.full_name}>
                {saveLoading ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle size={15} />} {editing ? 'Save Changes' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
