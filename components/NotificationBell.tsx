/**
 * components/NotificationBell.tsx
 *
 * A bell icon button rendered in the sidebar footer.
 * Handles the full Web Push permission + subscription flow:
 *
 *   1. Checks if push notifications are supported (iOS 16.4+ PWA required).
 *   2. Checks current permission state (granted / denied / default).
 *   3. On click:
 *      - If not yet subscribed → request permission → subscribe → POST to /api/subscribe.
 *      - If already subscribed → unsubscribe → DELETE from /api/subscribe.
 *   4. Persists subscription state in localStorage so the bell reflects
 *      the correct icon between page loads.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';

/** Convert a base64url VAPID public key to the Uint8Array format required by the browser. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  const output  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

type SubState = 'unsupported' | 'denied' | 'subscribed' | 'unsubscribed' | 'loading';

/**
 * NotificationBell — shown in the sidebar footer.
 * Allows staff to enable / disable push notifications on their device.
 */
export default function NotificationBell() {
  const [state, setState]     = useState<SubState>('loading');
  const [tooltip, setTooltip] = useState('');

  /**
   * Determines the initial subscription state by checking:
   *  - Browser support (ServiceWorker + PushManager)
   *  - Current Notification permission
   *  - Whether a live subscription already exists for this SW registration
   */
  const checkState = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Check browser/PWA support
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState('unsupported');
      setTooltip('Push notifications not supported on this device/browser.\nOpen from Home Screen on iOS 16.4+.');
      return;
    }

    if (Notification.permission === 'denied') {
      setState('denied');
      setTooltip('Notifications blocked. Enable them in iPhone Settings → Sterling Pawnshop.');
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        setState('subscribed');
        setTooltip('Notifications ON — tap to disable');
      } else {
        setState('unsubscribed');
        setTooltip('Tap to enable loan due & overdue notifications');
      }
    } catch {
      setState('unsubscribed');
      setTooltip('Tap to enable notifications');
    }
  }, []);

  /** Register the service worker and recheck state on mount. */
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then(() => checkState())
        .catch((err) => {
          console.error('[NotificationBell] SW register failed:', err);
          checkState();
        });
    } else {
      checkState();
    }
  }, [checkState]);

  /** Subscribe this device and save to the server. */
  async function subscribe() {
    setState('loading');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'unsubscribed');
        setTooltip('Permission not granted.');
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ) as BufferSource,
      });

      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!res.ok) throw new Error(await res.text());

      setState('subscribed');
      setTooltip('Notifications ON — tap to disable');
    } catch (err) {
      console.error('[NotificationBell] subscribe error:', err);
      setState('unsubscribed');
      setTooltip('Failed to enable notifications. Try again.');
    }
  }

  /** Unsubscribe this device and remove from server. */
  async function unsubscribe() {
    setState('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState('unsubscribed');
      setTooltip('Tap to enable loan due & overdue notifications');
    } catch (err) {
      console.error('[NotificationBell] unsubscribe error:', err);
      await checkState();
    }
  }

  async function handleClick() {
    if (state === 'loading' || state === 'unsupported' || state === 'denied') return;
    if (state === 'subscribed') {
      await unsubscribe();
    } else {
      await subscribe();
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const iconMap: Record<SubState, React.ReactNode> = {
    subscribed:   <BellRing size={14} aria-hidden="true" />,
    unsubscribed: <Bell     size={14} aria-hidden="true" />,
    denied:       <BellOff  size={14} aria-hidden="true" />,
    unsupported:  <BellOff  size={14} aria-hidden="true" />,
    loading:      <Bell     size={14} aria-hidden="true" />,
  };

  const labelMap: Record<SubState, string> = {
    subscribed:   'Notifications ON',
    unsubscribed: 'Enable Notifications',
    denied:       'Notifications Blocked',
    unsupported:  'Not Supported',
    loading:      'Checking…',
  };

  const isInteractive = state === 'subscribed' || state === 'unsubscribed';

  return (
    <button
      id="notification-bell-btn"
      onClick={handleClick}
      disabled={!isInteractive}
      title={tooltip}
      aria-label={tooltip || labelMap[state]}
      className={`btn-ghost sidebar-sign-out-btn${state === 'subscribed' ? ' notification-bell--active' : ''}${state === 'loading' ? ' notification-bell--loading' : ''}`}
      style={{
        opacity: state === 'unsupported' || state === 'denied' ? 0.5 : 1,
        cursor: isInteractive ? 'pointer' : 'default',
      }}
    >
      {iconMap[state]}
      <span>{labelMap[state]}</span>
      {state === 'subscribed' && (
        <span
          aria-hidden="true"
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: '#22c55e',
            display: 'inline-block',
            marginLeft: 2,
            flexShrink: 0,
          }}
        />
      )}
    </button>
  );
}
