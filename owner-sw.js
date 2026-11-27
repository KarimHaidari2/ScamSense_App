/*
 * ScamSense Owner · phone alerts (service worker, only for owner.html)
 * The server sends an empty "tap" through Apple's or Google's push service. This asks the ScamSense
 * server what's new, using this phone's own device key, and shows it as a notification.
 * Tapping the notification opens that case in the Owner app.
 */
"use strict";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

async function deviceInfo() {
  try {
    const r = await (await caches.open("ss-owner")).match("device");
    return r ? await r.json() : null;
  } catch (e) {
    return null;
  }
}

async function showAlert() {
  let title = "ScamSense: someone needs help";
  let body = "Open the Owner app to see the case.";
  let url = "owner.html#cases";
  let tag = "ss-case";
  const d = await deviceInfo();
  if (d && d.server && d.device) {
    try {
      const r = await fetch(d.server, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ mode: "push_peek", device: d.device })
      });
      const j = await r.json();
      if (j && j.ok && j.title) {
        title = j.title;
        body = j.body || body;
        url = j.url || url;
        tag = j.tag || tag;
      }
    } catch (e) {}
  }
  return self.registration.showNotification(title, {
    body,
    tag,
    renotify: true,
    icon: "icon-192.png",
    badge: "icon-192.png",
    data: { url }
  });
}

self.addEventListener("push", e =>
  e.waitUntil(
    Promise.all([
      showAlert(),
      // If the Owner app is open, tell it to update right away.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then(list =>
          list.filter(c => /owner\.html/.test(c.url)).forEach(c => c.postMessage({ refresh: true }))
        )
    ])
  )
);

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(
    (e.notification.data && e.notification.data.url) || "owner.html#cases",
    self.registration.scope
  ).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const open = list.find(c => /owner\.html/.test(c.url));
      if (open) {
        open.postMessage({ go: url.split("#")[1] || "cases" });
        return open.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
