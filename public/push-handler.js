/* Saha V2 Web Push handlers. Imported by the generated Workbox service worker. */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    try {
      payload = { body: event.data.text() };
    } catch {
      payload = {};
    }
  }

  const title = String(payload.title || "Saha");
  const options = {
    body: String(payload.body || "Yeni bir bildiriminiz var."),
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    tag: payload.tag || "saha-notification",
    renotify: false,
    requireInteraction: Boolean(payload.requireInteraction),
    vibrate: Array.isArray(payload.vibrate) ? payload.vibrate : [200, 100, 200],
    data: {
      url: typeof payload.data?.url === "string" ? payload.data.url : "/randevu",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil((async () => {
    const rawUrl = event.notification.data?.url || "/randevu";
    const target = new URL(rawUrl, self.location.origin);

    // Never allow a notification payload to navigate users to another origin.
    if (target.origin !== self.location.origin) return;

    const windows = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    for (const client of windows) {
      if ("focus" in client) {
        await client.navigate(target.href);
        return client.focus();
      }
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(target.href);
    }
  })());
});
