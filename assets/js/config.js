/* ============================================================
   TooSynced - config
   ------------------------------------------------------------
   DEMO_MODE: true  = runs fully in the browser (localStorage),
                      no Firebase needed. Great for testing UI.
   DEMO_MODE: false = live mode. Paste your Firebase web config
                      below (Firebase console > Project settings
                      > Your apps > SDK setup and configuration).
   See README-SETUP.md for the full checklist.
   ============================================================ */

const CONFIG = {
  DEMO_MODE: false,

  FIREBASE: {
    apiKey: "AIzaSyB-4CnnmJXHX34B1BzzfQi7R7idI0UyKYM",
    authDomain: "toosynced-a4bed.firebaseapp.com",
    projectId: "toosynced-a4bed",
    storageBucket: "toosynced-a4bed.firebasestorage.app",
    messagingSenderId: "538505244645",
    appId: "1:538505244645:web:1c35166628d862229a090c",
    measurementId: "G-YXK596SZKW"
  },

  // Base URL used in invite links (no trailing slash)
  APP_URL: "https://toosynced.com",

  // App constants
  DEMO_PARTNER_NAME: "Jordan",

  /* ----------------------------------------------------------
     TooSynced Pro
     Prices are display-only for now - real billing comes with
     the app-store wrap (StoreKit / Play Billing via Capacitor)
     or Stripe on web. Nothing here charges anyone.
     ---------------------------------------------------------- */
  PRICE: {
    MONTHLY: 2.99,
    CURRENCY: "USD",
    SYMBOL: "$"
  },

  /* RevenueCat -> Google Play Billing. Paste from app.revenuecat.com:
     Project > API keys > Public app key (Android), and the entitlement id. */
  REVENUECAT: {
    ANDROID_KEY: "PASTE_REVENUECAT_ANDROID_PUBLIC_KEY",
    IOS_KEY: "PASTE_REVENUECAT_IOS_PUBLIC_KEY",
    ENTITLEMENT: "pro"
  },

  PLAN: {
    /* --- what free gets --- */
    FREE_MAX_SYNCS_OWNED: 2,        // syncs you CREATE. joining is unlimited.
    FREE_CAN_CREATE_GROUP: false,   // free can join groups, not start them
    FREE_NUDGES_SENT_PER_DAY: 5,
    FIRST_NUDGE_PER_TASK_FREE: true,// re-nudging the same task is what costs
    NUDGE_RESET: "local_midnight",
    FREE_STREAK_REPAIRS_PER_MONTH: 0,

    /* --- what Pro gets --- */
    PRO_NUDGES_SENT_PER_DAY: 40,
    PRO_STREAK_REPAIRS_PER_MONTH: 1,
    PRO_MAX_SYNCS_OWNED: 25
  }
};
