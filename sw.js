/* TooSynced service worker — makes the app installable + snappy repeat loads.
   Network-first so deploys show up immediately; cache is only a fallback. */
const CACHE = "toosynced-v12";
const SHELL = [
  "index.html", "profile.html", "syncs.html", "invite.html",
  "app.html", "chat.html", "streaks.html", "settings.html",
  "assets/css/main.css",
  "assets/js/config.js", "assets/js/store.js", "assets/js/ui.js", "assets/js/native.js", "assets/js/plan.js", "assets/js/pro.js",
  "assets/js/auth.js", "assets/js/profile.js", "assets/js/syncs.js",
  "assets/js/invite.js", "assets/js/app.js", "assets/js/chat.js",
  "assets/js/streaks.js", "assets/js/settings.js",
  "manifest.webmanifest", "icons/favicon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-512-maskable.png"
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // let Firebase/CDN requests pass through
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});

/* tapping a notification focuses an open tab, or opens the app */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "app.html";
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if ("focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
