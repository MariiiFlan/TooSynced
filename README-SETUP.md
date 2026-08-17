# TooSynced — setup

The app ships in **demo mode**: open `index.html` and everything works in the
browser with sample data (partner "Jordan", auto-responses, the lot). Nothing
is sent anywhere. Use it to click through the whole flow.

## Go live with Firebase (10 min)

1. **Create the project** — https://console.firebase.google.com → Add project
   (call it `toosynced`). Analytics optional.
2. **Add a web app** — Project overview → the `</>` icon → register app.
   Copy the `firebaseConfig` block it shows you.
3. **Paste the config** — open `assets/js/config.js`, paste your values into
   `CONFIG.FIREBASE`, and set `DEMO_MODE: false`.
4. **Turn on Auth** — Build → Authentication → Get started →
   enable **Email/Password** and **Google**.
5. **Turn on Firestore** — Build → Firestore Database → Create database →
   production mode → pick a region (us-west is fine).
6. **Paste the rules** — Firestore → Rules tab → replace everything with the
   contents of `firestore.rules` → Publish.
7. **Authorize your domain** — Authentication → Settings → Authorized domains →
   add `toosynced.com` (and your `*.github.io` URL while testing).
8. **Set the app URL** — in `config.js`, `APP_URL` should be the live domain
   (used in invite links).

## Deploy (GitHub Pages, same as your other sites)

1. New repo → drop this whole folder in → push.
2. Settings → Pages → deploy from `main` branch root.
3. Cloudflare DNS: CNAME `toosynced.com` → `<user>.github.io`, add the custom
   domain in Pages settings.

## Install as an app (PWA)

- **iPhone**: open the site in Safari → Share → **Add to Home Screen**.
- **Android**: Chrome shows an install prompt, or ⋮ → **Add to Home screen**.
It opens fullscreen with the icon like a real app.

## How nudges work right now

Nudges sync instantly through Firestore while the app is open — chime, toast,
and a system notification (if the person allowed notifications). **Push
notifications when the app is closed** need Firebase Cloud Messaging plus a
small Cloud Function or Cloudflare Worker to send them — that's the next
upgrade, and also the moment before app-store wrapping with Capacitor.

## File map

- `index.html` + `assets/js/auth.js` — sign in / create account
- `pair.html` + `pair.js` — invite link, join by code, waiting state
- `app.html` + `app.js` — schedule (day/week/month), check-offs, nudges, task modal
- `streaks.html` + `streaks.js` — streaks, heatmaps, weekly bars, insights
- `settings.html` + `settings.js` — name, invite link, notifications, sign out
- `assets/js/config.js` — the only file you edit to go live
- `assets/js/store.js` — data layer (demo + Firebase behind one API)
- `firestore.rules` — paste into Firebase console
