/* ============================================================
   TooSynced - shared UI helpers
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
    if (!hhmm) return "anytime";
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
    /* no set time = "anytime today" - never overdue during the day */
    if (!task.time) return false;
    const [h, m] = task.time.split(":").map(Number);
    return (now.getHours() * 60 + now.getMinutes()) > (h * 60 + m);
  },
  overdueLabel(task) {
    if (!task.time) return "missed";
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
    const notes = [659.25, 830.61, 987.77]; // E5, G#5, B5 - a warm little arpeggio
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

/* ---------- system notification ----------
   Uses the service worker registration when there is one: that is the only
   path that works for an installed PWA on Android, and it keeps the icon and
   tap-to-open behaviour consistent. Falls back to a plain Notification. */
window.tsNotify = async (title, body, tag) => {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const opts = {
    body,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    tag: tag || "toosynced",
    renotify: true,
    data: { url: location.origin + location.pathname.replace(/[^/]*$/, "app.html") }
  };
  try {
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) { await reg.showNotification(title, opts); return; }
    }
  } catch (e) { /* fall through */ }
  try { new Notification(title, opts); } catch (e) {}
};

/* ask once, at a moment the person expects it */
window.tsAskNotify = async () => {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission !== "default") return Notification.permission;
  try { return await Notification.requestPermission(); } catch (e) { return "denied"; }
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

/* aurora background (05) - call once per page */
window.tsAurora = () => {
  if (document.querySelector(".aurora")) return;
  const a = document.createElement("div");
  a.className = "aurora";
  a.innerHTML = '<span class="a"></span><span class="b"></span><span class="c"></span>';
  document.body.prepend(a);
};

/* launch splash (04) - once per session, app shell pages */
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

/* nudge dot flight (03) - from a button to an avatar */
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

/* ============================================================
   Avatars, photos, sync helpers
   ============================================================ */

/* render a person's avatar: photo if they have one, else initial */
window.tsAvatar = (person, size, cls) => {
  const px = size || 36;
  const name = (person && person.name) || "?";
  const photo = person && person.photo;
  const extra = cls ? " " + cls : "";
  if (photo) {
    return '<span class="av av--photo' + extra + '" style="width:' + px + 'px;height:' + px + 'px;">' +
      '<img src="' + photo + '" alt="' + tsEsc(name) + '"></span>';
  }
  const hue = (person && person.color) || tsHue(name);
  return '<span class="av' + extra + '" style="width:' + px + 'px;height:' + px + 'px;font-size:' +
    Math.round(px * 0.4) + 'px;background:' + hue + ';">' + tsEsc(name.charAt(0).toUpperCase()) + '</span>';
};

/* palette: index 0 is always "you", the rest cycle so nobody collides */
const TS_HUES = ["#7C3AED", "#F0A050", "#22A06B", "#2F86C7", "#C2477C", "#E8912F", "#4C1D95", "#8A6420"];
window.tsHue = (name) => {
  let h = 0;
  for (let i = 0; i < (name || "?").length; i++) h = (h * 31 + name.charCodeAt(i)) % 9973;
  return TS_HUES[1 + (h % (TS_HUES.length - 1))];
};
/* give every member of a sync a distinct colour, "me" first and always purple */
window.tsColorMembers = (members, myUid) => {
  members.forEach((m, i) => { m.color = m.uid === myUid ? TS_HUES[0] : TS_HUES[1 + ((i - 1 + TS_HUES.length - 1) % (TS_HUES.length - 1))]; });
  return members;
};

window.tsEsc = (s) => { const d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; };

/* Compress a picked image to a small square dataURL.
   Tries createImageBitmap first - it decodes more formats than <img>,
   respects EXIF orientation, and doesn't need a data URL round-trip. */
window.tsReadPhoto = async (file, px) => {
  const size = px || 160;
  if (!file) throw new Error("No file picked.");
  if (file.size > 25 * 1024 * 1024) throw new Error("That image is huge - pick one under 25MB.");

  const name = (file.name || "").toLowerCase();
  const looksHeic = /\.(heic|heif)$/.test(name) || /heic|heif/.test(file.type || "");

  let src = null;

  /* 1. modern path: decode straight from the File */
  if (window.createImageBitmap) {
    try {
      src = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) { src = null; }
  }

  /* 2. fallback: object URL into an <img> */
  if (!src) {
    src = await new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    });
  }

  /* 3. last resort: data URL (some older mobile browsers only like this) */
  if (!src) {
    src = await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = r.result;
      };
      r.onerror = () => resolve(null);
      r.readAsDataURL(file);
    });
  }

  if (!src) {
    throw new Error(looksHeic
      ? "This browser can't open HEIC photos (iPhone's default). Screenshot it, or set Camera → Formats → Most Compatible, then try again."
      : "Couldn't open that image. Try a JPG or PNG.");
  }

  const w = src.width || src.naturalWidth;
  const h = src.height || src.naturalHeight;
  if (!w || !h) throw new Error("That image came through empty. Try another one.");

  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  const side = Math.min(w, h);
  ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  if (src.close) src.close();

  const out = c.toDataURL("image/jpeg", 0.82);
  if (!out || out.length < 100) throw new Error("Couldn't process that image. Try another one.");
  return out;
};

/* label for a sync in lists / switchers */
window.tsSyncLabel = (s) => {
  if (!s) return "";
  const n = (s.memberUids || []).length;
  return s.kind === "group" ? n + " people" : (n < 2 ? "waiting for 1 more" : "just you two");
};

/* guard for pages that work with or without a sync (settings, profile).
   Signed out -> sign in. Otherwise you always get in, sync or not. */
function tsRequireUser(cb) {
  Store.init().then(() => {
    Store.onAuth(async (user) => {
      if (!user) { location.href = "index.html"; return; }
      if (window.TSNative) TSNative.init(user);
      let sync = null;
      try { sync = await Store.getSync(); } catch (e) { sync = null; }
      cb(user, sync);
    });
  });
}

/* guard used by pages that genuinely need a sync (schedule, chat, streaks) */
function tsRequireSync(cb) {
  Store.init().then(() => {
    Store.onAuth(async (user) => {
      if (!user) { location.href = "index.html"; return; }
      if (window.TSNative) TSNative.init(user);
      const sync = await Store.getSync();
      if (!sync) { location.href = "syncs.html"; return; }
      cb(user, sync);
    });
  });
}

/* ============================================================
   Sync switcher - dropdown in the topbar of every app page
   ============================================================ */
window.tsSyncSwitcher = (mountSel, activeSync, onSwitch) => {
  const mount = document.querySelector(mountSel);
  if (!mount) return;
  const icon = (s) => s.photo ? '<img src="' + s.photo + '" alt="">' : (s.kind === "group" ? "👥" : "🫂");

  mount.innerHTML =
    '<button class="sync-btn" id="sync-btn">' +
      '<span class="sync-avatar" style="width:30px;height:30px;border-radius:10px;font-size:15px;">' + icon(activeSync) + '</span>' +
      '<span class="txt"><b>' + tsEsc(activeSync.name) + '</b><span>' + tsSyncLabel(activeSync) + '</span></span>' +
      '<span class="caret">▾</span>' +
    '</button>' +
    '<div class="sync-menu" id="sync-menu"></div>';

  const btn = mount.querySelector("#sync-btn");
  const menu = mount.querySelector("#sync-menu");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("open");
  });
  document.addEventListener("click", () => menu.classList.remove("open"));
  menu.addEventListener("click", (e) => e.stopPropagation());

  Store.watchSyncs((list) => {
    menu.innerHTML = "";
    (list || []).forEach(s => {
      const b = document.createElement("button");
      b.className = "item" + (s.id === activeSync.id ? " on" : "");
      b.innerHTML =
        '<span class="sync-avatar" style="width:32px;height:32px;border-radius:11px;font-size:16px;">' + icon(s) + '</span>' +
        '<span class="txt"><b>' + tsEsc(s.name) + '</b><span>' + tsSyncLabel(s) + '</span></span>' +
        (s.id === activeSync.id ? '<span style="color:var(--primary);font-weight:800;">✓</span>' : '');
      b.addEventListener("click", async () => {
        if (s.id === activeSync.id) { menu.classList.remove("open"); return; }
        await Store.setActiveSync(s.id);
        if (onSwitch) onSwitch(s); else location.reload();
      });
      menu.appendChild(b);
    });
    const sep = document.createElement("div");
    sep.className = "sep";
    menu.appendChild(sep);
    const add = document.createElement("a");
    add.className = "item new";
    add.href = "syncs.html";
    add.innerHTML = '<span class="sync-avatar" style="width:32px;height:32px;border-radius:11px;font-size:18px;">+</span><span>New or join a sync</span>';
    menu.appendChild(add);
    const inv = document.createElement("a");
    inv.className = "item new";
    inv.href = "invite.html";
    inv.innerHTML = '<span class="sync-avatar" style="width:32px;height:32px;border-radius:11px;font-size:15px;">🔗</span><span>Invite people to this sync</span>';
    menu.appendChild(inv);
  });
};
