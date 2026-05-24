// service-worker.js
// Listening to Push Events from backend (Supabase Edge Function)
self.addEventListener('push', function(event) {
  let payload = { title: 'เก่งดี มีสุข', body: 'มีความเคลื่อนไหวใหม่ในแอปของคุณ!' };
  
  if (event.data) {
    try {
      payload = event.data.json();
    } catch(e) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body,
    icon: '/img/logo.png', // Main app logo
    badge: '/img/badge.png', // Small notification icon for Android
    vibrate: [100, 50, 100], // Haptic feedback vibrate pattern
    data: {
      url: payload.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// Handle clicking on notification banner (open app tab or navigate to specific post)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      const targetUrl = event.notification.data.url;
      
      // If app is already open, focus it and redirect
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
