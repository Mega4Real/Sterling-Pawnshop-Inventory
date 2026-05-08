'use client';
import { useEffect, useState, useRef } from 'react';
import { supabase, InventoryItem, Customer } from '@/lib/supabase';
import { Plus, Search, X, Edit2, CheckCircle, Trash2, UserPlus, FileText, FileUp, FileDown, FileSpreadsheet } from 'lucide-react';
import { format, addMonths, addDays } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CATEGORIES = ['Electronics', 'Television', 'Refrigerator', 'Laptop', 'Phone', 'Game', 'Car', 'Air Conditioner', 'Others'];
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];
const STATUSES = ['Available', 'Sold', 'Buyback'];
const PERIODS = ['1 Week', '2 Weeks', '3 Weeks', '1 Month', '2 Months'];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState(defaultForm());
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    return {
      item_name: '', description: '', category: 'Electronics', condition: 'Good',
      cost_price: '', selling_price: '', status: 'Available',
      customer_id: '', date_acquired: format(new Date(), 'yyyy-MM-dd'),
      serial_number: '', notes: '',
      isNewCustomer: false, newCustomerName: '', newCustomerPhone: '',
      due_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      interest_rate: '10', interest_period: '1 Month'
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
      serial_number: item.serial_number || '', notes: item.notes || '',
      isNewCustomer: false, newCustomerName: '', newCustomerPhone: '',
      due_date: format(addMonths(new Date(), 1), 'yyyy-MM-dd'),
      interest_rate: '10', interest_period: '1 Month'
    });
    setEditing(item);
    setShowModal(true);
  }

  async function remove() {
    if (!deleteConfirmId) return;
    
    try {
      // Delete associated loans first
      await supabase.from('loans').delete().eq('inventory_id', deleteConfirmId);
      
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
      let finalCustomerId = form.customer_id;

      // Handle New Customer
      if (form.status === 'Buyback' && form.isNewCustomer) {
        if (!form.newCustomerName) {
          alert('Please enter customer name');
          return;
        }
        const { data: nc, error: ce } = await supabase.from('customers').insert({
          full_name: form.newCustomerName,
          phone: form.newCustomerPhone
        }).select().single();
        
        if (ce) {
          alert(`Error creating customer: ${ce.message}`);
          return;
        }
        finalCustomerId = nc.id;
      }

      const payload = {
        item_name: form.item_name,
        description: form.description,
        category: form.category,
        condition: form.condition,
        cost_price: parseFloat(form.cost_price as string),
        selling_price: parseFloat(form.selling_price as string),
        status: form.status,
        customer_id: finalCustomerId || null,
        date_acquired: form.date_acquired,
        serial_number: form.serial_number,
        notes: form.notes,
        date_sold: form.status === 'Sold' ? format(new Date(), 'yyyy-MM-dd') : null,
      };
      
      let invData;
      let error;
      if (editing) {
        ({ data: invData, error } = await supabase.from('inventory').update(payload).eq('id', editing.id).select().single());
      } else {
        ({ data: invData, error } = await supabase.from('inventory').insert(payload).select().single());
      }

      if (error) {
        console.error('Supabase Error:', error);
        alert(`Error saving item: ${error.message}`);
        return;
      }

      // Handle Buyback (Loan) Record
      if (form.status === 'Buyback' && invData) {
        const loanPayload = {
          customer_id: finalCustomerId,
          inventory_id: invData.id,
          loan_amount: parseFloat(form.cost_price as string),
          interest_rate: parseFloat(form.interest_rate),
          interest_period: form.interest_period,
          due_date: form.due_date,
          total_due: parseFloat(form.selling_price as string),
          status: 'Active',
          notes: form.notes
        };

        // Check if a loan already exists for this item (if editing)
        if (editing) {
          const { data: existingLoan } = await supabase.from('loans').select('id').eq('inventory_id', editing.id).single();
          if (existingLoan) {
            await supabase.from('loans').update(loanPayload).eq('id', existingLoan.id);
          } else {
            await supabase.from('loans').insert(loanPayload);
          }
        } else {
          const { error: le } = await supabase.from('loans').insert(loanPayload);
          if (le) console.error('Error creating buyback record:', le);
        }
      }

      setShowModal(false);
      load();
    } catch (err: any) {
      console.error('Unexpected Error:', err);
      alert(`An unexpected error occurred: ${err.message}`);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];

        if (data.length === 0) {
          alert('No data found in Excel sheet');
          setImporting(false);
          return;
        }

        let importedCount = 0;
        let skipCount = 0;

        for (const row of data) {
          // Normalize column names (case-insensitive)
          const findVal = (keys: string[]) => {
            const key = Object.keys(row).find(k => {
              const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
              return keys.some(s => {
                const normalizedS = s.toLowerCase().replace(/[^a-z0-9]/g, '');
                return normalizedK === normalizedS || normalizedK.includes(normalizedS);
              });
            });
            return key ? row[key] : null;
          };

          const itemName = findVal(['Item', 'ItemName', 'Name', 'Product', 'Description']);
          if (!itemName) {
            skipCount++;
            continue;
          }

          const buyingPrice = parseFloat(findVal(['BuyingPrice', 'Cost', 'CostPrice', 'Buying']) || '0');
          const sellingPrice = parseFloat(findVal(['Price', 'SellingPrice', 'RetailPrice', 'Selling']) || '0');
          const customerName = findVal(['CustomerName', 'Customer']);
          const buybackDateVal = findVal(['Buyback', 'BuybackDate', 'DueDate', 'Date']);
          
          let status = 'Available';
          let customerId = null;

          // Logic: If Customer Name exists and Buyback date exists -> status = Buyback
          if (customerName && buybackDateVal) {
            status = 'Buyback';
            
            // Find or Create Customer
            const { data: existingCustomer } = await supabase.from('customers').select('id').ilike('full_name', customerName.toString()).maybeSingle();
            
            if (existingCustomer) {
              customerId = existingCustomer.id;
            } else {
              const { data: newCustomer } = await supabase.from('customers').insert({ full_name: customerName.toString() }).select().single();
              customerId = newCustomer?.id;
            }
          }

          // Insert Inventory Item
          const { data: invItem, error: invError } = await supabase.from('inventory').insert({
            item_name: itemName.toString(),
            description: itemName.toString().length > 50 ? itemName.toString() : (findVal(['Description', 'Notes']) || '').toString(),
            cost_price: buyingPrice,
            selling_price: sellingPrice || (buyingPrice > 0 ? buyingPrice * 1.5 : 0),
            status: status,
            customer_id: customerId,
            date_acquired: format(new Date(), 'yyyy-MM-dd'),
            category: findVal(['Category', 'Type']) || 'Other',
            condition: findVal(['Condition', 'State']) || 'Good',
            serial_number: (findVal(['SerialNumber', 'Serial', 'SN']) || '').toString(),
            notes: 'Imported from Excel'
          }).select().single();

          if (invError) {
            console.error('Error importing item:', invError);
            skipCount++;
            continue;
          }

          // If Buyback, create Loan record
          if (status === 'Buyback' && invItem && customerId) {
            let dueDate = buybackDateVal;
            if (typeof buybackDateVal === 'number' && buybackDateVal > 10000) {
              // Handle Excel date serial numbers
              dueDate = new Date((buybackDateVal - 25569) * 86400 * 1000);
            } else if (typeof buybackDateVal === 'string') {
              dueDate = new Date(buybackDateVal);
            }
            
            // Ensure valid date
            const finalDueDate = (dueDate instanceof Date && !isNaN(dueDate.getTime())) ? dueDate : addMonths(new Date(), 1);

            const { error: loanError } = await supabase.from('loans').insert({
              customer_id: customerId,
              inventory_id: invItem.id,
              loan_amount: buyingPrice,
              interest_rate: 10,
              interest_period: '1 Month',
              due_date: format(finalDueDate, 'yyyy-MM-dd'),
              total_due: sellingPrice || (buyingPrice * 1.1),
              status: 'Active',
              notes: 'Imported from Excel'
            });

            if (loanError) console.error('Error creating loan record:', loanError);
          }

        }

        if (importedCount === 0 && data.length > 0) {
          const headers = Object.keys(data[0]).join(', ');
          alert(`Import Failed!\nWe couldn't find an "Item" or "Name" column.\n\nDetected columns: ${headers}\n\nPlease ensure your Excel sheet has columns named "Item" and "Buying Price".`);
        } else {
          alert(`Import Complete!\nSuccessfully imported: ${importedCount}\nSkipped: ${skipCount}`);
        }
        load();
      } catch (err: any) {
        console.error('Import Error:', err);
        alert(`Error parsing Excel file: ${err.message}`);
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  }

  async function handleExportExcel() {
    try {
      const exportData = items.map(i => ({
        'Item Name': i.item_name,
        'Description': i.description || '',
        'Category': i.category || '',
        'Condition': i.condition || '',
        'Cost Price (GHS)': i.cost_price,
        'Selling Price (GHS)': i.selling_price,
        'Status': i.status,
        'Date Acquired': i.date_acquired ? format(new Date(i.date_acquired), 'yyyy-MM-dd') : '',
        'Serial Number': i.serial_number || '',
        'Notes': i.notes || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      XLSX.writeFile(wb, `Sterling_Inventory_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } catch (err) {
      console.error('Export Error:', err);
      alert('Failed to export Excel file');
    }
  }

  async function handleExportPDF() {
    try {
      const doc = new jsPDF('l', 'mm', 'a4'); // landscape
      
      // Add Title
      doc.setFontSize(20);
      doc.text('Sterling Pawnshop - Inventory Report', 14, 22);
      doc.setFontSize(10);
      doc.text(`Generated on: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 14, 30);

      const tableData = items.map(i => [
        i.item_name,
        i.category || '-',
        i.condition || '-',
        `GHS ${i.cost_price.toFixed(2)}`,
        `GHS ${i.selling_price.toFixed(2)}`,
        i.status,
        i.date_acquired ? format(new Date(i.date_acquired), 'dd/MM/yy') : '-'
      ]);

      autoTable(doc, {
        startY: 35,
        head: [['Item', 'Category', 'Condition', 'Cost', 'Price', 'Status', 'Date']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [192, 21, 42] }, // Sterling Red
      });

      doc.save(`Sterling_Inventory_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to export PDF file');
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
        <div className="flex gap-10">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".xlsx, .xls" 
            className="hidden" 
            title="Import Excel"
          />
          <button 
            className="btn-ghost" 
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <FileUp size={16} /> {importing ? 'Importing...' : 'Import Excel'}
          </button>
          <button 
            className="btn-ghost" 
            onClick={handleExportExcel}
            title="Download Excel"
          >
            <FileSpreadsheet size={16} /> Excel
          </button>
          <button 
            className="btn-ghost" 
            onClick={handleExportPDF}
            title="Download PDF"
          >
            <FileDown size={16} /> PDF
          </button>
          <button className="btn-gold" onClick={openAdd}><Plus size={16} /> Add Item</button>
        </div>
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
                <input className="input" type="number" min="0" step="0.01" value={form.cost_price} onChange={e => {
                  const val = e.target.value;
                  const sell = form.selling_price || '0';
                  const rate = val && parseFloat(val) > 0 ? ((parseFloat(sell) - parseFloat(val)) / parseFloat(val)) * 100 : 0;
                  setForm({ ...form, cost_price: val, interest_rate: rate.toFixed(1) });
                }} placeholder="0.00" />
              </div>
              <div>
                <label className="label">{form.status === 'Buyback' ? 'Buyback Due (Redemption) *' : 'Selling Price (GH₵) *'}</label>
                <input className="input" type="number" min="0" step="0.01" value={form.selling_price} onChange={e => {
                  const val = e.target.value;
                  const cost = form.cost_price || '0';
                  const rate = cost && parseFloat(cost) > 0 ? ((parseFloat(val) - parseFloat(cost)) / parseFloat(cost)) * 100 : 0;
                  setForm({ ...form, selling_price: val, interest_rate: rate.toFixed(1) });
                }} placeholder="0.00" />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} title="Status">
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Date Acquired</label>
                <input className="input" type="date" value={form.date_acquired} onChange={e => {
                  const newDate = e.target.value;
                  setForm({ ...form, date_acquired: newDate, due_date: calculateDueDate(newDate, form.interest_period) });
                }} title="Date Acquired" />
              </div>

              {form.status === 'Buyback' && (
                <div className="full bg-gold-faint p-20 rounded-xl border-gold-dim mt-10 mb-10">
                  <div className="flex items-center gap-10 mb-16 text-gold">
                    <FileText size={20} />
                    <h3 className="text-lg font-bold">Buyback Agreement</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-20">
                    <div className="col-span-2">
                      <div className="flex justify-between items-center mb-8">
                        <label className="label mb-0">Customer Details *</label>
                        <button 
                          className="btn-ghost text-xs p-4 text-gold flex items-center gap-4"
                          onClick={() => setForm({ ...form, isNewCustomer: !form.isNewCustomer, customer_id: '' })}
                        >
                          {form.isNewCustomer ? 'Select Existing' : <><UserPlus size={12} /> Add New Customer</>}
                        </button>
                      </div>
                      {form.isNewCustomer ? (
                        <div className="grid grid-cols-2 gap-10">
                          <input className="input" placeholder="Customer Name" value={form.newCustomerName} onChange={e => setForm({ ...form, newCustomerName: e.target.value })} />
                          <input className="input" placeholder="Contact Number" value={form.newCustomerPhone} onChange={e => setForm({ ...form, newCustomerPhone: e.target.value })} />
                        </div>
                      ) : (
                        <select className="input" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} title="Select Customer">
                          <option value="">— Select Customer —</option>
                          {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>)}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="label">Due Date *</label>
                      <input className="input" type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} title="Due Date" />
                    </div>
                    <div>
                      <label className="label">Interest Rate (%)</label>
                      <input className="input" type="number" value={form.interest_rate} onChange={e => {
                        const rate = e.target.value;
                        const cost = form.cost_price || '0';
                        const sell = parseFloat(cost) + (parseFloat(cost) * parseFloat(rate) / 100);
                        setForm({ ...form, interest_rate: rate, selling_price: sell.toFixed(2) });
                      }} title="Interest Rate" />
                    </div>
                    <div>
                      <label className="label">Interest Period</label>
                      <select className="input" value={form.interest_period} onChange={e => {
                        const newPeriod = e.target.value;
                        setForm({ ...form, interest_period: newPeriod, due_date: calculateDueDate(form.date_acquired, newPeriod) });
                      }} title="Interest Period">
                        {PERIODS.map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="full">
                <label className="label">Serial Number</label>
                <input className="input" value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} placeholder="Optional" />
              </div>
              {form.status !== 'Buyback' && (
                <div>
                  <label className="label">Customer (Seller)</label>
                  <select className="input" value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })} title="Customer">
                    <option value="">— None —</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                  </select>
                </div>
              )}
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
