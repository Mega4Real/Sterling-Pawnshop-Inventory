/**
 * sw.js — Sterling Pawnshop Service Worker
 *
 * Handles:
 *   - push events: shows a notification on the device
 *   - notificationclick events: opens/focuses the app window
 *
 * Installed by NotificationBell.tsx via navigator.serviceWorker.register('/sw.js')
 * iOS 16.4+ required for push notifications from Home Screen PWAs.
 */

'use strict';

/** Keep the service worker alive long enough to show the notification. */
self.addEventListener('push', function (event) {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Sterling Pawnshop', body: event.data.text() };
  }

  const title = payload.title || 'Sterling Pawnshop';
  const options = {
    body: payload.body || 'You have a loan update.',
    icon: '/favicon/android-chrome-192x192.png',
    badge: '/favicon/favicon-32x32.png',
    tag: payload.tag || 'pawnshop-notification',   // collapses duplicates
    renotify: true,                                 // vibrate even if same tag
    data: { url: payload.url || '/buybacks' },      // used in notificationclick
    requireInteraction: false,
  };

  // waitUntil keeps the SW alive until the notification is shown
  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * When the user taps the notification:
 *  1. Close the notification banner.
 *  2. If the app is already open in a window, focus it.
 *  3. Otherwise open a new window to /buybacks.
 */
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/buybacks';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
      // Check if a window is already open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

/** Activate immediately — skip waiting for old SW to finish. */
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});
