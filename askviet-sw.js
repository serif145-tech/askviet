const ASKVIET_SW_VERSION = '2026-06-24-push-badge-count-1';
const ASKVIET_BADGE_DB = 'askviet_badge_state';
const ASKVIET_BADGE_STORE = 'kv';
const ASKVIET_BADGE_KEY = 'unreadCount';

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

function openBadgeDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(ASKVIET_BADGE_DB, 1);
    req.onupgradeneeded = () => {
      try { req.result.createObjectStore(ASKVIET_BADGE_STORE); } catch {}
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getStoredBadgeCount() {
  const db = await openBadgeDb();
  return await new Promise(resolve => {
    const tx = db.transaction(ASKVIET_BADGE_STORE, 'readonly');
    const req = tx.objectStore(ASKVIET_BADGE_STORE).get(ASKVIET_BADGE_KEY);
    req.onsuccess = () => resolve(Number(req.result || 0));
    req.onerror = () => resolve(0);
    tx.oncomplete = () => db.close();
  });
}

async function setStoredBadgeCount(count) {
  const db = await openBadgeDb();
  return await new Promise(resolve => {
    const tx = db.transaction(ASKVIET_BADGE_STORE, 'readwrite');
    tx.objectStore(ASKVIET_BADGE_STORE).put(Math.max(0, Number(count || 0)), ASKVIET_BADGE_KEY);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { try { db.close(); } catch {}; resolve(); };
  });
}

async function applyBadgeCount(count) {
  try {
    if (count > 0) {
      if (self.registration.setAppBadge) await self.registration.setAppBadge(count);
      else if (navigator.setAppBadge) await navigator.setAppBadge(count);
    } else {
      if (self.registration.clearAppBadge) await self.registration.clearAppBadge();
      else if (navigator.clearAppBadge) await navigator.clearAppBadge();
      else if (navigator.setAppBadge) await navigator.setAppBadge(0);
    }
  } catch {}
}

async function bumpBadgeCount() {
  let count = 0;
  try { count = await getStoredBadgeCount(); } catch {}
  count += 1;
  try { await setStoredBadgeCount(count); } catch {}
  await applyBadgeCount(count);
  return count;
}

async function clearAskVietBadgeAndNotifications() {
  try { await setStoredBadgeCount(0); } catch {}
  await applyBadgeCount(0);
  try {
    if (self.registration.clearAppBadge) await self.registration.clearAppBadge();
  } catch {}
  try {
    const notifications = await self.registration.getNotifications({ includeTriggered: true });
    notifications.forEach(n => {
      try {
        const url = n.data && n.data.url;
        if (!url || String(url).includes('askviet')) n.close();
      } catch {}
    });
  } catch {}
}

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
  event.waitUntil((async () => {
    await bumpBadgeCount();
    await self.registration.showNotification(title, {
      body,
      icon: './witch.png',
      badge: './witch.png',
      tag: data.tag || 'askviet-new-message',
      renotify: true,
      data: { url, version: ASKVIET_SW_VERSION }
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './askviet.html';
  event.waitUntil((async () => {
    await clearAskVietBadgeAndNotifications();
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

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'ASKVIET_CLEAR_BADGE') {
    event.waitUntil(clearAskVietBadgeAndNotifications());
  }
});
