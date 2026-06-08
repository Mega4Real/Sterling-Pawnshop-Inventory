'use client';
import { useEffect, useState } from 'react';
import { supabase, Buyback, Customer, InventoryItem } from '@/lib/supabase';
import { Plus, Search, X, CheckCircle, AlertTriangle, Trash2, Edit2, MessageSquare, Check, Loader2 } from 'lucide-react';
import { format, isPast, isToday, differenceInDays, addDays, addMonths } from 'date-fns';
import { sendBuybackReminderAction, sendBuybackForfeitureAction } from './sms-actions';
import { useToast } from '@/components/Toast';
import { useCachedData, useMutation, invalidateCache } from '@/lib/data-cache';

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

const fetchInventory = async () => {
  const { data, error } = await supabase.from('inventory').select('*, customers(full_name)').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

const PERIODS = ['1 Week', '2 Weeks', '3 Weeks', '1 Month', '2 Months'];
const STATUSES = ['Active', 'Redeemed', 'Forfeited', 'Extended'];

export default function BuybacksPage() {
  const { data: buybacks = [], isLoading: isLoadingBuybacks, refetch: refetchBuybacks } = useCachedData('buybacks', fetchBuybacks);
  const { data: customers = [], refetch: refetchCustomers } = useCachedData('customers', fetchCustomers);
  const { data: rawInventory = [], isLoading: isLoadingInv, refetch: refetchInventory } = useCachedData('inventory', fetchInventory);

  const loading = isLoadingBuybacks || isLoadingInv;

  const inventory = rawInventory
    .filter(i => ['Available', 'Buyback'].includes(i.status))
    .sort((a, b) => a.item_name.localeCompare(b.item_name));

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Active');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Buyback | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [smsLoan, setSmsLoan] = useState<Buyback | null>(null);
  const [sendingSmsId, setSendingSmsId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState(defaultForm());
  const { showToast } = useToast();

  function calculateDueDate(startDate: string, period: string) {
    if (!startDate) return '';
    const base = new Date(startDate);
    let days = 30;
    if (period === '1 Week') days = 7;
    else if (period === '2 Weeks') days = 14;
    else if (period === '3 Weeks') days = 21;
    else if (period === '1 Month') days = 30;
    else if (period === '2 Months') days = 60;
    return format(addDays(base, days), 'yyyy-MM-dd');
  }

  function defaultForm() {
    const today = format(new Date(), 'yyyy-MM-dd');
    return {
      customer_id: '', inventory_id: '', loan_amount: '',
      interest_rate: '10', interest_period: '1 Month',
      due_date: calculateDueDate(today, '1 Month'), notes: '', status: 'Active',
      total_due: '', date_issued: today,
      isNewCustomer: false, newCustomerName: '', newCustomerPhone: ''
    };
  }

  async function load() {
    await Promise.all([refetchBuybacks(), refetchCustomers(), refetchInventory()]);
  }

  function openAdd() {
    setForm(defaultForm());
    setEditing(null);
    setShowModal(true);
  }

  function openEdit(buyback: Buyback) {
    setForm({
      customer_id: buyback.customer_id,
      inventory_id: buyback.inventory_id || '',
      loan_amount: String(buyback.loan_amount),
      interest_rate: String(buyback.interest_rate),
      interest_period: buyback.interest_period,
      due_date: buyback.due_date,
      notes: buyback.notes || '',
      status: buyback.status,
      total_due: String(buyback.total_due),
      date_issued: buyback.date_issued || format(new Date(buyback.created_at), 'yyyy-MM-dd'),
      isNewCustomer: false,
      newCustomerName: '',
      newCustomerPhone: ''
    });
    setEditing(buyback);
    setShowModal(true);
  }



  async function save() {
    try {
      let finalCustomerId = form.customer_id;
      let createdNewCustomer = false;

      // Create new customer if needed
      if (form.isNewCustomer) {
        if (!form.newCustomerName) {
          showToast('error', 'Required Field', 'Please enter the customer name');
          return;
        }
        const { data: newCust, error: custError } = await supabase.from('customers').insert({
          full_name: form.newCustomerName,
          phone: form.newCustomerPhone
        }).select().single();

        if (custError) {
          showToast('error', 'Database Error', `Error creating customer: ${custError.message}`);
          return;
        }
        finalCustomerId = newCust.id;
        createdNewCustomer = true;
      }

      const payload = {
        customer_id: finalCustomerId,
        inventory_id: form.inventory_id || null,
        loan_amount: parseFloat(form.loan_amount),
        interest_rate: parseFloat(form.interest_rate),
        interest_period: form.interest_period,
        due_date: form.due_date,
        total_due: parseFloat(form.total_due),
        status: form.status,
        notes: form.notes,
        date_issued: form.date_issued,
      };
      
      let error;
      if (editing) {
        ({ error } = await supabase.from('loans').update(payload).eq('id', editing.id));
      } else {
        ({ error } = await supabase.from('loans').insert(payload));
      }

      if (error) {
        console.error('Buyback Error:', error);
        showToast('error', 'Save Failed', error.message);
        return;
      }

      // Mark item as Buyback
      if (form.inventory_id) {
        const { error: invError } = await supabase.from('inventory').update({ status: 'Buyback' }).eq('id', form.inventory_id);
        if (invError) {
          console.error('Inventory Update Error:', invError);
          showToast('info', 'Note', `Buyback created, but failed to update item status: ${invError.message}`);
        }
      }

      invalidateCache('buybacks');
      invalidateCache('inventory');
      if (createdNewCustomer) {
        invalidateCache('customers');
      }

      showToast('success', editing ? 'Updated' : 'Created', editing ? 'Buyback updated successfully.' : 'New buyback created successfully.');

      setShowModal(false);
      await load();
    } catch (err: any) {
      console.error('Unexpected Error:', err);
      alert(`An unexpected error occurred: ${err.message}`);
    }
  }

  async function remove() {
    if (!deleteConfirmId) return;
    
    try {
      // Find the loan first to get the inventory_id
      const { data: loan } = await supabase.from('loans').select('inventory_id').eq('id', deleteConfirmId).single();
      
      if (loan?.inventory_id) {
        // Deleting the inventory item will also delete the loan (if cascade is set)
        // or we delete both for absolute certainty and "vice versa" behavior
        const { error: invError } = await supabase.from('inventory').delete().eq('id', loan.inventory_id);
        if (invError) {
          showToast('error', 'Delete Failed', `Error deleting associated inventory item: ${invError.message}`);
          return;
        }
      }
      
      // Delete the loan itself (redundant if inventory delete cascades, but safe)
      const { error } = await supabase.from('loans').delete().eq('id', deleteConfirmId);
      if (error) {
        showToast('error', 'Delete Failed', error.message);
      } else {
        invalidateCache('buybacks');
        invalidateCache('inventory');
        showToast('success', 'Deleted', 'Buyback record deleted successfully.');
        await load();
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteConfirmId(null);
    }
  }

  async function updateStatus(buyback: Buyback, newStatus: string) {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { error: buybackError } = await supabase.from('loans').update({
      status: newStatus,
      date_closed: ['Redeemed', 'Forfeited'].includes(newStatus) ? today : null
    }).eq('id', buyback.id);

    if (buybackError) {
      showToast('error', 'Update Failed', buybackError.message);
      return;
    }

    // If closed, update the inventory item
    if (['Redeemed', 'Forfeited'].includes(newStatus) && buyback.inventory_id) {
      const invStatus = newStatus === 'Redeemed' ? 'Sold' : 'Available';
      const { error: invError } = await supabase.from('inventory').update({ 
        status: invStatus,
        date_sold: newStatus === 'Redeemed' ? today : null
      }).eq('id', buyback.inventory_id);
      
      if (invError) {
        showToast('info', 'Note', `Buyback status updated, but failed to update inventory: ${invError.message}`);
      }
    }

    invalidateCache('buybacks');
    invalidateCache('inventory');
    showToast('success', 'Status Updated', `Buyback is now marked as ${newStatus}.`);
    await load();
  }

  const { execute: executeSave, loading: saveLoading } = useMutation(save);
  const { execute: executeRemove, loading: removeLoading } = useMutation(remove);
  const { execute: executeUpdateStatus, loading: statusLoading } = useMutation(updateStatus);

  async function handleSendSms(buybackId: string, type: 'reminder' | 'forfeiture') {
    setSendingSmsId(buybackId);
    const action = type === 'reminder' ? sendBuybackReminderAction : sendBuybackForfeitureAction;
    const res = await action(buybackId);
    setSendingSmsId(null);
    
    if (res.success) {
      showToast('success', 'SMS Sent', `${type === 'reminder' ? 'Reminder' : 'Forfeiture'} message has been sent to the customer.`);
      setSentIds(prev => new Set(prev).add(buybackId));
    } else {
      showToast('error', 'SMS Failed', res.message || `Could not send ${type}.`);
    }
  }

  const filtered = buybacks.filter(l => {
    const name = (l.customers as any)?.full_name?.toLowerCase() || '';
    const item = (l.inventory as any)?.item_name?.toLowerCase() || '';
    const matchSearch = name.includes(search.toLowerCase()) || item.includes(search.toLowerCase());
    const matchFilter = filter === 'All' || l.status === filter;
    return matchSearch && matchFilter;
  });

  function daysLabel(due: string) {
    const d = new Date(due);
    if (isToday(d)) return { label: 'Due today', color: 'var(--warning)' };
    if (isPast(d)) return { label: `${Math.abs(differenceInDays(d, new Date()))}d overdue`, color: 'var(--danger)' };
    return { label: `${differenceInDays(d, new Date())}d left`, color: 'var(--success)' };
  }

  return (
    <div className="mb-24">
      <div className="page-header">
        <div>
          <h1 className="text-3xl mb-4">Buybacks</h1>
          <p className="text-muted">{buybacks.filter(l => l.status === 'Active').length} active buybacks</p>
        </div>
        <button className="btn-gold" onClick={openAdd}><Plus size={16} /> New Buyback</button>
      </div>

      <div className="search-container">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input className="input search-input" placeholder="Search customer or item…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['Active', 'All', 'Redeemed', 'Forfeited', 'Extended'].map(s => (
          <button 
            key={s} 
            onClick={() => setFilter(s)} 
            className={`filter-btn ${filter === s ? 'filter-btn-active' : ''}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="card p-0">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th><th>Item</th><th>Buyback</th><th>Interest</th>
                <th>Total Due</th><th>Due Date</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center text-muted p-40">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-muted p-40">No buybacks found</td></tr>
              ) : filtered.map(buyback => {
                const dl = daysLabel(buyback.due_date);
                const cust = buyback.customers as any;
                const inv = buyback.inventory as any;
                return (
                  <tr key={buyback.id}>
                    <td>
                      <div className="font-medium">{cust?.full_name}</div>
                      <div className="text-muted text-sm">{cust?.phone}</div>
                    </td>
                    <td>
                      <div>{inv?.item_name || '—'}</div>
                      <div className="text-muted text-sm">{inv?.category}</div>
                    </td>
                    <td>GH₵ {buyback.loan_amount?.toFixed(2)}</td>
                    <td className="text-muted">{buyback.interest_rate}% / {buyback.interest_period}</td>
                    <td className="font-semibold text-gold">GH₵ {buyback.total_due?.toFixed(2)}</td>
                    <td>
                      <div>{format(new Date(buyback.due_date), 'dd MMM yyyy')}</div>
                      {buyback.status === 'Active' && <div className="text-xs" style={{ color: dl.color }}>{dl.label}</div>}
                    </td>
                    <td><BuybackBadge status={buyback.status} /></td>
                    <td>
                      <div className="flex gap-6">
                        {buyback.status === 'Active' && (
                          <>
                            <button className="btn-gold p-4 text-xs" onClick={() => executeUpdateStatus(buyback, 'Redeemed')} disabled={statusLoading}>
                              {statusLoading ? <Loader2 className="animate-spin" size={10} /> : 'Redeemed'}
                            </button>
                            <button className="btn-ghost p-4 text-xs text-danger border-danger" onClick={() => executeUpdateStatus(buyback, 'Forfeited')} disabled={statusLoading}>
                              {statusLoading ? <Loader2 className="animate-spin" size={10} /> : 'Forfeit'}
                            </button>
                          </>
                        )}
                        <button 
                          className={`btn-ghost p-6 text-sm`} 
                          onClick={() => setSmsLoan(buyback)} 
                          style={{
                            background: sentIds.has(buyback.id) ? 'rgba(22, 163, 74, 0.1)' : '',
                            color: sentIds.has(buyback.id) ? 'var(--success)' : '',
                            borderColor: sentIds.has(buyback.id) ? 'var(--success)' : ''
                          }}
                          title="Send SMS Alert"
                          disabled={buyback.status !== 'Active' || sendingSmsId === buyback.id}
                        >
                          {sendingSmsId === buyback.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : sentIds.has(buyback.id) ? (
                            <Check size={12} />
                          ) : (
                            <MessageSquare size={12} />
                          )}
                        </button>
                        <button className="btn-ghost p-6 text-sm" onClick={() => openEdit(buyback)} title="Edit Buyback">
                          <Edit2 size={12} />
                        </button>
                        <button className="btn-ghost p-6 text-sm text-muted" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(buyback.id); }} title="Delete Buyback">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-xl">{editing ? 'Edit Buyback' : 'New Buyback'}</h2>
              <button className="btn-ghost p-6" onClick={() => setShowModal(false)} title="Close"><X size={16} /></button>
            </div>
            <div className="form-grid">
              <div className="full">
                <div className="modal-header mb-8">
                  <label className="label mb-0">Customer *</label>
                  <button 
                    className="btn-ghost text-xs p-4 text-gold"
                    onClick={() => setForm({ ...form, isNewCustomer: !form.isNewCustomer, customer_id: '' })}
                  >
                    {form.isNewCustomer ? 'Select Existing' : '+ Add New Customer'}
                  </button>
                </div>
                
                {form.isNewCustomer ? (
                  <div className="grid grid-cols-2 gap-10">
                    <input 
                      className="input" 
                      placeholder="Full Name" 
                      value={form.newCustomerName} 
                      onChange={e => setForm({ ...form, newCustomerName: e.target.value })} 
                    />
                    <input 
                      className="input" 
                      placeholder="Phone Number" 
                      value={form.newCustomerPhone} 
                      onChange={e => setForm({ ...form, newCustomerPhone: e.target.value })} 
                    />
                  </div>
                ) : (
                  <select className="input" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} title="Select Customer">
                    <option value="">— Select customer —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>)}
                  </select>
                )}
              </div>
              <div className="full">
                <label className="label">Collateral Item</label>
                <select className="input" value={form.inventory_id} title="Select Collateral Item" onChange={e => {
                  const itemId = e.target.value;
                  const item = inventory.find(i => i.id === itemId);
                  if (item) {
                    const amount = item.cost_price;
                    const total = item.selling_price;
                    const rate = amount > 0 ? ((total - amount) / amount) * 100 : 0;
                    setForm({ 
                      ...form, 
                      inventory_id: itemId,
                      loan_amount: String(amount),
                      interest_rate: String(rate.toFixed(1)),
                      total_due: String(total.toFixed(2))
                    });
                  } else {
                    setForm({ ...form, inventory_id: itemId });
                  }
                }}>
                  <option value="">— Select item —</option>
                  {inventory.map(i => <option key={i.id} value={i.id}>{i.item_name} ({i.category}) - GH₵{i.cost_price}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Buyback Amount (GH₵) *</label>
                <input className="input" type="number" min="0" step="0.01" value={form.loan_amount} onChange={e => {
                  const amount = e.target.value;
                  const rate = form.interest_rate;
                  const total = parseFloat(amount) + (parseFloat(amount) * parseFloat(rate) / 100);
                  setForm({ ...form, loan_amount: amount, total_due: total.toFixed(2) });
                }} placeholder="0.00" />
              </div>
              <div>
                <label className="label">Interest Rate (%)</label>
                <input className="input" type="number" min="0" step="0.5" value={form.interest_rate} onChange={e => {
                  const rate = e.target.value;
                  const amount = form.loan_amount;
                  const total = parseFloat(amount) + (parseFloat(amount) * parseFloat(rate) / 100);
                  setForm({ ...form, interest_rate: rate, total_due: total.toFixed(2) });
                }} title="Interest Rate" />
              </div>
               <div>
                <label className="label">Interest Period</label>
                <select className="input" value={form.interest_period} onChange={e => {
                  const newPeriod = e.target.value;
                  setForm({ ...form, interest_period: newPeriod, due_date: calculateDueDate(form.date_issued, newPeriod) });
                }} title="Interest Period">
                  {PERIODS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Due Date *</label>
                <input className="input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} title="Due Date" />
              </div>
              <div className="full">
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" />
              </div>
              
              <div className="full p-10 border-gold" style={{ background: 'rgba(212,168,83,0.05)', border: '1px solid var(--gold-dim)', borderRadius: 8 }}>
                <div className="flex justify-between items-center">
                  <div>
                    <label className="label mb-0 text-xs uppercase tracking-wider opacity-70">Total Due (Redemption)</label>
                    <div className="flex items-center gap-4">
                      <span className="text-gold font-bold">GH₵</span>
                      <input 
                        className="text-xl text-gold bg-transparent border-none p-0 focus:outline-none font-bold w-full" 
                        type="number"
                        value={form.total_due}
                        onChange={e => {
                          const total = e.target.value;
                          const amount = form.loan_amount;
                          const rate = parseFloat(amount) > 0 ? ((parseFloat(total) - parseFloat(amount)) / parseFloat(amount)) * 100 : 0;
                          setForm({ ...form, total_due: total, interest_rate: rate.toFixed(1) });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowModal(false)} disabled={saveLoading}>Cancel</button>
              <button className="btn-gold" onClick={() => executeSave()} disabled={saveLoading || (!form.customer_id && !form.isNewCustomer) || !form.loan_amount || !form.due_date}>
                {saveLoading ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle size={15} />} {editing ? 'Save Changes' : 'Create Buyback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {smsLoan && (
        <div className="modal-overlay" onClick={() => setSmsLoan(null)}>
          <div className="modal max-w-400 text-center" onClick={e => e.stopPropagation()}>
            <div className="text-gold mb-16 flex justify-center" style={{ color: 'var(--red)' }}>
              <MessageSquare size={48} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl mb-12">Send SMS Alert</h2>
            <p className="text-muted mb-24">
              Select the message type to send to <strong>{(smsLoan.customers as any)?.full_name}</strong>.
            </p>
            <div className="flex flex-col gap-10">
              <button 
                className="btn-gold w-full justify-center" 
                onClick={() => {
                  handleSendSms(smsLoan.id, 'reminder');
                  setSmsLoan(null);
                }}
              >
                Send Friendly Reminder
              </button>
              <button 
                className="btn-ghost w-full justify-center text-danger border-danger hover:bg-red-tint" 
                onClick={() => {
                  handleSendSms(smsLoan.id, 'forfeiture');
                  setSmsLoan(null);
                }}
              >
                Send Overdue Notice (Forfeiture)
              </button>
              <button 
                className="btn-ghost w-full justify-center mt-10" 
                onClick={() => setSmsLoan(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => !removeLoading && setDeleteConfirmId(null)}>
          <div className="modal max-w-400 text-center" onClick={e => e.stopPropagation()}>
            <div className="text-danger mb-16">
              {removeLoading ? <Loader2 className="animate-spin" size={48} style={{ margin: '0 auto' }} /> : <Trash2 size={48} strokeWidth={1.5} />}
            </div>
            <h2 className="text-2xl mb-12">Delete Buyback?</h2>
            <p className="text-muted mb-24">
              Are you sure you want to delete this buyback record? This action cannot be undone.
            </p>
            <div className="flex gap-12 justify-center">
              <button className="btn-ghost flex-1" onClick={() => setDeleteConfirmId(null)} disabled={removeLoading}>Cancel</button>
              <button className="btn-gold flex-1 bg-danger text-white" onClick={() => executeRemove()} disabled={removeLoading}>
                {removeLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BuybackBadge({ status }: { status: string }) {
  const map: Record<string, string> = { Active: 'badge-yellow', Redeemed: 'badge-green', Forfeited: 'badge-red', Extended: 'badge-blue' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}
