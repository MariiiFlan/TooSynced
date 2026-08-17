/* ============================================================
   TooSynced - plan, entitlements, paywall, themes
   Included on every page. Never gates JOINING a sync: if a
   friend invites you, you always get in, Pro or not.
   ============================================================ */

const TSPlan = (() => {
  const P = CONFIG.PLAN;

  function isPro(user) {
    if (!user) return false;
    if (!user.pro) return false;
    if (user.proUntil && Date.now() > user.proUntil) return false;
    return true;
  }

  function monthKey(d) {
    const x = d ? new Date(d) : new Date();
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
  }

  /* ---------- syncs you own vs syncs you joined ---------- */
  function ownedCount(user, syncs) {
    return (syncs || []).filter(s => s.ownerUid === user.uid).length;
  }
  function maxOwned(user) {
    return isPro(user) ? P.PRO_MAX_SYNCS_OWNED : P.FREE_MAX_SYNCS_OWNED;
  }
  /* creating is limited; joining never is */
  function canCreateSync(user, syncs) {
    return ownedCount(user, syncs) < maxOwned(user);
  }
  function canCreateGroup(user) {
    return isPro(user) || P.FREE_CAN_CREATE_GROUP;
  }

  /* ---------- nudges ----------
     The first nudge on a given task each day is always free.
     Only re-nudging the same task burns your daily allowance. */
  function nudgeAllowance(user) {
    return isPro(user) ? P.PRO_NUDGES_SENT_PER_DAY : P.FREE_NUDGES_SENT_PER_DAY;
  }
  function chargeableToday(nudges, uid, today) {
    const mine = (nudges || []).filter(n => n.from === uid && n.date === today);
    const seen = new Set();
    let charged = 0;
    mine.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).forEach(n => {
      if (P.FIRST_NUDGE_PER_TASK_FREE && !seen.has(n.taskId)) { seen.add(n.taskId); return; }
      charged++;
    });
    return charged;
  }
  /* would this specific nudge cost anything? */
  function nudgeCheck(user, nudges, uid, today, taskId) {
    const alreadyOnTask = (nudges || []).some(n => n.from === uid && n.date === today && n.taskId === taskId);
    const free = P.FIRST_NUDGE_PER_TASK_FREE && !alreadyOnTask;
    if (free) return { ok: true, free: true, left: null };
    const used = chargeableToday(nudges, uid, today);
    const cap = nudgeAllowance(user);
    return { ok: used < cap, free: false, left: Math.max(0, cap - used - 1), used, cap };
  }

  /* ---------- streak repair ---------- */
  function repairsAllowed(user) {
    return isPro(user) ? P.PRO_STREAK_REPAIRS_PER_MONTH : P.FREE_STREAK_REPAIRS_PER_MONTH;
  }
  function repairsUsed(user) {
    return ((user && user.streakRepairs) || {})[monthKey()] || 0;
  }
  function canRepair(user) {
    return repairsUsed(user) < repairsAllowed(user);
  }

  return {
    isPro, monthKey, ownedCount, maxOwned, canCreateSync, canCreateGroup,
    nudgeAllowance, chargeableToday, nudgeCheck,
    repairsAllowed, repairsUsed, canRepair
  };
})();

/* ============================================================
   PAYWALL
   ============================================================ */
const TS_PRO_FEATURES = [
  ["👥", "Group Syncs", "Start syncs with your whole crew, not just one person."],
  ["♾️", "Unlimited syncs", "Free tops out at 2 you create. Joining is always unlimited."],
  ["🛟", "Streak repair", "One save a month when life happens. Keep the run alive."],
  ["🎨", "Sync themes", "Pick the colours for a whole sync - everyone in it sees them."],
  ["🧹", "Chore rotation", "Auto-rotating chores for group syncs, posted to chat."],
  ["📸", "Weekly recap", "A shareable card of your week: streaks, wins, funniest stat."],
  ["🔔", "More nudges", CONFIG.PLAN.PRO_NUDGES_SENT_PER_DAY + " a day instead of " + CONFIG.PLAN.FREE_NUDGES_SENT_PER_DAY + "."]
];

window.tsPaywall = (reason, highlight) => {
  document.querySelectorAll(".paywall-veil").forEach(x => x.remove());
  const price = CONFIG.PRICE.SYMBOL + CONFIG.PRICE.MONTHLY.toFixed(2);
  const veil = document.createElement("div");
  veil.className = "modal-veil paywall-veil";
  veil.innerHTML =
    '<div class="modal paywall">' +
      '<div class="paywall-head">' +
        '<span class="pro-badge">TooSynced Pro</span>' +
        '<h2>' + tsEsc(reason || "Unlock the good stuff") + "</h2>" +
        '<p>' + price + '<span>/month</span></p>' +
      "</div>" +
      '<div class="modal-body paywall-body">' +
        TS_PRO_FEATURES.map(([ic, t, d]) =>
          '<div class="pro-row' + (highlight === t ? " on" : "") + '">' +
            '<span class="ic">' + ic + "</span>" +
            "<div><b>" + t + "</b><span>" + d + "</span></div>" +
          "</div>").join("") +
      "</div>" +
      '<div class="modal-foot" style="flex-direction:column;align-items:stretch;gap:10px;">' +
        '<button class="btn btn--primary btn--block" id="pw-go">Get Pro - ' + price + "/mo</button>" +
        '<button class="btn btn--ghost btn--block" id="pw-close">Not right now</button>' +
      "</div>" +
    "</div>";
  document.body.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add("open"));

  const close = () => { veil.classList.remove("open"); setTimeout(() => veil.remove(), 220); };
  veil.querySelector("#pw-close").addEventListener("click", close);
  veil.addEventListener("click", (e) => { if (e.target === veil) close(); });
  veil.querySelector("#pw-go").addEventListener("click", async () => {
    close();
    tsCheckout();
  });
};

/* Billing isn't wired yet. This is the one honest place that says so,
   and lets you switch Pro on locally to build and test against it. */
window.tsCheckout = () => {
  document.querySelectorAll(".paywall-veil").forEach(x => x.remove());
  const veil = document.createElement("div");
  veil.className = "modal-veil paywall-veil";
  veil.innerHTML =
    '<div class="modal" style="max-width:440px;">' +
      '<div class="modal-head"><div class="t"><b>Checkout isn\'t live yet</b>' +
        '<span>Payments get wired up with the app-store release.</span></div></div>' +
      '<div class="modal-body" style="gap:14px;">' +
        '<p style="font-size:15px;line-height:1.55;color:var(--muted);">' +
          "Nothing will be charged. When TooSynced ships to the App Store and Play Store, " +
          "this button becomes a real subscription (" + CONFIG.PRICE.SYMBOL + CONFIG.PRICE.MONTHLY.toFixed(2) +
          "/month). Until then you can switch Pro on to try everything." +
        "</p>" +
        '<button class="btn btn--primary btn--block" id="pw-dev">Turn on Pro for testing</button>' +
        '<button class="btn btn--ghost btn--block" id="pw-back">Close</button>' +
      "</div>" +
    "</div>";
  document.body.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add("open"));
  const close = () => { veil.classList.remove("open"); setTimeout(() => veil.remove(), 220); };
  veil.querySelector("#pw-back").addEventListener("click", close);
  veil.addEventListener("click", (e) => { if (e.target === veil) close(); });
  veil.querySelector("#pw-dev").addEventListener("click", async () => {
    await Store.updateProfile({ pro: true, proSince: Date.now(), proUntil: null });
    close();
    tsToast("Pro is on - enjoy 💜");
    setTimeout(() => location.reload(), 700);
  });
};

/* ============================================================
   SYNC THEMES - set by a Pro member, seen by everyone in the sync
   ============================================================ */
const TS_THEMES = {
  lavender: { name: "Lavender", primary: "#7C3AED", deep: "#4C1D95", lav: "#C9B4FA",
              chipBg: "#F6F2FF", chipBorder: "#E4D9FB", bg: "#FBFAFF", bgAlt: "#F4F1FA",
              border: "#EDE7F8", border2: "#E7E0F5", swatch: "#7C3AED" },
  midnight: { name: "Midnight", primary: "#5B6CF9", deep: "#28307A", lav: "#AFB8FB",
              chipBg: "#EEF0FF", chipBorder: "#DADFFE", bg: "#FAFBFF", bgAlt: "#F1F3FD",
              border: "#E6E9FB", border2: "#DFE3F8", swatch: "#5B6CF9" },
  sunset:   { name: "Sunset", primary: "#E0553C", deep: "#8C2F1F", lav: "#F7B7A5",
              chipBg: "#FFF1ED", chipBorder: "#FBDCD2", bg: "#FFFBFA", bgAlt: "#FCF2EF",
              border: "#F8E6E0", border2: "#F5DED7", swatch: "#E0553C" },
  forest:   { name: "Forest", primary: "#1F8A5B", deep: "#0F4D33", lav: "#9BDCBE",
              chipBg: "#EDFAF3", chipBorder: "#D3F0E1", bg: "#FAFEFB", bgAlt: "#F0F8F3",
              border: "#E0F2E8", border2: "#D6EDE0", swatch: "#1F8A5B" },
  cocoa:    { name: "Cocoa", primary: "#8A5A2B", deep: "#4E3116", lav: "#DFC1A0",
              chipBg: "#FBF4EC", chipBorder: "#EFDFCB", bg: "#FFFCF9", bgAlt: "#F8F1E9",
              border: "#F0E5D8", border2: "#EADCCB", swatch: "#8A5A2B" },
  rose:     { name: "Rose", primary: "#C2377A", deep: "#7A1B4A", lav: "#F2AECD",
              chipBg: "#FEF0F6", chipBorder: "#FAD9E7", bg: "#FFFAFC", bgAlt: "#FBF0F5",
              border: "#F8E2EC", border2: "#F5D9E6", swatch: "#C2377A" }
};

window.tsApplyTheme = (key) => {
  const t = TS_THEMES[key] || TS_THEMES.lavender;
  const r = document.documentElement.style;
  r.setProperty("--primary", t.primary);
  r.setProperty("--deep", t.deep);
  r.setProperty("--lav", t.lav);
  r.setProperty("--chip-bg", t.chipBg);
  r.setProperty("--chip-border", t.chipBorder);
  r.setProperty("--bg", t.bg);
  r.setProperty("--bg-alt", t.bgAlt);
  r.setProperty("--border", t.border);
  r.setProperty("--border2", t.border2);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", t.bg);
  try { localStorage.setItem("ts_theme", key); } catch (e) {}
};

/* paint the last known theme immediately so pages don't flash */
(function () {
  try {
    const k = localStorage.getItem("ts_theme");
    if (k && TS_THEMES[k]) tsApplyTheme(k);
  } catch (e) {}
})();
