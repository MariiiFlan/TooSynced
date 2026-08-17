/* ============================================================
   TooSynced - native bridge
   Loaded on every page. On the web it does nothing at all.
   Inside the Android/iOS wrapper it upgrades the web features
   to their native equivalents:
     - notifications  -> real system notifications
     - purchases      -> Google Play Billing via RevenueCat
     - location       -> native permission dialog
     - share          -> native share sheet
   ============================================================ */

const TSNative = (() => {
  const cap = window.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const plugin = (n) => (cap && cap.Plugins ? cap.Plugins[n] : null);

  return {
    isNative,
    platform: isNative && cap.getPlatform ? cap.getPlatform() : "web",
    plugin,

    /* ---------- startup ---------- */
    async init(user) {
      if (!isNative) return;
      document.documentElement.classList.add("is-native");

      /* status bar matches the theme */
      const SB = plugin("StatusBar");
      if (SB) {
        try {
          await SB.setStyle({ style: "LIGHT" });
          await SB.setBackgroundColor({ color: "#7C3AED" });
        } catch (e) {}
      }

      /* hide the splash once we've actually painted */
      const SS = plugin("SplashScreen");
      if (SS) setTimeout(() => SS.hide().catch(() => {}), 250);

      /* hardware back button: go back, or leave the app from the top level */
      const App = plugin("App");
      if (App) {
        App.addListener("backButton", ({ canGoBack }) => {
          const openModal = document.querySelector(".modal-veil.open");
          if (openModal) { openModal.classList.remove("open"); return; }
          if (canGoBack && history.length > 1) history.back();
          else App.exitApp();
        });
      }

      await this.setupNotifications();
      if (user) await this.setupPurchases(user);
    },

    /* ---------- notifications ---------- */
    async setupNotifications() {
      const LN = plugin("LocalNotifications");
      if (!LN) return;
      try {
        let perm = await LN.checkPermissions();
        if (perm.display !== "granted") perm = await LN.requestPermissions();
        if (perm.display !== "granted") return;
        await LN.createChannel({
          id: "toosynced",
          name: "Nudges and praise",
          description: "When someone nudges you or cheers you on",
          importance: 4,
          visibility: 1,
          lights: true,
          lightColor: "#7C3AED",
          vibration: true
        }).catch(() => {});
        LN.addListener("localNotificationActionPerformed", () => {
          if (!location.pathname.endsWith("app.html")) location.href = "app.html";
        });
      } catch (e) {}
    },

    /* fired by tsNotify() when running natively */
    async notify(title, body) {
      const LN = plugin("LocalNotifications");
      if (!LN) return false;
      try {
        await LN.schedule({
          notifications: [{
            id: Math.floor(Math.random() * 2147483000),
            title, body,
            channelId: "toosynced",
            smallIcon: "ic_stat_toosynced",
            iconColor: "#7C3AED"
          }]
        });
        return true;
      } catch (e) { return false; }
    },

    async haptic() {
      const H = plugin("Haptics");
      if (H) { try { await H.impact({ style: "MEDIUM" }); } catch (e) {} }
    },

    /* ---------- purchases (RevenueCat -> Google Play Billing) ---------- */
    async setupPurchases(user) {
      const P = plugin("Purchases");
      if (!P || !CONFIG.REVENUECAT || !CONFIG.REVENUECAT.ANDROID_KEY) return;
      if (CONFIG.REVENUECAT.ANDROID_KEY.startsWith("PASTE")) return;
      try {
        await P.configure({
          apiKey: CONFIG.REVENUECAT.ANDROID_KEY,
          appUserID: user.uid          // ties the purchase to the Firebase account
        });
        /* keep the local flag honest on every launch */
        const info = await P.getCustomerInfo();
        await this.applyEntitlement(info, user);
        P.addListener && P.addListener("customerInfoUpdate", (info2) => {
          this.applyEntitlement(info2, user);
        });
      } catch (e) { console.warn("purchases init", e); }
    },

    entitled(info) {
      const ent = ((info && (info.customerInfo || info)) || {}).entitlements;
      const active = ent && (ent.active || {});
      return !!(active && active[(CONFIG.REVENUECAT || {}).ENTITLEMENT || "pro"]);
    },

    /* The webhook is the source of truth. This only mirrors it locally so the
       UI unlocks instantly after a purchase instead of waiting on the round trip. */
    async applyEntitlement(info, user) {
      const isPro = this.entitled(info);
      if (isPro === !!(user && user.pro)) return;
      try { await Store.updateProfile({ pro: isPro }); } catch (e) {}
    },

    async buyPro() {
      const P = plugin("Purchases");
      if (!P) return { ok: false, reason: "unavailable" };
      try {
        const offerings = await P.getOfferings();
        const cur = offerings && (offerings.current || (offerings.all || {}).default);
        const pkg = cur && cur.availablePackages && cur.availablePackages[0];
        if (!pkg) return { ok: false, reason: "no-offering" };
        const res = await P.purchasePackage({ aPackage: pkg });
        return { ok: this.entitled(res), info: res };
      } catch (e) {
        const cancelled = e && (e.code === "1" || /cancel/i.test(e.message || ""));
        return { ok: false, reason: cancelled ? "cancelled" : "error", error: e };
      }
    },

    async restorePurchases() {
      const P = plugin("Purchases");
      if (!P) return false;
      try {
        const info = await P.restorePurchases();
        return this.entitled(info);
      } catch (e) { return false; }
    },

    /* ---------- location ---------- */
    async getPosition() {
      const G = plugin("Geolocation");
      if (!G) return null;
      const perm = await G.requestPermissions().catch(() => null);
      if (perm && perm.location === "denied") throw new Error("denied");
      const pos = await G.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      return pos.coords;
    },

    /* ---------- share ---------- */
    async share(text, url) {
      const S = plugin("Share");
      if (!S) return false;
      try { await S.share({ text, url, dialogTitle: "Share" }); return true; }
      catch (e) { return false; }
    }
  };
})();

/* ---- upgrade the web helpers when we're running natively ---- */
if (TSNative.isNative) {
  const webNotify = window.tsNotify;
  window.tsNotify = async (title, body, tag) => {
    const done = await TSNative.notify(title, body);
    if (!done && webNotify) return webNotify(title, body, tag);
  };
  window.tsAskNotify = async () => {
    await TSNative.setupNotifications();
    return "granted";
  };
  const webChime = window.tsChime;
  window.tsChime = () => { TSNative.haptic(); if (webChime) webChime(); };
}
