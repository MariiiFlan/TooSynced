# TooSynced — setup

**Firebase keys are already in `assets/js/config.js` and `DEMO_MODE` is off** —
this build talks to the real `toosynced-a4bed` project. (To demo without
Firebase, flip `DEMO_MODE: true` — any email/phone works, partner "Jordan"
responds automatically, demo SMS code is 123456.)

## Remaining Firebase steps

1. **Firestore** — Build → Firestore Database → Create database →
   production mode → pick a region (us-west is fine).
2. **Rules** — Firestore → Rules tab → replace everything with the contents
   of `firestore.rules` → Publish.
3. **Authorized domains** — Authentication → Settings → Authorized domains →
   add your `<user>.github.io` and `toosynced.com` when you have it.
   `localhost` is already there. **Google and Phone sign-in only work on
   domains in this list** — this is the #1 "why doesn't login work" cause.

## Sign-in methods (all wired)

- **Email + password** — with optional phone number saved on sign-up
- **Google** — popup
- **Phone (SMS code)** — invisible reCAPTCHA, then a 6-digit text.
  Heads up: the Spark free tier caps phone auth at **10 SMS/day** — plenty
  for you two, but the app shows a friendly error if the quota's hit.

## Deploy (GitHub Pages, same as your other sites)

1. New repo → drop this whole folder in → push.
2. Settings → Pages → deploy from `main` branch root.
3. Cloudflare DNS: CNAME `toosynced.com` → `<user>.github.io`, add the custom
   domain in Pages settings, then add that domain in Firebase authorized domains.

## Install as an app (PWA)

- **iPhone**: open the site in Safari → Share → **Add to Home Screen**.
- **Android**: Chrome shows an install prompt, or ⋮ → **Add to Home screen**.
The icon is the locked TooSynced calendar mark.

## How nudges work right now

Nudges sync instantly through Firestore while the app is open — chime, toast,
and a system notification (if the person allowed notifications). **Push
notifications when the app is closed** need Firebase Cloud Messaging plus a
small Cloud Function or Cloudflare Worker to send them — that's the next
upgrade, and also the moment before app-store wrapping with Capacitor.

## File map

- `index.html` + `assets/js/auth.js` — sign in / create account (email, Google, phone)
- `pair.html` + `pair.js` — invite link, join by code, waiting state
- `app.html` + `app.js` — schedule (day/week/month), check-offs, nudges, task modal
- `streaks.html` + `streaks.js` — streaks, heatmaps, weekly bars, insights
- `settings.html` + `settings.js` — name, phone, invite link, notifications, sign out
- `assets/js/config.js` — keys + mode flags (the only file you edit)
- `assets/js/store.js` — data layer (demo + Firebase behind one API)
- `firestore.rules` — paste into Firebase console
