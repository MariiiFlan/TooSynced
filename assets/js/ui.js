/* ============================================================
   TooSynced — shared UI helpers
   ============================================================ */

/* ---------- dates ---------- */
const TS = {
  fmtDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },
  parseDate(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  },
  today() { return TS.fmtDate(new Date()); },
  addDays(s, n) { const d = TS.parseDate(s); d.setDate(d.getDate() + n); return TS.fmtDate(d); },
  weekday(s) { return TS.parseDate(s).getDay(); }, // 0=Sun
  prettyDay(s) {
    const d = TS.parseDate(s);
    return d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" });
  },
  prettyShort(s) {
    const d = TS.parseDate(s);
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  },
  prettyTime(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ":" + String(m).padStart(2, "0") + " " + ampm;
  },

  /* does a task occur on a given date? */
  occursOn(task, dateStr) {
    const start = task.date || TS.today();
    if (dateStr < start && task.repeat.type !== "none") return false;
    const wd = TS.weekday(dateStr);
    switch (task.repeat.type) {
      case "none":     return task.date === dateStr;
      case "daily":    return true;
      case "weekdays": return wd >= 1 && wd <= 5;
      case "weekly":   return wd === TS.weekday(start);
      case "custom":   return (task.repeat.days || []).includes(wd);
      default:         return task.date === dateStr;
    }
  },
  repeatLabel(task) {
    const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    switch (task.repeat.type) {
      case "daily":    return "daily";
      case "weekdays": return "weekdays";
      case "weekly":   return "weekly";
      case "custom":   return (task.repeat.days || []).map(d => names[d]).join("/") || "custom";
      default:         return "";
    }
  },
  isMissed(task, dateStr, completions) {
    if (completions.has(task.id + "_" + dateStr)) return false;
    const now = new Date();
    const todayStr = TS.today();
    if (dateStr > todayStr) return false;
    if (dateStr < todayStr) return true;
    const [h, m] = task.time.split(":").map(Number);
    return (now.getHours() * 60 + now.getMinutes()) > (h * 60 + m);
  },
  overdueLabel(task) {
    const [h, m] = task.time.split(":").map(Number);
    const now = new Date();
    const diff = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + m);
    if (diff <= 0) return "missed";
    const hrs = Math.floor(diff / 60);
    return hrs >= 1 ? hrs + "h overdue" : diff + "m overdue";
  }
};

/* ---------- toast ---------- */
window.tsToast = (msg) => {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 2600);
};

/* ---------- chime (WebAudio, no asset needed) ---------- */
window.tsChime = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [659.25, 830.61, 987.77]; // E5, G#5, B5 — a warm little arpeggio
    notes.forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = f;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      o.start(t); o.stop(t + 0.55);
    });
  } catch (e) { /* audio not available */ }
};

/* ---------- system notification (when app is open) ---------- */
window.tsNotify = async (title, body) => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") await Notification.requestPermission();
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "icons/icon-192.png" });
  }
};

/* ---------- auth guard for app pages ---------- */
function tsRequireAuth(cb) {
  Store.init().then(() => {
    Store.onAuth(async (user) => {
      if (!user) { window.location.href = "index.html"; return; }
      const pair = await Store.getPair();
      cb(user, pair);
    });
  });
}

/* ---------- PWA service worker ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

/* ============================================================
   Motion helpers
   ============================================================ */
window.tsReducedMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* aurora background (05) — call once per page */
window.tsAurora = () => {
  if (document.querySelector(".aurora")) return;
  const a = document.createElement("div");
  a.className = "aurora";
  a.innerHTML = '<span class="a"></span><span class="b"></span><span class="c"></span>';
  document.body.prepend(a);
};

/* launch splash (04) — once per session, app shell pages */
window.tsSplash = () => {
  if (tsReducedMotion()) return;
  try { if (sessionStorage.getItem("ts_splash")) return; sessionStorage.setItem("ts_splash", "1"); }
  catch (e) { return; }
  const s = document.createElement("div");
  s.className = "splash";
  s.innerHTML =
    '<svg width="86" height="86" viewBox="0 0 100 100" fill="none">' +
      '<g class="frame"><rect x="12" y="18" width="76" height="68" rx="18" stroke="#B79AF7" stroke-width="9"/><path d="M12 36h76" stroke="#B79AF7" stroke-width="9"/></g>' +
      '<circle class="ring-l" cx="41" cy="61" r="15" stroke="#7C3AED" stroke-width="9" fill="none"/>' +
      '<circle class="ring-r" cx="59" cy="61" r="15" stroke="#4C1D95" stroke-width="9" fill="none"/>' +
    '</svg>' +
    '<div class="word"><span>T</span><svg width="25" height="17" viewBox="2 1 66 44" fill="none"><circle cx="24" cy="23" r="17.5" stroke="#7C3AED" stroke-width="9"/><circle cx="46" cy="23" r="17.5" stroke="#4C1D95" stroke-width="9"/></svg><span>Synced</span></div>';
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 2100);
};

/* nudge dot flight (03) — from a button to an avatar */
window.tsFlyDot = (fromEl, toEl) => {
  if (tsReducedMotion() || !fromEl || !toEl) return;
  const f = fromEl.getBoundingClientRect(), t = toEl.getBoundingClientRect();
  const dot = document.createElement("span");
  dot.className = "fly-dot";
  dot.style.left = (f.left + f.width / 2 - 7) + "px";
  dot.style.top = (f.top + f.height / 2 - 7) + "px";
  document.body.appendChild(dot);
  const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
  const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
  dot.animate([
    { transform: "translate(0,0) scale(.5)", opacity: 0 },
    { transform: "translate(0,0) scale(1)", opacity: 1, offset: .15 },
    { transform: `translate(${dx}px,${dy}px) scale(.7)`, opacity: .9 }
  ], { duration: 650, easing: "cubic-bezier(.4,0,.5,1)" }).onfinish = () => {
    dot.remove();
    toEl.classList.add("hit");
    setTimeout(() => toEl.classList.remove("hit"), 700);
  };
};

/* empty-state motes (15) */
window.tsEmptyState = (msg, sub) => {
  let motes = "";
  for (let i = 0; i < 10; i++) {
    const size = (3 + Math.random() * 5).toFixed(1);
    motes += `<span class="mote" style="width:${size}px;height:${size}px;left:${(Math.random()*94).toFixed(1)}%;top:${(55+Math.random()*45).toFixed(1)}%;--dx:${(Math.random()*40-20).toFixed(0)}px;--dy:${(-80-Math.random()*70).toFixed(0)}px;--dur:${(7+Math.random()*6).toFixed(1)}s;--delay:${(Math.random()*6).toFixed(1)}s"></span>`;
  }
  return '<div class="empty-day">' + motes +
    '<svg class="logo-mark" width="44" height="44" viewBox="0 0 100 100" fill="none">' +
      '<rect x="12" y="18" width="76" height="68" rx="18" stroke="#D8C9F6" stroke-width="9"/><path d="M12 36h76" stroke="#D8C9F6" stroke-width="9"/>' +
      '<circle cx="41" cy="61" r="14" stroke="#B79AF7" stroke-width="9"/><circle cx="59" cy="61" r="14" stroke="#9A6DF2" stroke-width="9"/>' +
    '</svg>' +
    '<span style="position:relative;">' + msg + '</span>' +
    (sub ? '<span style="position:relative;font-size:13px;color:var(--faint);">' + sub + '</span>' : '') +
    '</div>';
};
