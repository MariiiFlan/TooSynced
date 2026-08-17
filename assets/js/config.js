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
  NUDGE_DAILY_LIMIT: 10,
  DEMO_PARTNER_NAME: "Jordan"
};
