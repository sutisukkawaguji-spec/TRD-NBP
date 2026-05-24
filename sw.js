// ============================================================
// 🔔 Happy Meter - Service Worker (Push Notification + Cache)
// ============================================================
const CACHE_NAME = 'happy-meter-v25';  // ✅ เพิ่มเลขทุกครั้งที่แก้ไขโค้ด เพื่อบังคับล้าง cache

const ICON_URL = 'app-icon.png?v=2';

// ========================
// Install: Cache ไฟล์หลัก
// ========================
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // ใช้ cache: 'reload' เพื่อบังคับดึงไฟล์ใหม่จากเซิร์ฟเวอร์ (ข้าม HTTP Cache ของเบราว์เซอร์)
            const urlsToCache = [
                '/',
                '/index.html',
                '/survey.html',
                '/manifest.json'
            ];
            
            return Promise.all(
                urlsToCache.map(url => {
                    return fetch(new Request(url, { cache: 'reload' }))
                        .then(response => {
                            if (response.ok) {
                                return cache.put(url, response);
                            }
                        })
                        .catch(() => { }); // ไม่ fail ถ้าบางไฟล์โหลดไม่ได้
                })
            );
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
                // อัปเดตแคชเฉพาะเมื่อได้ response ที่สมบูรณ์ (status 200)
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
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
        data: { url: data.url || 'index.html' },
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

    let targetPath = (event.notification.data && event.notification.data.url)
        ? event.notification.data.url
        : 'index.html';

    // ถ้าขึ้นต้นด้วย / ให้ลบออกเพื่อให้เป็น relative path ภายใต้โฟลเดอร์ของ PWA
    if (targetPath.startsWith('/')) {
        targetPath = targetPath.slice(1);
    }
    if (targetPath === '') {
        targetPath = 'index.html';
    }

    // ดึงโฟลเดอร์หลักของ PWA โดยอิงตามตำแหน่งของไฟล์ sw.js ตัวเอง (ปลอดภัยที่สุด ไม่ว่า scope จะเป็นแบบใด)
    const swUrl = self.location.href;
    const baseDir = swUrl.substring(0, swUrl.lastIndexOf('/') + 1);
    let urlToOpen = new URL(targetPath, baseDir).href;

    // 🌟 ดักจับเคสพิเศษ: ถ้าลิงก์ที่ถูกสร้างชี้ไปที่ root domain ของ github.io ตรงๆ (เช่น https://sutisukkawaguji-spec.github.io/index.html)
    // ให้แปลงสลับให้มาเปิดภายใต้โฟลเดอร์แอปหลัก (baseDir) ทันที เพื่อป้องกัน 404 สำหรับการแจ้งเตือนเก่าที่ค้างอยู่ในเครื่อง
    try {
        const resolvedUrl = new URL(urlToOpen);
        if (resolvedUrl.pathname === '/index.html' || resolvedUrl.pathname === '/') {
            const targetWithQuery = 'index.html' + resolvedUrl.search;
            urlToOpen = new URL(targetWithQuery, baseDir).href;
        }
    } catch (e) {
        console.error('Error resolving fallback URL:', e);
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            // ถ้ามีแอปเปิดอยู่แล้ว ให้ focus หน้าเดิม
            for (const client of clientList) {
                if (client.url.startsWith(baseDir) && 'focus' in client) {
                    return client.focus();
                }
            }
            // ถ้าแอปปิดอยู่ ให้เปิดลิงก์เต็มรูปแบบ
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
            data: { url: url || 'index.html' },
            vibrate: [150, 50, 150]
        });
    }
});
