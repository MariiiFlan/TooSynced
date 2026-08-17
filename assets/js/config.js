/* ============================================================
   TooSynced — config
   ------------------------------------------------------------
   DEMO_MODE: true  = runs fully in the browser (localStorage),
                      no Firebase needed. Great for testing UI.
   DEMO_MODE: false = live mode. Paste your Firebase web config
                      below (Firebase console > Project settings
                      > Your apps > SDK setup and configuration).
   See README-SETUP.md for the full checklist.
   ============================================================ */

const CONFIG = {
  DEMO_MODE: true,

  FIREBASE: {
    apiKey: "PASTE_API_KEY",
    authDomain: "PASTE_PROJECT.firebaseapp.com",
    projectId: "PASTE_PROJECT_ID",
    storageBucket: "PASTE_PROJECT.appspot.com",
    messagingSenderId: "PASTE_SENDER_ID",
    appId: "PASTE_APP_ID"
  },

  // Base URL used in invite links (no trailing slash)
  APP_URL: "https://toosynced.com",

  // App constants
  NUDGE_DAILY_LIMIT: 10,
  DEMO_PARTNER_NAME: "Jordan"
};
