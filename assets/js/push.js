/* ============================================================
   TooSynced - push notifications
   Notifications that arrive when the app is CLOSED.

   How it works without paying for Cloud Functions:
     1. every device registers an FCM token, stored on the user doc
     2. when you nudge/praise/shame/message someone, your device asks a
        small Cloudflare Worker to deliver it
     3. the Worker looks up their token and calls FCM

   No Firebase Blaze plan needed. If PUSH_ENDPOINT is blank the app
   behaves exactly as before - in-app alerts only.
   ============================================================ */

const TSPush = (() => {
  let me = null;
  let token = null;
  let ready = false;

  const native = () => !!(window.Capacitor && window.Capacitor.isNativePlatform
    && window.Capacitor.isNativePlatform());
  const plugin = (n) => (window.Capacitor && window.Capacitor.Plugins
    ? window.Capacitor.Plugins[n] : null);

  /* ---------- registration ---------- */
  async function init(user) {
    me = user;
    if (!user) return;
    try {
      if (native()) await initNative();
      else await initWeb();
    } catch (e) {
      console.warn("[push] not available:", e && e.message);
    }
  }

  async function initNative() {
    const PN = plugin("PushNotifications");
    if (!PN) return;

    let perm = await PN.checkPermissions();
    if (perm.receive !== "granted") perm = await PN.requestPermissions();
    if (perm.receive !== "granted") return;

    PN.addListener("registration", (t) => { saveToken(t.value); });
    PN.addListener("registrationError", (e) => console.warn("[push] registration failed", e));

    /* arrived while the app is open - the in-app alert layer already
       handles this case, so don't double-notify */
    PN.addListener("pushNotificationReceived", () => {});

    /* tapped a notification from the tray */
    PN.addListener("pushNotificationActionPerformed", (a) => {
      const d = (a && a.notification && a.notification.data) || {};
      if (d.syncId && Store.setActiveSync) {
        Store.setActiveSync(d.syncId).then(() => {
          location.href = d.page || "app.html";
        }).catch(() => { location.href = d.page || "app.html"; });
      } else {
        location.href = d.page || "app.html";
      }
    });

    await PN.register();
    ready = true;
  }

  async function initWeb() {
    if (CONFIG.DEMO_MODE) return;
    if (!CONFIG.VAPID_KEY) return;
    if (typeof firebase === "undefined" || !firebase.messaging) return;
    if (!("serviceWorker" in navigator) || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker.ready;
    const messaging = firebase.messaging();
    const t = await messaging.getToken({ vapidKey: CONFIG.VAPID_KEY, serviceWorkerRegistration: reg });
    if (t) saveToken(t);
    ready = true;
  }

  async function saveToken(t) {
    if (!t || t === token) return;
    token = t;
    try {
      const platform = native() ? (window.Capacitor.getPlatform ? window.Capacitor.getPlatform() : "android") : "web";
      await Store.updateProfile({
        pushToken: t,
        pushPlatform: platform,
        pushUpdated: Date.now()
      });
    } catch (e) { console.warn("[push] could not store token", e); }
  }

  /* ---------- sending ----------
     Fire and forget. A failure here must never break the action that
     triggered it - the in-app alert has already happened. */
  async function send(toUid, title, body, data) {
    if (!CONFIG.PUSH_ENDPOINT) return false;
    if (!toUid || toUid === (me && me.uid)) return false;
    try {
      const res = await fetch(CONFIG.PUSH_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toUid,
          from: me ? me.uid : null,
          title: title,
          body: body,
          data: data || {}
        })
      });
      return res.ok;
    } catch (e) {
      console.warn("[push] send failed", e);
      return false;
    }
  }

  /* everyone in the sync except me */
  async function sendToSync(sync, title, body, data) {
    if (!sync || !me) return;
    const others = (sync.memberUids || []).filter(u => u !== me.uid);
    await Promise.all(others.map(u => send(u, title, body, data)));
  }

  return { init, send, sendToSync, get token() { return token; }, get ready() { return ready; } };
})();
