# TooSynced - setup

**Firebase keys are already in `assets/js/config.js` and `DEMO_MODE` is off** -
this build talks to the real `toosynced-a4bed` project. (To demo without
Firebase, flip `DEMO_MODE: true` - any email/phone works, partner "Jordan"
responds automatically, demo SMS code is 123456.)

## Remaining Firebase steps

1. **Firestore** - Build → Firestore Database → Create database →
   production mode → pick a region (us-west is fine).
2. **Rules** - Firestore → Rules tab → replace everything with the contents
   of `firestore.rules` → Publish.
3. **Authorized domains** - Authentication → Settings → Authorized domains →
   add your `<user>.github.io` and `toosynced.com` when you have it.
   `localhost` is already there. **Google and Phone sign-in only work on
   domains in this list** - this is the #1 "why doesn't login work" cause.

## Sign-in methods (all wired)

- **Email + password** - with optional phone number saved on sign-up
- **Google** - popup
- **Phone (SMS code)** - invisible reCAPTCHA, then a 6-digit text.
  Heads up: the Spark free tier caps phone auth at **10 SMS/day** - plenty
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

Nudges sync instantly through Firestore while the app is open - chime, toast,
and a system notification (if the person allowed notifications). **Push
notifications when the app is closed** need Firebase Cloud Messaging plus a
small Cloud Function or Cloudflare Worker to send them - that's the next
upgrade, and also the moment before app-store wrapping with Capacitor.

## If the app looks broken or stale after an update

Browsers and the service worker cache aggressively. Every asset is
version-stamped (`main.css?v=5`), so a normal refresh picks up changes - but
if you ever see old styling, a missing function, or the old icon:

- **Desktop**: Ctrl+Shift+R (Cmd+Shift+R on Mac), or DevTools → Application →
  Service Workers → *Unregister*, then reload.
- **Phone (installed PWA)**: delete the home-screen icon, reload the site in
  the browser, then Add to Home Screen again.

When you deploy a change, bump the `?v=` number in the HTML files and the
`CACHE` name in `sw.js` - that forces everyone onto the new files.

## TooSynced Pro ($2.99/month)

All plan rules live in `CONFIG.PLAN` in `assets/js/config.js` - change the
numbers there, nothing else.

**Free**
- Create up to **2 syncs**. Two Syncs only.
- **Joining is unlimited and never blocked**, including group syncs. If a
  friend invites you, you always get in - a paywall that bounces an invited
  friend costs the inviter a member, so it never fires on join.
- 5 nudges a day. The *first nudge on each task* is always free; only
  re-nudging the same task burns the allowance. Resets at local midnight.

**Pro**
- Group Syncs, up to 25 syncs
- 1 streak restore a month (only offered when a real streak breaks)
- Sync themes and a custom streak icon, set by a Pro member and seen by everyone in that sync
- Chore rotation for group syncs, auto-posted to chat weekly
- Weekly recap card, shareable to Instagram/Snap
- 100 nudges a day

**Billing is not wired yet.** The paywall is real, the entitlement checks are
real, but "Get Pro" opens an honest screen saying checkout isn't live, plus a
button that flips Pro on locally so you can test against it. When you wrap
with Capacitor, replace `tsCheckout()` in `assets/js/plan.js` with StoreKit /
Play Billing (or Stripe on web) and set `pro` on the user doc from the
verified receipt - **verify server-side**, since a client-set flag can be
edited by anyone in devtools.

## Synced tasks

A fifth scope on the task sheet: **Everyone**. Instead of adding the task to
your own day, it proposes it to the sync. Everyone else gets a push and a card
on their schedule with **Add it** / **Not for me**. It only lands on their
schedule once they accept, as their own task.

The proposer is auto-accepted, and accepting sends a push back so they know.

## Dark mode

Settings > Appearance: **Auto / Light / Dark**. Auto follows the phone and
switches live if the phone does. Applied by an inline script in the head of
every page, so there is no white flash on load.

It is per device, not per account - stored in localStorage, not Firestore.
Your partner is not forced into your choice.

Everything runs off CSS variables, so a sync theme still works in dark mode:
the accent colour carries over but the surfaces stay dark, otherwise a pale
lavender background would be blinding at night.

## Synclings

A creature the sync raises together, on the Schedule screen.

- Hatch one at a **3 day streak**. Second at 30, third at 60. Max 3.
- **Three types**, chosen at hatch:
  - **Creature** - one pet you raise together
  - **Duo** - one each, side by side, mirroring each person's day
  - **Baby** - milestones instead of levels (swaddled, sitting up, toddling)
- **Four shapes** on top of that for Creature and Duo: Blob, Bean, Puff, Spike.
  Baby has its own silhouettes so the shape picker hides.
- Stages: Egg -> Hatchling (3) -> Young (10) -> Grown (30), aged from the
  streak it was born at, so they age independently.
- It reacts to **today**: proud when you have both finished, worried when
  something is missed, asleep late at night.
- **Break the streak and the youngest starts fading.** 48 hours to Restore it
  before it is gone. The eldest is always the last thing you can lose.
- **52 accessories**, 33 free and 19 Pro, unlocking from day 7 to day 365.
  Equip 3, one per category. Locked items stay visible with their unlock day.

Add accessories in `concepts/items.py` and regenerate `assets/js/items.js`.
No other code changes needed.

## How syncs work

A **sync** is a shared space. Two kinds:

- **Two Sync** - exactly two people, side-by-side days.
- **Group Sync** - three or more, a column per person, plus group chat.

You can be in as many syncs as you want and switch between them from the
pill in the top-right of every page. Each sync has its own name, photo,
invite code, tasks, streaks, and chat.

## File map

- `index.html` + `auth.js` - sign in / create account (email, Google, phone)
- `profile.html` + `profile.js` - name, photo, birthday
- `syncs.html` + `syncs.js` - your syncs, create Two/Group, join by code
- `invite.html` + `invite.js` - invite link + who's in the sync
- `app.html` + `app.js` - schedule, check-offs, nudges, praise, task modal
- `chat.html` + `chat.js` - messages inside a sync
- `streaks.html` + `streaks.js` - streaks, heatmaps, weekly bars, insights
- `settings.html` + `settings.js` - profile, sync name, invite, leave sync
- `assets/js/config.js` - keys + mode flags (the only file you edit)
- `assets/js/store.js` - data layer (demo + Firebase behind one API)
- `firestore.rules` - paste into Firebase console (**updated for syncs - re-paste it**)
