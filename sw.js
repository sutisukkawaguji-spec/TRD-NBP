// ============================================================
// 🔔 Happy Meter - Service Worker (Push Notification + Cache)
// ============================================================
const CACHE_NAME = 'happy-meter-v7';  // ✅ เพิ่มเลขทุกครั้งที่แก้ไขโค้ด เพื่อบังคับล้าง cache

const ICON_URL = 'app-icon.png';

// ========================
// Install: Cache ไฟล์หลัก
// ========================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                '/',
                '/index.html',
                '/survey.html',
                '/manifest.json'
            ]).catch(() => { }); // ไม่ fail ถ้า cache บางไฟล์ไม่ได้
        })
    );
    self.skipWaiting();
});

// ========================
// Activate: ล้าง cache เก่า
// ========================
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// ========================
// Fetch: Network first, fallback to cache
// ========================
self.addEventListener('fetch', event => {
    // ข้าม non-GET requests และ GAS API
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('script.google.com')) return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});

// ============================================================
// 🔔 Push Event: รับและแสดง Notification จากเซิร์ฟเวอร์
// ============================================================
self.addEventListener('push', event => {
    let data = { title: '😊 Happy Meter', body: 'มีข้อความใหม่สำหรับคุณ!', tag: 'happy-push' };
    try {
        data = event.data.json();
    } catch (e) {
        if (event.data) data.body = event.data.text();
    }

    const options = {
        body: data.body || 'มีข้อความใหม่',
        icon: data.icon || ICON_URL,
        badge: ICON_URL,
        tag: data.tag || 'happy-general',
        data: { url: data.url || '/index.html' },
        vibrate: [200, 100, 200],
        requireInteraction: false,
        actions: [
            { action: 'open', title: '📱 เปิดแอป' },
            { action: 'close', title: '✕ ปิด' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(data.title || '😊 Happy Meter', options)
    );
});

// ============================================================
// 🔔 Notification Click: เปิดแอปเมื่อคลิก notification
// ============================================================
self.addEventListener('notificationclick', event => {
    event.notification.close();

    if (event.action === 'close') return;

    const urlToOpen = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : '/index.html';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // ถ้า app เปิดอยู่แล้ว focus window นั้น
            for (const client of clientList) {
                if (client.url.includes('index.html') && 'focus' in client) {
                    return client.focus();
                }
            }
            // ถ้าไม่มีให้เปิด window ใหม่
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});

// ============================================================
// 📨 Message from main page: แสดง notification ทันที
// ============================================================
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
        const { title, body, tag, url } = event.data;
        self.registration.showNotification(title || '😊 Happy Meter', {
            body: body || '',
            icon: ICON_URL,
            badge: ICON_URL,
            tag: tag || 'happy-msg',
            data: { url: url || '/index.html' },
            vibrate: [150, 50, 150]
        });
    }
});
