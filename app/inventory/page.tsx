'use client';
import { useEffect, useState } from 'react';
import { supabase, InventoryItem, Customer } from '@/lib/supabase';
import { Plus, Search, X, Edit2, CheckCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const CATEGORIES = ['Electronics', 'Jewelry', 'Clothing', 'Tools', 'Musical Instruments', 'Watches', 'Bags', 'Other'];
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
const STATUSES = ['Available', 'Sold', 'Buyback'];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(defaultForm());

  function defaultForm() {
    return {
      item_name: '', description: '', category: 'Electronics', condition: 'Good',
      cost_price: '', selling_price: '', status: 'Available',
      customer_id: '', date_acquired: format(new Date(), 'yyyy-MM-dd'),
      serial_number: '', notes: ''
    };
  }

  async function load() {
    const { data } = await supabase.from('inventory').select('*, customers(full_name)').order('created_at', { ascending: false });
    setItems(data || []);
    const { data: c } = await supabase.from('customers').select('*').order('full_name');
    setCustomers(c || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setForm(defaultForm()); setEditing(null); setShowModal(true); }
  function openEdit(item: InventoryItem) {
    setForm({
      item_name: item.item_name, description: item.description || '', category: item.category || 'Electronics',
      condition: item.condition || 'Good', cost_price: String(item.cost_price), selling_price: String(item.selling_price),
      status: item.status, customer_id: item.customer_id || '', date_acquired: item.date_acquired || '',
      serial_number: item.serial_number || '', notes: item.notes || ''
    });
    setEditing(item);
    setShowModal(true);
  }

  async function remove() {
    if (!deleteConfirmId) return;
    
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', deleteConfirmId);
      if (error) {
        alert(`Error deleting item: ${error.message}`);
      } else {
        load();
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteConfirmId(null);
    }
  }

  async function save() {
    try {
      const payload = {
        ...form,
        cost_price: parseFloat(form.cost_price as string),
        selling_price: parseFloat(form.selling_price as string),
        customer_id: form.customer_id || null,
        date_sold: form.status === 'Sold' ? format(new Date(), 'yyyy-MM-dd') : null,
      };
      
      let error;
      if (editing) {
        ({ error } = await supabase.from('inventory').update(payload).eq('id', editing.id));
      } else {
        ({ error } = await supabase.from('inventory').insert(payload));
      }

      if (error) {
        console.error('Supabase Error:', error);
        alert(`Error saving item: ${error.message}`);
        return;
      }

      setShowModal(false);
      load();
    } catch (err: any) {
      console.error('Unexpected Error:', err);
      alert(`An unexpected error occurred: ${err.message}`);
    }
  }

  const filtered = items.filter(i => {
    const matchSearch = i.item_name.toLowerCase().includes(search.toLowerCase()) ||
      (i.description || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || i.status === filter;
    return matchSearch && matchFilter;
  });

  const profit = (i: InventoryItem) => i.selling_price - i.cost_price;
  const profitPct = (i: InventoryItem) => ((profit(i) / i.cost_price) * 100).toFixed(0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-3xl mb-4">Inventory</h1>
          <p className="text-muted">{items.length} items total</p>
        </div>
        <button className="btn-gold" onClick={openAdd}><Plus size={16} /> Add Item</button>
      </div>

      {/* Filters */}
      <div className="search-container">
        <div className="search-wrapper">
          <Search size={14} className="search-icon" />
          <input className="input search-input" placeholder="Search items…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {['All', 'Available', 'Sold', 'Buyback'].map(s => (
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
                <th>Item</th><th>Category</th><th>Condition</th>
                <th>Cost</th><th>Sell Price</th><th>Profit</th>
                <th>Status</th><th>Date</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center text-muted p-40">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center text-muted p-40">No items found</td></tr>
              ) : filtered.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="font-medium">{item.item_name}</div>
                    {item.description && <div className="text-muted text-sm">{item.description}</div>}
                  </td>
                  <td className="text-muted">{item.category}</td>
                  <td><span className={`badge badge-${item.condition === 'Excellent' || item.condition === 'Good' ? 'green' : item.condition === 'Fair' ? 'yellow' : 'red'}`}>{item.condition}</span></td>
                  <td>GH₵ {item.cost_price.toFixed(2)}</td>
                  <td>GH₵ {item.selling_price.toFixed(2)}</td>
                  <td className={profit(item) >= 0 ? 'text-success' : 'text-danger'}>
                    GH₵ {profit(item).toFixed(2)} <span className="text-xs" style={{ opacity: 0.7 }}>({profitPct(item)}%)</span>
                  </td>
                  <td><StatusBadge status={item.status} /></td>
                  <td className="text-muted text-sm">{item.date_acquired ? format(new Date(item.date_acquired), 'dd MMM yy') : '-'}</td>
                  <td>
                    <div className="flex gap-6">
                      <button className="btn-ghost p-10 text-sm" onClick={() => openEdit(item)}>
                        <Edit2 size={12} /> Edit
                      </button>
                      <button className="btn-ghost p-10 text-sm text-danger" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(item.id); }} title="Delete Item">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="text-xl">{editing ? 'Edit Item' : 'Add Item'}</h2>
              <button className="btn-ghost p-6" onClick={() => setShowModal(false)} title="Close"><X size={16} /></button>
            </div>
            <div className="form-grid">
              <div className="full">
                <label className="label">Item Name *</label>
                <input className="input" value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} placeholder="e.g. Samsung Galaxy S22" />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} title="Category">
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Condition</label>
                <select className="input" value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })} title="Condition">
                  {CONDITIONS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Cost Price (GH₵) *</label>
                <input className="input" type="number" min="0" step="0.01" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <label className="label">Selling Price (GH₵) *</label>
                <input className="input" type="number" min="0" step="0.01" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} title="Status">
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Date Acquired</label>
                <input className="input" type="date" value={form.date_acquired} onChange={e => setForm({ ...form, date_acquired: e.target.value })} title="Date Acquired" />
              </div>
              <div>
                <label className="label">Serial Number</label>
                <input className="input" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} placeholder="Optional" />
              </div>
              <div>
                <label className="label">Customer (Seller)</label>
                <select className="input" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} title="Customer">
                  <option value="">— None —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div className="full">
                <label className="label">Description</label>
                <input className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
              </div>
              <div className="full">
                <label className="label">Notes</label>
                <input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-gold" onClick={save} disabled={!form.item_name || !form.cost_price || !form.selling_price}>
                <CheckCircle size={15} /> {editing ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="modal max-w-400 text-center" onClick={e => e.stopPropagation()}>
            <div className="text-danger mb-16">
              <Trash2 size={48} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl mb-12">Delete Item?</h2>
            <p className="text-muted mb-24">
              Are you sure you want to delete this inventory item? This action cannot be undone and may affect associated buybacks.
            </p>
            <div className="flex gap-12 justify-center">
              <button className="btn-ghost flex-1" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button className="btn-gold flex-1 bg-danger text-white" onClick={remove}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { Available: 'badge-green', Sold: 'badge-blue', Buyback: 'badge-yellow' };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
}
