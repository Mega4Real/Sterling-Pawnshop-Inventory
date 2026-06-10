'use client';

import { useState, useEffect } from 'react';
import { supabase, Customer } from '@/lib/supabase';
import { useCachedData } from '@/lib/data-cache';
import { useToast } from '@/components/Toast';
import {
  Send,
  Calendar,
  RefreshCw,
  Settings,
  History,
  User,
  AlertCircle,
  MessageSquare,
  Loader2,
  Coins,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';

/**
 * Fetcher function to load customers from Supabase
 */
const fetchCustomers = async () => {
  const { data, error } = await supabase.from('customers').select('*').order('full_name');
  if (error) throw error;
  return data || [];
};

interface HistoryItem {
  id: string;
  recipientName: string;
  phone: string;
  message: string;
  type: 'plain' | 'scheduled';
  scheduleTime?: string;
  status: 'success' | 'failed';
  error?: string;
  timestamp: string;
}

export default function SMSPortal() {
  const { data: customers = [], isLoading: loadingCustomers } = useCachedData('customers', fetchCustomers);
  const { showToast } = useToast();

  // Balance Check states
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceData, setBalanceData] = useState<any>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Form States
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [senderId, setSenderId] = useState('Pawnshop');
  
  // Schedule states
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Settings states (custom key settings)
  const [showSettings, setShowSettings] = useState(false);
  const [customApiKey, setCustomApiKey] = useState('');
  const [inputKey, setInputKey] = useState('');

  // Execution states
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load local state & trigger balance check on mount
  useEffect(() => {
    // 1. Load history log
    const savedHistory = localStorage.getItem('sterling_sms_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse SMS history', e);
      }
    }

    // 2. Load custom API key if any
    const savedKey = localStorage.getItem('sterling_sms_custom_key');
    if (savedKey) {
      setCustomApiKey(savedKey);
      setInputKey(savedKey);
      fetchBalance(savedKey);
    } else {
      fetchBalance('');
    }
  }, []);

  /**
   * Fetches current SMS balance from the server endpoint
   */
  async function fetchBalance(keyToUse: string) {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const res = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-balance',
          apiKey: keyToUse || undefined,
        }),
      });

      const result = await res.json();
      if (res.ok && result.success && result.data) {
        setBalanceData(result.data);
      } else {
        setBalanceError(result.message || 'Unable to check balance.');
        setBalanceData(null);
      }
    } catch (err: any) {
      setBalanceError(err.message || 'Network error.');
      setBalanceData(null);
    } finally {
      setBalanceLoading(false);
    }
  }

  // Handle selected customer change
  function handleCustomerSelect(custId: string) {
    setSelectedCustomerId(custId);
    if (!custId) {
      setPhone('');
      return;
    }
    const customer = customers.find(c => c.id === custId);
    if (customer) {
      setPhone(customer.phone || '');
    }
  }

  // Calculate character counter & message parts
  const charCount = message.length;
  // Standard plain SMS is 160 characters; longer concatenated ones are split into 153 char parts.
  const smsParts = charCount <= 160 ? (charCount === 0 ? 0 : 1) : Math.ceil(charCount / 153);

  // Format schedule inputs to "dd-mm-yyyy hh:mm AM/PM"
  function getFormattedSchedule(): string {
    if (!scheduleDate || !scheduleTime) return '';
    const [year, month, day] = scheduleDate.split('-');
    const [hour24, minute] = scheduleTime.split(':');
    
    let hour = parseInt(hour24, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12; // 0 should map to 12
    
    const paddedHour = hour < 10 ? `0${hour}` : hour.toString();
    return `${day}-${month}-${year} ${paddedHour}:${minute} ${ampm}`;
  }

  // Quick SMS Templates
  const templates = [
    {
      title: 'Maturity Reminder',
      text: 'Hello [Customer], this is a reminder from Sterling Pawnshop. Your buyback agreement is due soon. The total amount is GH₵ [Amount]. Please visit our shop to redeem your item. Thank you.',
    },
    {
      title: 'Overdue Forfeiture',
      text: 'Hello [Customer], this is an urgent notice from Sterling Pawnshop. Your buyback is overdue. Please pay within 2 days to avoid forfeiture and resale of your item. Contact us if you need help.',
    },
    {
      title: 'Transaction Welcome',
      text: 'Hello [Customer], thank you for transacting with Sterling Pawnshop. Your items have been securely cataloged. Keep your agreement ticket safe.',
    }
  ];

  function applyTemplate(text: string) {
    let messageText = text;
    // Replace [Customer] placeholder if customer is selected
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer) {
        messageText = messageText.replace(/\[Customer\]/g, customer.full_name);
      }
    }
    setMessage(messageText);
  }

  // Save/Clear Custom API Key
  function handleSaveSettings() {
    const trimmed = inputKey.trim();
    setCustomApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('sterling_sms_custom_key', trimmed);
    } else {
      localStorage.removeItem('sterling_sms_custom_key');
    }
    fetchBalance(trimmed);
    showToast('success', 'API Key Saved', 'Custom API Key configured and verified.');
  }

  // Clear log
  function handleClearHistory() {
    if (confirm('Are you sure you want to clear your local SMS logs?')) {
      localStorage.removeItem('sterling_sms_history');
      setHistory([]);
      showToast('success', 'History Cleared', 'Your local log was wiped.');
    }
  }

  // Send message handler
  async function handleSendMessage() {
    if (!phone.trim()) {
      showToast('error', 'Missing Recipient', 'Please enter or select a recipient phone number.');
      return;
    }
    if (!message.trim()) {
      showToast('error', 'Missing Message', 'Please write a message before sending.');
      return;
    }

    let scheduleTimeStr = '';
    if (isScheduled) {
      if (!scheduleDate || !scheduleTime) {
        showToast('error', 'Missing Schedule Time', 'Please set both date and time to schedule this SMS.');
        return;
      }

      const selectedDate = new Date(`${scheduleDate}T${scheduleTime}`);
      if (selectedDate <= new Date()) {
        showToast('error', 'Invalid Time', 'Scheduled time must be in the future.');
        return;
      }

      scheduleTimeStr = getFormattedSchedule();
    }

    setSending(true);

    try {
      const activeCustomer = customers.find(c => c.id === selectedCustomerId);
      const recipientName = activeCustomer ? activeCustomer.full_name : 'Manual Entry';

      const res = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-sms',
          to: phone,
          sms: message,
          schedule: isScheduled ? scheduleTimeStr : undefined,
          from: senderId || undefined,
          apiKey: customApiKey || undefined,
        }),
      });

      const result = await res.json();

      // Log activity item
      const logItem: HistoryItem = {
        id: Math.random().toString(36).substring(2, 9),
        recipientName,
        phone,
        message,
        type: isScheduled ? 'scheduled' : 'plain',
        scheduleTime: isScheduled ? scheduleTimeStr : undefined,
        status: result.success ? 'success' : 'failed',
        error: result.success ? undefined : result.message,
        timestamp: new Date().toISOString(),
      };

      const newHistory = [logItem, ...history].slice(0, 50);
      setHistory(newHistory);
      localStorage.setItem('sterling_sms_history', JSON.stringify(newHistory));

      if (res.ok && result.success) {
        showToast('success', 'SMS Sent', result.message || 'SMS completed.');
        setMessage(''); // Clear text box
        fetchBalance(customApiKey); // Refresh balance
      } else {
        showToast('error', 'SMS Failed', result.message || 'SMS failed.');
      }
    } catch (err: any) {
      showToast('error', 'Network Error', err.message || 'Failed to dispatch SMS.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="text-3xl mb-4">SMS Portal</h1>
          <p className="text-muted">Broadcast reminders, alerts, and custom messages to pawnshop clients.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-24">
        {/* Left Side: SMS Form & Configuration */}
        <div className="flex-1 flex flex-col gap-24">
          
          {/* Main SMS Form */}
          <div className="card">
            <h2 className="text-lg font-bold mb-16 flex items-center gap-8">
              <MessageSquare size={18} color="var(--red)" />
              Compose Message
            </h2>

            <div className="form-grid">
              {/* Customer Selector */}
              <div className="full">
                <label className="label">Link Customer (Optional)</label>
                {loadingCustomers ? (
                  <div className="text-muted text-sm flex items-center gap-6 p-10 bg-elevated rounded">
                    <Loader2 size={12} className="animate-spin" /> Loading customer list...
                  </div>
                ) : (
                  <select
                    className="input"
                    value={selectedCustomerId}
                    onChange={e => handleCustomerSelect(e.target.value)}
                    title="Customer Link"
                  >
                    <option value="">-- Choose registered customer --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.phone || 'no phone'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Phone Input */}
              <div>
                <label className="label">Phone Number *</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. 0244000000 or 233..."
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              {/* Sender ID Input */}
              <div>
                <label className="label">Sender ID</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Max 11 characters"
                  maxLength={11}
                  value={senderId}
                  onChange={e => setSenderId(e.target.value)}
                />
              </div>

              {/* Message text area */}
              <div className="full">
                <div className="flex justify-between items-center mb-4">
                  <label className="label m-0">Message *</label>
                  <span className="text-xs text-muted">
                    {charCount} chars · <strong style={{ color: smsParts > 1 ? 'var(--warning)' : 'inherit' }}>{smsParts} {smsParts === 1 ? 'part' : 'parts'}</strong> (160/153 char limit)
                  </span>
                </div>
                <textarea
                  className="input"
                  rows={5}
                  placeholder="Enter message here..."
                  style={{ resize: 'vertical' }}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>

              {/* Schedule toggles */}
              <div className="full">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="mb-10">
                  <input
                    type="checkbox"
                    id="schedule-toggle"
                    checked={isScheduled}
                    onChange={e => setIsScheduled(e.target.checked)}
                    className="pointer"
                    style={{ width: 16, height: 16 }}
                  />
                  <label htmlFor="schedule-toggle" className="label pointer" style={{ margin: 0, textTransform: 'none', fontSize: 13, fontWeight: 600 }}>
                    Schedule this SMS for a future date/time
                  </label>
                </div>

                {isScheduled && (
                  <div className="grid grid-cols-2 gap-12 mt-12 p-12 rounded-xl border-gold-dim bg-gold-faint">
                    <div>
                      <label className="label">Schedule Date</label>
                      <input
                        type="date"
                        className="input"
                        value={scheduleDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setScheduleDate(e.target.value)}
                        title="Schedule Date"
                      />
                    </div>
                    <div>
                      <label className="label">Schedule Time</label>
                      <input
                        type="time"
                        className="input"
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        title="Schedule Time"
                      />
                    </div>
                    <div className="full text-xs text-muted flex items-center gap-6 mt-4">
                      <Calendar size={12} />
                      Will be sent: {scheduleDate && scheduleTime ? (
                        <strong className="text-gold">{getFormattedSchedule()}</strong>
                      ) : (
                        'Please specify date & time'
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ marginTop: 24 }}>
              <button
                className="btn-gold"
                onClick={handleSendMessage}
                disabled={sending}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {sending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Dispatching...
                  </>
                ) : (
                  <>
                    <Send size={16} /> {isScheduled ? 'Schedule Message' : 'Send SMS Now'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Advanced Configurations / Key override */}
          <div className="card">
            <button
              onClick={() => setShowSettings(prev => !prev)}
              className="btn-ghost flex items-center justify-between w-full"
              style={{ padding: '8px 12px', border: 'none', background: 'transparent' }}
            >
              <div className="flex items-center gap-8 text-sm font-semibold text-muted">
                <Settings size={14} />
                Advanced Gateway Credentials
              </div>
              {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showSettings && (
              <div className="mt-16 pt-16 border-t border-solid" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs text-muted mb-12">
                  Override the default system API key with a different Arkesel key (saved locally in your browser).
                </p>
                <div className="flex flex-col sm:flex-row gap-10">
                  <div className="flex-1">
                    <input
                      type="password"
                      className="input"
                      placeholder="Enter Arkesel API key..."
                      value={inputKey}
                      onChange={e => setInputKey(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-4">
                    <button className="btn-gold text-xs" onClick={handleSaveSettings}>Save</button>
                    {customApiKey && (
                      <button
                        className="btn-ghost text-xs text-danger"
                        onClick={() => {
                          setInputKey('');
                          setCustomApiKey('');
                          localStorage.removeItem('sterling_sms_custom_key');
                          fetchBalance('');
                          showToast('info', 'Settings Reset', 'Reverted to system default API key.');
                        }}
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                </div>
                {customApiKey && (
                  <div className="text-xs text-success flex items-center gap-6 mt-8">
                    <ShieldCheck size={12} /> Custom API key active.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Balance, Quick templates, History */}
        <div className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-24">
          
          {/* Balance card */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, var(--bg) 100%)' }}>
            <div className="flex justify-between items-center mb-16">
              <h3 className="text-sm text-muted text-uppercase tracking-wide font-semibold flex items-center gap-6">
                <Coins size={14} color="var(--red)" />
                Arkesel Account Balance
              </h3>
              <button
                className="btn-ghost p-4 rounded-full"
                style={{ minWidth: 'auto', border: 'none', background: 'rgba(0,0,0,0.03)' }}
                disabled={balanceLoading}
                onClick={() => fetchBalance(customApiKey)}
                title="Refresh Balance"
              >
                <RefreshCw size={12} className={balanceLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {balanceLoading ? (
              <div className="flex justify-center items-center py-20 text-muted text-sm gap-8">
                <Loader2 size={16} className="animate-spin" /> Querying balance...
              </div>
            ) : balanceError ? (
              <div className="p-12 bg-danger/10 text-danger rounded-xl border border-solid border-danger/20 text-xs flex gap-6">
                <AlertCircle size={14} className="flex-shrink-0 mt-2" />
                <div>
                  <div className="font-semibold">Query Failed</div>
                  <div>{balanceError}</div>
                </div>
              </div>
            ) : balanceData ? (
              <div className="flex flex-col gap-14">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span className="text-3xl font-bold font-display text-gold">
                    {balanceData.balance?.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted font-medium">SMS credits</span>
                </div>

                <div className="flex justify-between items-center text-xs pt-10 border-t border-solid" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-muted">Main Balance:</span>
                  <span className="font-semibold">GH₵ {balanceData.main_balance || '0.00'}</span>
                </div>
                
                {balanceData.user && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Registered User:</span>
                    <span className="font-medium text-right text-muted" title={balanceData.user}>
                      {balanceData.user.length > 20 ? `${balanceData.user.substring(0, 18)}...` : balanceData.user}
                    </span>
                  </div>
                )}

                <div className="badge badge-green mt-4 flex items-center gap-4 py-4 justify-center">
                  <CheckCircle2 size={10} /> Gateway Connection OK
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-muted text-sm">
                No balance retrieved. Save key or refresh.
              </div>
            )}
          </div>

          {/* Quick Templates */}
          <div className="card">
            <h3 className="text-sm text-muted text-uppercase tracking-wide font-semibold mb-12 flex items-center gap-6">
              <Info size={14} color="var(--info)" />
              Quick Templates
            </h3>
            <p className="text-xs text-muted mb-12">Click a template to load it. Autocompletes customer name if linked.</p>
            <div className="flex flex-col gap-8">
              {templates.map((t, idx) => (
                <button
                  key={idx}
                  className="btn-ghost flex flex-col items-start gap-4 p-8 text-left hover:border-gold-dim w-full"
                  onClick={() => applyTemplate(t.text)}
                  style={{ height: 'auto', borderRadius: 8 }}
                >
                  <span className="text-xs font-semibold text-gold">{t.title}</span>
                  <span className="text-[11px] text-muted line-clamp-2" style={{ lineHeight: 1.3 }}>{t.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* History / Log */}
          <div className="card flex-1 flex flex-col" style={{ minHeight: 280, maxHeight: 420 }}>
            <div className="flex justify-between items-center mb-12">
              <h3 className="text-sm text-muted text-uppercase tracking-wide font-semibold flex items-center gap-6">
                <History size={14} />
                Recent Activity
              </h3>
              {history.length > 0 && (
                <button
                  className="btn-ghost p-4 text-xs text-danger"
                  style={{ minWidth: 'auto', padding: '2px 6px', border: 'none' }}
                  onClick={handleClearHistory}
                  title="Clear Logs"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: 320 }}>
              {history.length === 0 ? (
                <div className="text-center py-40 text-muted text-xs flex flex-col items-center gap-8">
                  <History size={20} className="text-dim" />
                  <span>No message history in this session.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-8">
                  {history.map(item => (
                    <div
                      key={item.id}
                      className="p-8 rounded-lg text-xs"
                      style={{
                        background: 'var(--bg-elevated)',
                        borderLeft: `3px solid ${item.status === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                      }}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <span className="font-semibold text-muted" title={item.phone}>
                          {item.recipientName}
                        </span>
                        <span className="text-[10px] text-dim">
                          {format(new Date(item.timestamp), 'HH:mm dd MMM')}
                        </span>
                      </div>
                      <div className="text-muted line-clamp-2 mb-4" title={item.message} style={{ lineHeight: 1.3 }}>
                        {item.message}
                      </div>
                      <div className="flex items-center justify-between text-[9px] text-dim mt-4">
                        <span>
                          {item.type === 'scheduled' ? (
                            <span style={{ color: 'var(--warning)', fontWeight: 500 }}>
                              Scheduled: {item.scheduleTime}
                            </span>
                          ) : (
                            'Direct'
                          )}
                        </span>
                        <span>
                          {item.status === 'success' ? (
                            <span className="text-success font-medium">Sent</span>
                          ) : (
                            <span className="text-danger font-medium" title={item.error}>
                              Failed
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
