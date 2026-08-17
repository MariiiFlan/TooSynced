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
