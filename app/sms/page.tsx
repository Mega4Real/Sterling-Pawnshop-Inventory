'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useCachedData } from '@/lib/data-cache';
import { useToast } from '@/components/Toast';
import {
  Send,
  Calendar,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  Loader2,
  Coins,
  CheckCircle2,
  Trash2,
  Info,
  History,
} from 'lucide-react';
import { format } from 'date-fns';

/**
 * Fetcher function to load customers from Supabase.
 * Used by useCachedData to avoid duplicate network calls.
 */
const fetchCustomers = async () => {
  const { data, error } = await supabase.from('customers').select('*').order('full_name');
  if (error) throw error;
  return data || [];
};

/** Shape of a local activity log entry stored in localStorage */
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

  // ── Balance states ──────────────────────────────────────────────────────
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceData, setBalanceData] = useState<any>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // ── Form states ─────────────────────────────────────────────────────────
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [senderId, setSenderId] = useState('Pawnshop');

  // ── Schedule states ─────────────────────────────────────────────────────
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // ── Send state & history ────────────────────────────────────────────────
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  /** Load persisted activity log from localStorage on mount and fetch initial balance */
  useEffect(() => {
    const savedHistory = localStorage.getItem('sterling_sms_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {
        // Corrupted data — ignore silently
      }
    }
    fetchBalance();
  }, []);

  /**
   * Fetches the Arkesel account balance via the server-side route.
   * The API key is never sent from the client — it is resolved server-side.
   */
  async function fetchBalance() {
    setBalanceLoading(true);
    setBalanceError(null);
    try {
      const res = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check-balance' }),
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

  /** Syncs phone number field when a customer is selected from the dropdown */
  function handleCustomerSelect(custId: string) {
    setSelectedCustomerId(custId);
    if (!custId) {
      setPhone('');
      return;
    }
    const customer = customers.find(c => c.id === custId);
    if (customer) setPhone(customer.phone || '');
  }

  // ── Character counter & SMS parts indicator ─────────────────────────────
  const charCount = message.length;
  const smsParts = charCount <= 160 ? (charCount === 0 ? 0 : 1) : Math.ceil(charCount / 153);

  /**
   * Converts HTML5 date/time inputs to the Arkesel schedule format.
   * Input: "2026-12-25" + "14:30" → Output: "25-12-2026 02:30 PM"
   */
  function getFormattedSchedule(): string {
    if (!scheduleDate || !scheduleTime) return '';
    const [year, month, day] = scheduleDate.split('-');
    const [hour24Str, minute] = scheduleTime.split(':');
    let hour = parseInt(hour24Str, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    const paddedHour = hour < 10 ? `0${hour}` : String(hour);
    return `${day}-${month}-${year} ${paddedHour}:${minute} ${ampm}`;
  }

  // ── Quick SMS templates ──────────────────────────────────────────────────
  const templates = [
    {
      title: 'Maturity Reminder',
      text: 'Hello [Customer], this is a reminder from Sterling Pawnshop. Your buyback agreement is due soon. Please visit our shop to redeem your item. Thank you.',
    },
    {
      title: 'Overdue Notice',
      text: 'Hello [Customer], this is an urgent notice from Sterling Pawnshop. Your buyback is overdue. Please settle within 2 days to avoid forfeiture of your item. Contact us for assistance.',
    },
    {
      title: 'Welcome Message',
      text: 'Hello [Customer], thank you for transacting with Sterling Pawnshop. Your items have been securely cataloged. Please keep your agreement ticket safe.',
    },
  ];

  /**
   * Loads a template into the message field.
   * Substitutes [Customer] with the selected customer's full name if available.
   */
  function applyTemplate(text: string) {
    let msg = text;
    if (selectedCustomerId) {
      const customer = customers.find(c => c.id === selectedCustomerId);
      if (customer) msg = msg.replace(/\[Customer\]/g, customer.full_name);
    }
    setMessage(msg);
  }

  /** Clears the local activity log */
  function handleClearHistory() {
    if (!confirm('Clear your local SMS activity log?')) return;
    localStorage.removeItem('sterling_sms_history');
    setHistory([]);
    showToast('success', 'History Cleared', 'Local log wiped.');
  }

  /**
   * Validates inputs, builds the request payload, dispatches to the server
   * route, and logs the result in the local activity history.
   *
   * Note: The API key is NEVER sent from the client. The server reads it
   * from the ARKESEL_API_KEY environment variable exclusively.
   */
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
        showToast('error', 'Missing Schedule', 'Please set both a date and time to schedule.');
        return;
      }
      if (new Date(`${scheduleDate}T${scheduleTime}`) <= new Date()) {
        showToast('error', 'Invalid Time', 'Scheduled time must be in the future.');
        return;
      }
      scheduleTimeStr = getFormattedSchedule();
    }

    setSending(true);
    try {
      const activeCustomer = customers.find(c => c.id === selectedCustomerId);
      const recipientName = activeCustomer?.full_name || 'Manual Entry';

      const res = await fetch('/api/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-sms',
          to: phone,
          sms: message,
          from: senderId || undefined,
          schedule: isScheduled ? scheduleTimeStr : undefined,
          // NOTE: No apiKey field — the server uses ARKESEL_API_KEY env var only.
        }),
      });

      const result = await res.json();

      // Persist result to local activity log
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

      if (result.success) {
        showToast('success', 'SMS Sent', result.message || 'Message dispatched.');
        setMessage('');
        fetchBalance();
      } else {
        showToast('error', 'SMS Failed', result.message || 'Could not send SMS.');
      }
    } catch (err: any) {
      showToast('error', 'Network Error', err.message || 'Failed to reach the server.');
    } finally {
      setSending(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl sm:text-3xl mb-1 sm:mb-4">SMS Portal</h1>
          <p className="text-muted text-xs sm:text-sm">Send reminders, alerts, and custom messages to pawnshop clients.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">

        {/* ── Left: Compose form ──────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-24">
          <div className="card">
            <h2 className="text-lg font-bold mb-16 flex items-center gap-8">
              <MessageSquare size={18} color="var(--red)" />
              Compose Message
            </h2>

            <div className="form-grid">
              {/* Customer selector */}
              <div className="full">
                <label className="label">Link Customer (Optional)</label>
                {loadingCustomers ? (
                  <div className="text-muted text-sm flex items-center gap-6 p-10" style={{ background: 'var(--bg-elevated)', borderRadius: 8 }}>
                    <Loader2 size={12} className="animate-spin" /> Loading customer list…
                  </div>
                ) : (
                  <select
                    className="input"
                    value={selectedCustomerId}
                    onChange={e => handleCustomerSelect(e.target.value)}
                    title="Select customer"
                  >
                    <option value="">— Choose a registered customer —</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.phone || 'no phone'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Phone number */}
              <div>
                <label className="label">Phone Number *</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. 0244000000"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>

              {/* Sender ID */}
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

              {/* Message + char counter */}
              <div className="full">
                <div className="flex justify-between items-center mb-4">
                  <label className="label" style={{ margin: 0 }}>Message *</label>
                  <span className="text-xs text-muted">
                    {charCount} chars ·{' '}
                    <strong style={{ color: smsParts > 1 ? 'var(--warning)' : 'inherit' }}>
                      {smsParts} {smsParts === 1 ? 'part' : 'parts'}
                    </strong>{' '}
                    (160 / 153 char limit)
                  </span>
                </div>
                <textarea
                  className="input"
                  rows={5}
                  placeholder="Type your message here…"
                  style={{ resize: 'vertical' }}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
              </div>

              {/* Schedule toggle */}
              <div className="full">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="mb-10">
                  <input
                    type="checkbox"
                    id="schedule-toggle"
                    checked={isScheduled}
                    onChange={e => setIsScheduled(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label
                    htmlFor="schedule-toggle"
                    className="label"
                    style={{ margin: 0, textTransform: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Schedule for a future date &amp; time
                  </label>
                </div>

                {isScheduled && (
                  <div
                    className="grid grid-cols-2 gap-12 mt-12 p-12 rounded-xl border-gold-dim bg-gold-faint"
                  >
                    <div>
                      <label className="label">Date</label>
                      <input
                        type="date"
                        className="input"
                        value={scheduleDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={e => setScheduleDate(e.target.value)}
                        title="Schedule date"
                      />
                    </div>
                    <div>
                      <label className="label">Time</label>
                      <input
                        type="time"
                        className="input"
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        title="Schedule time"
                      />
                    </div>
                    <div className="full text-xs text-muted flex items-center gap-6 mt-4">
                      <Calendar size={12} />
                      {scheduleDate && scheduleTime ? (
                        <>Will send: <strong className="text-gold">{getFormattedSchedule()}</strong></>
                      ) : (
                        'Please select a date and time above.'
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Send button */}
            <div style={{ marginTop: 24 }}>
              <button
                className="btn-gold"
                onClick={handleSendMessage}
                disabled={sending}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {sending ? (
                  <><Loader2 size={16} className="animate-spin" /> Dispatching…</>
                ) : (
                  <><Send size={16} /> {isScheduled ? 'Schedule Message' : 'Send SMS Now'}</>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Balance, templates, history ─────────────────────────── */}
        <div className="w-full lg:w-[340px] flex-shrink-0 flex flex-col gap-24">

          {/* Balance card */}
          <div className="card" style={{ background: 'linear-gradient(135deg, #ffffff 0%, var(--bg) 100%)' }}>
            <div className="flex justify-between items-center mb-16">
              <h3 className="text-sm text-muted text-uppercase tracking-wide font-semibold flex items-center gap-6">
                <Coins size={14} color="var(--red)" />
                Arkesel Account Balance
              </h3>
              <button
                className="btn-ghost"
                style={{ minWidth: 'auto', padding: 6, border: 'none', background: 'rgba(0,0,0,0.03)', borderRadius: '50%' }}
                disabled={balanceLoading}
                onClick={fetchBalance}
                title="Refresh balance"
              >
                <RefreshCw size={12} className={balanceLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {balanceLoading ? (
              <div className="flex justify-center items-center py-20 text-muted text-sm gap-8">
                <Loader2 size={16} className="animate-spin" /> Querying balance…
              </div>
            ) : balanceError ? (
              <div
                className="text-xs flex gap-6 p-12 rounded-xl"
                style={{ background: 'rgba(220,38,38,0.07)', color: 'var(--danger)', border: '1px solid rgba(220,38,38,0.15)' }}
              >
                <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div className="font-semibold mb-4">Balance unavailable</div>
                  <div>{balanceError}</div>
                </div>
              </div>
            ) : balanceData ? (
              <div className="flex flex-col gap-14">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span className="text-3xl font-bold text-gold" style={{ fontFamily: 'var(--font-display)' }}>
                    {balanceData.balance?.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted font-medium">SMS credits</span>
                </div>

                <div
                  className="flex justify-between items-center text-xs pt-10"
                  style={{ borderTop: '1px solid var(--border)' }}
                >
                  <span className="text-muted">Main Balance</span>
                  <span className="font-semibold">GH₵ {balanceData.main_balance ?? '0.00'}</span>
                </div>

                {balanceData.user && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted">Account</span>
                    <span className="font-medium text-muted" title={balanceData.user}>
                      {balanceData.user.length > 22
                        ? `${balanceData.user.substring(0, 20)}…`
                        : balanceData.user}
                    </span>
                  </div>
                )}

                <div className="badge badge-green flex items-center gap-4 py-4 justify-center mt-4">
                  <CheckCircle2 size={10} /> Gateway Connected
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-muted text-sm">
                Click refresh to check balance.
              </div>
            )}
          </div>

          {/* Quick templates */}
          <div className="card">
            <h3 className="text-sm text-muted text-uppercase tracking-wide font-semibold mb-12 flex items-center gap-6">
              <Info size={14} color="var(--info)" />
              Quick Templates
            </h3>
            <p className="text-xs text-muted mb-12">
              Click a template to load it. Customer name auto-fills if a customer is selected.
            </p>
            <div className="flex flex-col gap-8">
              {templates.map((t, idx) => (
                <button
                  key={idx}
                  className="btn-ghost flex flex-col items-start gap-4 p-8 text-left w-full"
                  onClick={() => applyTemplate(t.text)}
                  style={{ height: 'auto', borderRadius: 8 }}
                >
                  <span className="text-xs font-semibold text-gold">{t.title}</span>
                  <span className="text-muted" style={{ fontSize: 11, lineHeight: 1.35 }}>{t.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Activity log */}
          <div className="card flex flex-col" style={{ minHeight: 260, maxHeight: 400 }}>
            <div className="flex justify-between items-center mb-12">
              <h3 className="text-sm text-muted text-uppercase tracking-wide font-semibold flex items-center gap-6">
                <History size={14} />
                Recent Activity
              </h3>
              {history.length > 0 && (
                <button
                  className="btn-ghost text-danger"
                  style={{ minWidth: 'auto', padding: '2px 6px', border: 'none', fontSize: 11 }}
                  onClick={handleClearHistory}
                  title="Clear log"
                >
                  <Trash2 size={11} /> Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 320 }}>
              {history.length === 0 ? (
                <div className="text-center py-40 text-muted text-xs flex flex-col items-center gap-8">
                  <History size={20} style={{ opacity: 0.3 }} />
                  No activity yet.
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
                        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                          {format(new Date(item.timestamp), 'HH:mm dd MMM')}
                        </span>
                      </div>
                      <div
                        className="text-muted mb-4"
                        title={item.message}
                        style={{ lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {item.message}
                      </div>
                      <div className="flex items-center justify-between" style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                        <span>
                          {item.type === 'scheduled' ? (
                            <span style={{ color: 'var(--warning)', fontWeight: 500 }}>
                              Scheduled · {item.scheduleTime}
                            </span>
                          ) : 'Direct'}
                        </span>
                        <span style={{ color: item.status === 'success' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                          {item.status === 'success' ? 'Sent' : 'Failed'}
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
