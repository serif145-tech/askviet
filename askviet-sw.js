const ASKVIET_SW_VERSION = '2026-06-23-web-push-1';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    try { data = { body: event.data.text() }; } catch { data = {}; }
  }
  const title = data.title || 'AskViet';
  const body = data.body || 'Yeni mesaj';
  const url = data.url || './askviet.html';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag: data.tag || 'askviet-new-message',
    renotify: true,
    data: { url, version: ASKVIET_SW_VERSION }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './askviet.html';
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const win of windows) {
      if ('focus' in win) {
        try { if ('navigate' in win) await win.navigate(url); } catch {}
        return win.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  })());
});
