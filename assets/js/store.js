/* ============================================================
   TooSynced - data layer
   One API, two backends (DemoStore / FirebaseStore), chosen by
   CONFIG.DEMO_MODE.

   MODEL
     users/{uid}          {name, birthday, photo, phone, syncIds[], activeSyncId}
     syncs/{id}           {name, kind:'two'|'group', photo, inviteCode,
                           memberUids[], members{uid:{name,photo}}, ownerUid}
     syncs/{id}/tasks/{taskId}         {owner,name,icon,time|null,date,repeat,
                                        note,allowNudge,createdAt}
     syncs/{id}/completions/{tid_date} {taskId,date,uid,doneAt}
     syncs/{id}/nudges/{id}            {from,to,taskId,date,createdAt,seen}
     syncs/{id}/praises/{id}           {from,to,taskId,date,emoji,createdAt,seen}
     syncs/{id}/messages/{id}          {from,text,at}
     syncs/{id}/presence/{uid}         {at}
   ============================================================ */

/* ---------- shared helpers ---------- */
function tsCode(len = 6) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out.slice(0, 3) + "-" + out.slice(3);
}
function tsToday() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function tsE164(raw) {
  const s = (raw || "").trim();
  if (!s) return null;
  if (s.startsWith("+")) return "+" + s.slice(1).replace(/\D/g, "");
  const digits = s.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.startsWith("1")) return "+" + digits;
  return null;
}
function tsRid(p) { return (p || "id") + "_" + Math.random().toString(36).slice(2, 10); }

/* ============================================================
   DEMO STORE - localStorage, no setup
   ============================================================ */
const DemoStore = (() => {
  const KEY = "toosynced_demo_v2";
  const L = { tasks: [], completions: [], nudges: [], praises: [], sync: [], syncs: [], messages: [], rsvps: [], locations: [], repairs: [], shames: [] };

  function blank() {
    return { user: null, syncs: {}, tasks: {}, completions: {}, nudges: [], praises: [], shames: [], messages: {}, rsvps: {}, locations: {}, repairs: {}, nudgeCount: {} };
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { return blank(); }
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }
  function active(db) { return db.user && db.user.activeSyncId ? db.syncs[db.user.activeSyncId] : null; }

  function emit(kind) {
    const db = load();
    const s = active(db);
    const sid = s ? s.id : null;
    const inSync = (o) => o.syncId === sid;
    if (kind === "tasks" || kind === "all") L.tasks.forEach(cb => cb(Object.values(db.tasks).filter(inSync)));
    if (kind === "completions" || kind === "all") L.completions.forEach(cb => cb(Object.values(db.completions).filter(inSync)));
    if (kind === "nudges" || kind === "all") L.nudges.forEach(cb => cb(db.nudges.filter(inSync)));
    if (kind === "praises" || kind === "all") L.praises.forEach(cb => cb(db.praises.filter(inSync)));
    if (kind === "messages" || kind === "all") L.messages.forEach(cb => cb(((db.messages || {})[sid] || []).slice().sort((a, b) => a.at - b.at)));
    if (kind === "rsvps" || kind === "all") L.rsvps.forEach(cb => cb(Object.values(db.rsvps || {}).filter(inSync)));
    if (kind === "locations" || kind === "all") L.locations.forEach(cb => cb(db.locations || {}));
    if (kind === "repairs" || kind === "all") L.repairs.forEach(cb => cb(Object.values(db.repairs || {}).filter(inSync)));
    if (kind === "shames" || kind === "all") L.shames.forEach(cb => cb((db.shames || []).filter(inSync)));
    if (kind === "sync" || kind === "all") L.sync.forEach(cb => cb(s));
    if (kind === "syncs" || kind === "all") L.syncs.forEach(cb => cb(Object.values(db.syncs)));
  }

  function seedMember(db, syncId, uid, name, photo, seeds) {
    const s = db.syncs[syncId];
    if (!s.memberUids.includes(uid)) {
      s.memberUids.push(uid);
      s.members[uid] = { name, photo: photo || null };
    }
    (seeds || []).forEach(sd => {
      const id = tsRid("t");
      db.tasks[id] = {
        id, syncId, owner: uid, name: sd.n, icon: sd.i, time: sd.t || null,
        date: tsToday(), repeat: { type: sd.r || "daily", days: sd.d || [] },
        note: "", allowNudge: true, createdAt: Date.now()
      };
    });
    Object.values(db.tasks)
      .filter(t => t.syncId === syncId && t.owner === uid && t.time && t.time < "10:00")
      .forEach(t => {
        db.completions[t.id + "_" + tsToday()] =
          { syncId, taskId: t.id, date: tsToday(), uid, doneAt: Date.now() };
      });
  }

  return {
    mode: "demo",
    async init() {},
    onAuth(cb) { const db = load(); setTimeout(() => cb(db.user), 0); },

    async signUpEmail(name, email, pass, phone) {
      const db = load();
      db.user = { uid: "me", name: name || "You", phone: tsE164(phone) || null, birthday: null, photo: null, activeSyncId: null };
      save(db); return db.user;
    },
    async signInEmail() {
      const db = load();
      if (!db.user) db.user = { uid: "me", name: "You", activeSyncId: null };
      save(db); return db.user;
    },
    async signInGoogle() { return this.signInEmail(); },
    async startPhoneSignIn(phone) {
      if (!tsE164(phone)) throw new Error("That doesn't look like a phone number.");
      if (window.tsToast) tsToast("Demo: your code is 123456");
      return true;
    },
    async confirmPhoneCode(code, name) {
      if (code !== "123456") throw new Error("Wrong code - in demo mode it's 123456.");
      const db = load();
      if (!db.user) db.user = { uid: "me", name: name || "You", activeSyncId: null };
      save(db); return db.user;
    },
    async signOut() { const db = load(); db.user = null; save(db); },
    async resetDemo() { localStorage.removeItem(KEY); },
    async deleteAccount() { localStorage.removeItem(KEY); },

    /* ---------- profile ---------- */
    async getProfile() { return load().user; },
    async updateProfile(patch) {
      const db = load();
      if (!db.user) return;
      Object.assign(db.user, patch);
      if (patch.phone !== undefined) db.user.phone = tsE164(patch.phone) || null;
      Object.values(db.syncs).forEach(s => {
        if (s.members[db.user.uid]) {
          if (patch.name) s.members[db.user.uid].name = patch.name;
          if (patch.photo !== undefined) s.members[db.user.uid].photo = patch.photo;
        }
      });
      save(db); emit("all");
    },

    /* ---------- syncs ---------- */
    async listSyncs() { return Object.values(load().syncs); },
    watchSyncs(cb) { L.syncs.push(cb); cb(Object.values(load().syncs)); },
    async getSync() { return active(load()); },
    watchSync(cb) { L.sync.push(cb); cb(active(load())); },
    async setActiveSync(id) {
      const db = load();
      db.user.activeSyncId = id;
      save(db); emit("all");
    },
    async createSync(name, kind, photo) {
      const db = load();
      const id = tsRid("sync");
      db.syncs[id] = {
        id, name: name || (kind === "group" ? "New group sync" : "New sync"),
        kind: kind || "two", photo: photo || null, inviteCode: tsCode(),
        theme: "lavender", chores: null,
        ownerUid: db.user.uid, memberUids: [db.user.uid],
        members: { [db.user.uid]: { name: db.user.name, photo: db.user.photo || null } },
        createdAt: Date.now()
      };
      db.user.activeSyncId = id;
      save(db); emit("all");
      return db.syncs[id];
    },
    async updateSync(id, patch) {
      const db = load();
      if (db.syncs[id]) Object.assign(db.syncs[id], patch);
      save(db); emit("all");
    },
    async leaveSync(id) {
      const db = load();
      delete db.syncs[id];
      Object.keys(db.tasks).forEach(k => { if (db.tasks[k].syncId === id) delete db.tasks[k]; });
      const rest = Object.keys(db.syncs);
      db.user.activeSyncId = rest.length ? rest[0] : null;
      save(db); emit("all");
    },
    async joinSync() { return this.demoPartnerJoin(); },
    /* demo: fill the active sync with believable people */
    async demoPartnerJoin() {
      const db = load();
      const s = active(db);
      if (!s) return null;
      if (s.kind === "two") {
        if (s.memberUids.length < 2) {
          seedMember(db, s.id, "them", CONFIG.DEMO_PARTNER_NAME, null, [
            { n: "Yoga", i: "🧘", t: "07:15" },
            { n: "Journal + coffee", i: "☕", t: "08:00" },
            { n: "Study block", i: "📚", t: "11:00", r: "weekdays" },
            { n: "Read a chapter", i: "📖", t: null }
          ]);
        }
      } else {
        const crew = [
          ["them", "Jordan", [{ n: "Gym", i: "🏋️", t: "06:30" }, { n: "Meal prep", i: "🍝", t: null }]],
          ["them2", "Tasha", [{ n: "Run 3 miles", i: "🏃", t: "07:00" }, { n: "Study", i: "📚", t: "19:00" }]],
          ["them3", "Marcus", [{ n: "Water 1 gal", i: "💧", t: null }, { n: "Sleep by 11", i: "🛏️", t: "23:00" }]]
        ];
        crew.forEach(([uid, name, seeds]) => {
          if (!s.memberUids.includes(uid)) seedMember(db, s.id, uid, name, null, seeds);
        });
        if (!(db.messages[s.id] || []).length) {
          db.messages[s.id] = [
            { id: tsRid("m"), syncId: s.id, from: "them", text: "gym at 6:30, who's coming", at: Date.now() - 5400000 },
            { id: tsRid("m"), syncId: s.id, from: "them2", text: "I'm in 💪", at: Date.now() - 5000000 }
          ];
        }
      }
      save(db); emit("all");
      return active(load());
    },

    /* ---------- tasks ---------- */
    watchTasks(cb) { L.tasks.push(cb); emit("tasks"); },
    /* targetSyncIds: which syncs this task should appear in (defaults to the active one) */
    async addTask(t, targetSyncIds) {
      const db = load(); const s = active(db);
      const targets = (targetSyncIds && targetSyncIds.length) ? targetSyncIds : [s.id];
      const originId = tsRid("o");
      let firstId = null, added = 0;
      targets.forEach(sid => {
        if (!db.syncs[sid]) return;
        const id = tsRid("t");
        if (!firstId) firstId = id;
        db.tasks[id] = { ...t, id, originId, syncId: sid, owner: db.user.uid, createdAt: Date.now() };
        added++;
      });
      save(db); emit("tasks");
      return { id: firstId, originId, added, failed: targets.length - added, failures: [] };
    },
    async updateTask(id, patch, everywhere) {
      const db = load();
      const t = db.tasks[id];
      if (!t) return;
      const ids = everywhere && t.originId
        ? Object.keys(db.tasks).filter(k => db.tasks[k].originId === t.originId)
        : [id];
      ids.forEach(k => { db.tasks[k] = { ...db.tasks[k], ...patch }; });
      save(db); emit("tasks");
    },
    async deleteTask(id, everywhere) {
      const db = load();
      const t = db.tasks[id];
      if (!t) return;
      const ids = everywhere && t.originId
        ? Object.keys(db.tasks).filter(k => db.tasks[k].originId === t.originId)
        : [id];
      ids.forEach(k => {
        delete db.tasks[k];
        Object.keys(db.completions).forEach(c => { if (c.startsWith(k + "_")) delete db.completions[c]; });
      });
      save(db); emit("all");
    },

    /* ---------- streak repair ---------- */
    watchRepairs(cb) { L.repairs.push(cb); emit("repairs"); },
    async repairStreak(dateStr) {
      const db = load(); const s = active(db);
      if (!db.repairs) db.repairs = {};
      db.repairs[s.id + "_" + dateStr] = { syncId: s.id, date: dateStr, by: db.user.uid, at: Date.now() };
      const mk = TSPlan.monthKey();
      db.user.streakRepairs = db.user.streakRepairs || {};
      db.user.streakRepairs[mk] = (db.user.streakRepairs[mk] || 0) + 1;
      save(db); emit("all");
    },

    /* ---------- chore rotation ---------- */
    async setChores(chores) {
      const db = load(); const s = active(db);
      db.syncs[s.id].chores = chores;
      save(db); emit("sync");
    },

    /* add copies of an existing task into any syncs missing it */
    async fanOutTask(originId, data, targetSyncIds) {
      const db = load();
      const have = new Set(Object.values(db.tasks).filter(t => t.originId === originId).map(t => t.syncId));
      (targetSyncIds || []).forEach(sid => {
        if (have.has(sid) || !db.syncs[sid]) return;
        const id = tsRid("t");
        db.tasks[id] = { ...data, id, originId, syncId: sid, owner: db.user.uid, createdAt: Date.now() };
      });
      save(db); emit("tasks");
    },

    /* ---------- RSVP (open-invite tasks) ---------- */
    watchRsvps(cb) { L.rsvps.push(cb); emit("rsvps"); },
    async setRsvp(taskId, dateStr, status) {
      const db = load(); const s = active(db);
      if (!db.rsvps) db.rsvps = {};
      const k = taskId + "_" + dateStr + "_" + db.user.uid;
      if (status) db.rsvps[k] = { syncId: s.id, taskId, date: dateStr, uid: db.user.uid, status, at: Date.now() };
      else delete db.rsvps[k];
      save(db); emit("rsvps");
      /* demo: the others answer too */
      const others = s.memberUids.filter(u => u !== db.user.uid);
      if (status && others.length) setTimeout(() => {
        const d2 = load();
        if (!d2.rsvps) d2.rsvps = {};
        const picks = ["in", "in", "maybe", "out"];
        others.forEach((u, i) => {
          const kk = taskId + "_" + dateStr + "_" + u;
          if (!d2.rsvps[kk]) d2.rsvps[kk] = {
            syncId: s.id, taskId, date: dateStr, uid: u,
            status: picks[(i + 1) % picks.length], at: Date.now()
          };
        });
        save(d2); emit("rsvps");
      }, 2200);
    },

    /* ---------- location check-in ---------- */
    async shareLocation(coords) {
      const db = load();
      if (!db.locations) db.locations = {};
      db.locations[db.user.uid] = { ...coords, at: Date.now() };
      save(db); emit("locations");
    },
    async clearLocation() {
      const db = load();
      if (db.locations) delete db.locations[db.user.uid];
      save(db); emit("locations");
    },
    watchLocations(cb) {
      L.locations.push(cb);
      const db = load(); const s = active(db);
      cb(db.locations || {});
      /* demo: everyone else checks in near you a moment later */
      if (s) setTimeout(() => {
        const d2 = load();
        if (!d2.locations) d2.locations = {};
        const base = d2.locations[d2.user.uid] || { lat: 34.1483, lng: -118.1445 };
        s.memberUids.filter(u => u !== d2.user.uid).forEach((u, i) => {
          if (!d2.locations[u]) d2.locations[u] = {
            lat: base.lat + (i + 1) * 0.012, lng: base.lng - (i + 1) * 0.009,
            label: ["Gold's Gym", "Home", "Campus library"][i % 3], at: Date.now() - (i + 1) * 300000
          };
        });
        save(d2); emit("locations");
      }, 3000);
    },

    /* ---------- completions ---------- */
    watchCompletions(cb) { L.completions.push(cb); emit("completions"); },
    async setDone(taskId, dateStr, done, uid) {
      const db = load(); const s = active(db);
      const k = taskId + "_" + dateStr;
      if (done) db.completions[k] = { syncId: s.id, taskId, date: dateStr, uid: uid || db.user.uid, doneAt: Date.now() };
      else delete db.completions[k];
      save(db); emit("completions");
    },

    /* ---------- nudges ---------- */
    watchNudges(cb) { L.nudges.push(cb); emit("nudges"); },
    async sendNudge(toUid, taskId, dateStr) {
      const db = load(); const s = active(db);
      const today = tsToday();
      db.nudgeCount[today] = (db.nudgeCount[today] || 0) + 1;
      db.nudges.push({ id: tsRid("n"), syncId: s.id, from: db.user.uid, to: toUid, taskId, date: dateStr, createdAt: Date.now(), seen: false });
      save(db); emit("nudges");
      /* demo: they respond by checking it off */
      setTimeout(() => {
        const d2 = load(); const k = taskId + "_" + dateStr;
        if (!d2.completions[k]) {
          d2.completions[k] = { syncId: s.id, taskId, date: dateStr, uid: toUid, doneAt: Date.now() };
          save(d2); emit("completions");
          const nm = (s.members[toUid] || {}).name || "They";
          if (window.tsToast) window.tsToast(nm + " checked it off 💜");
        }
      }, 6000);
      return db.nudgeCount[today];
    },
    async nudgesSentToday() { return load().nudgeCount[tsToday()] || 0; },
    async markNudgeSeen(id) {
      const db = load(); const n = db.nudges.find(x => x.id === id);
      if (n) n.seen = true; save(db); emit("nudges");
    },

    /* ---------- shame (Pro) ---------- */
    watchShames(cb) { L.shames.push(cb); emit("shames"); },
    async sendShame(toUid, taskId, dateStr, text) {
      const db = load(); const s = active(db);
      if (!db.shames) db.shames = [];
      db.shames.push({
        id: tsRid("s"), syncId: s.id, from: db.user.uid, to: toUid,
        taskId, date: dateStr, text: text || "", createdAt: Date.now(), seen: false
      });
      save(db); emit("shames");
    },
    async markShameSeen(id) {
      const db = load(); const x = (db.shames || []).find(y => y.id === id);
      if (x) x.seen = true; save(db); emit("shames");
    },

    /* ---------- praise ---------- */
    watchPraises(cb) { L.praises.push(cb); emit("praises"); },
    async sendPraise(toUid, taskId, dateStr, emoji) {
      const db = load(); const s = active(db);
      db.praises.push({ id: tsRid("p"), syncId: s.id, from: db.user.uid, to: toUid, taskId, date: dateStr, emoji: emoji || "👏", createdAt: Date.now(), seen: false });
      save(db); emit("praises");
    },
    async markPraiseSeen(id) {
      const db = load(); const p = db.praises.find(x => x.id === id);
      if (p) p.seen = true; save(db); emit("praises");
    },

    /* ---------- messages ---------- */
    watchMessages(cb) { L.messages.push(cb); emit("messages"); },
    async sendMessage(text) {
      const db = load(); const s = active(db);
      if (!db.messages[s.id]) db.messages[s.id] = [];
      db.messages[s.id].push({ id: tsRid("m"), syncId: s.id, from: db.user.uid, text, at: Date.now() });
      save(db); emit("messages");
      /* demo: someone answers */
      const others = s.memberUids.filter(u => u !== db.user.uid);
      if (others.length) setTimeout(() => {
        const d2 = load();
        if (!d2.messages[s.id]) d2.messages[s.id] = [];
        const replies = ["bet 💪", "on it", "say less", "we got this 🔥", "👏👏"];
        d2.messages[s.id].push({
          id: tsRid("m"), syncId: s.id, from: others[Math.floor(Math.random() * others.length)],
          text: replies[Math.floor(Math.random() * replies.length)], at: Date.now()
        });
        save(d2); emit("messages");
      }, 2500);
    },

    /* ---------- presence ---------- */
    startPresence() {},
    watchPresence(cb) {
      const db = load(); const s = active(db);
      if (s && s.memberUids.length > 1) setTimeout(() => cb(s.memberUids.filter(u => u !== db.user.uid).slice(0, 1)), 4000);
      else cb([]);
    }
  };
})();

/* ============================================================
   FIREBASE STORE
   ============================================================ */
const FirebaseStore = (() => {
  let auth, db, uid = null, syncId = null;
  let unsubs = [];
  function dropWatchers() { unsubs.forEach(u => { try { u(); } catch (e) {} }); unsubs = []; }
  function syncRef() { return db.collection("syncs").doc(syncId); }

  return {
    mode: "firebase",
    async init() {
      firebase.initializeApp(CONFIG.FIREBASE);
      auth = firebase.auth();
      db = firebase.firestore();
    },
    onAuth(cb) {
      auth.onAuthStateChanged(async (u) => {
        uid = u ? u.uid : null;
        if (!u) { cb(null); return; }
        const ref = db.collection("users").doc(uid);
        let snap = await ref.get();
        if (!snap.exists) {
          const fallback = u.displayName
            || (u.email ? u.email.split("@")[0] : null)
            || (u.phoneNumber ? "Me " + u.phoneNumber.slice(-4) : "Me");
          await ref.set({
            name: fallback, birthday: null, photo: null,
            phone: u.phoneNumber || null, syncIds: [], activeSyncId: null
          });
          snap = await ref.get();
        }
        const d = snap.data();
        syncId = d.activeSyncId || null;
        /* email comes from the auth record, not the profile doc */
        cb({ uid, email: u.email || d.email || null, ...d });
      });
    },
    async signUpEmail(name, email, pass, phone) {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      await db.collection("users").doc(cred.user.uid).set({
        name: name || "You", birthday: null, photo: null,
        phone: tsE164(phone) || null, syncIds: [], activeSyncId: null
      });
      return { uid: cred.user.uid, name };
    },
    async signInEmail(email, pass) {
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      return { uid: cred.user.uid };
    },
    async signInGoogle() {
      /* Native: a popup can't talk back to a Capacitor WebView (you get a
         white screen), so let the native Google sheet run and exchange the
         token for a Firebase credential. */
      const FA = window.Capacitor && window.Capacitor.Plugins
        && window.Capacitor.Plugins.FirebaseAuthentication;
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && FA) {
        try {
          const res = await FA.signInWithGoogle();
          const idToken = res && res.credential && res.credential.idToken;
          const accessToken = res && res.credential && res.credential.accessToken;
          if (!idToken && !accessToken) throw new Error("Google sign-in was cancelled.");
          const credential = firebase.auth.GoogleAuthProvider.credential(idToken || null, accessToken || null);
          const out = await auth.signInWithCredential(credential);
          return { uid: out.user.uid };
        } catch (e) {
          const m = (e && e.message) || "";
          /* a signing-fingerprint mismatch shows up as "no credentials".
             The web popup uses a different client and often still works. */
          if (/no credentials|DEVELOPER_ERROR|ApiException: 10/i.test(m)) {
            console.warn("[TooSynced] native Google sign-in unavailable, trying web flow", e);
            const cred = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
            return { uid: cred.user.uid };
          }
          throw e;
        }
      }
      const cred = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      return { uid: cred.user.uid };
    },
    _confirmation: null, _recaptcha: null,
    async startPhoneSignIn(phone, buttonId) {
      const e164 = tsE164(phone);
      if (!e164) throw new Error("Enter a phone number like (951) 555-0134 or +1 951 555 0134.");
      const FA = window.Capacitor && window.Capacitor.Plugins
        && window.Capacitor.Plugins.FirebaseAuthentication;
      if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && FA) {
        /* native handles its own verification - no reCAPTCHA iframe */
        this._native = true;
        this._verificationId = null;
        await FA.addListener("phoneCodeSent", (e) => { this._verificationId = e.verificationId; });
        await FA.signInWithPhoneNumber({ phoneNumber: e164 });
        return true;
      }
      this._native = false;
      if (!this._recaptcha) this._recaptcha = new firebase.auth.RecaptchaVerifier(buttonId, { size: "invisible" });
      this._confirmation = await auth.signInWithPhoneNumber(e164, this._recaptcha);
      return true;
    },
    async confirmPhoneCode(code, name) {
      if (this._native) {
        if (!this._verificationId) throw new Error("Still waiting on the text. Give it a second and try again.");
        const credential = firebase.auth.PhoneAuthProvider.credential(this._verificationId, code.trim());
        const out = await auth.signInWithCredential(credential);
        const ref2 = db.collection("users").doc(out.user.uid);
        if (!(await ref2.get()).exists) {
          await ref2.set({
            name: name || ("Me " + (out.user.phoneNumber || "").slice(-4)).trim(),
            birthday: null, photo: null,
            phone: out.user.phoneNumber || null, syncIds: [], activeSyncId: null
          });
        }
        return { uid: out.user.uid };
      }
      if (!this._confirmation) throw new Error("Ask for a code first.");
      const cred = await this._confirmation.confirm(code.trim());
      const ref = db.collection("users").doc(cred.user.uid);
      if (!(await ref.get()).exists) {
        await ref.set({
          name: name || ("Me " + (cred.user.phoneNumber || "").slice(-4)).trim(), birthday: null, photo: null,
          phone: cred.user.phoneNumber || null, syncIds: [], activeSyncId: null
        });
      }
      return { uid: cred.user.uid };
    },
    async signOut() { dropWatchers(); await auth.signOut(); },
    async resetDemo() {},

    /* Google Play requires an in-app way to delete an account.
       Removes everything this person owns, then the auth user itself. */
    async deleteAccount() {
      const me = await this.getProfile();
      const ids = (me && me.syncIds) || [];

      for (const sid of ids) {
        const ref = db.collection("syncs").doc(sid);
        const snap = await ref.get().catch(() => null);
        if (!snap || !snap.exists) continue;
        const d = snap.data();

        /* my tasks in this sync, and their completions */
        const tq = await ref.collection("tasks").where("owner", "==", uid).get().catch(() => null);
        if (tq) {
          for (const t of tq.docs) {
            const cq = await ref.collection("completions").where("taskId", "==", t.id).get().catch(() => null);
            if (cq) await Promise.all(cq.docs.map(c => c.ref.delete().catch(() => {})));
            await t.ref.delete().catch(() => {});
          }
        }
        /* praise, nudges and rsvps I sent or received */
        for (const col of ["praises", "nudges", "rsvps"]) {
          for (const field of ["from", "to", "uid"]) {
            const q = await ref.collection(col).where(field, "==", uid).get().catch(() => null);
            if (q) await Promise.all(q.docs.map(x => x.ref.delete().catch(() => {})));
          }
        }
        /* my location pin */
        await ref.collection("presence").doc(uid).delete().catch(() => {});

        /* last one out deletes the sync, otherwise just leave it */
        if ((d.memberUids || []).length <= 1) {
          await ref.delete().catch(() => {});
        } else {
          await ref.update({
            memberUids: firebase.firestore.FieldValue.arrayRemove(uid),
            ["members." + uid]: firebase.firestore.FieldValue.delete()
          }).catch(() => {});
        }
      }

      await db.collection("users").doc(uid).delete().catch(() => {});
      dropWatchers();
      const u = auth.currentUser;
      if (u) await u.delete();   // throws requires-recent-login if the session is old
    },

    /* ---------- profile ---------- */
    async getProfile() {
      const snap = await db.collection("users").doc(uid).get();
      return snap.exists ? { uid, ...snap.data() } : null;
    },
    async updateProfile(patch) {
      const clean = { ...patch };
      if (clean.phone !== undefined) clean.phone = tsE164(clean.phone) || null;
      await db.collection("users").doc(uid).update(clean);
      /* mirror name/photo into every sync this person belongs to */
      const me = await this.getProfile();
      const ids = (me && me.syncIds) || [];
      await Promise.all(ids.map(id => {
        const up = {};
        if (clean.name) up["members." + uid + ".name"] = clean.name;
        if (clean.photo !== undefined) up["members." + uid + ".photo"] = clean.photo;
        return Object.keys(up).length ? db.collection("syncs").doc(id).update(up).catch(() => {}) : null;
      }));
    },

    /* ---------- syncs ---------- */
    _shape(id, d) {
      return {
        id, name: d.name, kind: d.kind || "two", photo: d.photo || null,
        inviteCode: d.inviteCode, ownerUid: d.ownerUid,
        theme: d.theme || "lavender", chores: d.chores || null,
        memberUids: d.memberUids || [],
        members: d.members || {},
        joined: (d.memberUids || []).length >= 2
      };
    },
    async listSyncs() {
      const me = await this.getProfile();
      const ids = (me && me.syncIds) || [];
      const docs = await Promise.all(ids.map(id => db.collection("syncs").doc(id).get()));
      return docs.filter(s => s.exists).map(s => this._shape(s.id, s.data()));
    },
    watchSyncs(cb) {
      const self = this;
      const un = db.collection("syncs").where("memberUids", "array-contains", uid)
        .onSnapshot(s => cb(s.docs.map(d => self._shape(d.id, d.data()))));
      unsubs.push(un);
    },
    async getSync() {
      if (!syncId) return null;
      const snap = await syncRef().get();
      return snap.exists ? this._shape(snap.id, snap.data()) : null;
    },
    watchSync(cb) {
      if (!syncId) { cb(null); return; }
      const self = this;
      const un = syncRef().onSnapshot(s => cb(s.exists ? self._shape(s.id, s.data()) : null));
      unsubs.push(un);
    },
    async setActiveSync(id) {
      syncId = id;
      await db.collection("users").doc(uid).update({ activeSyncId: id });
    },
    async createSync(name, kind, photo) {
      const me = await this.getProfile();
      const ref = await db.collection("syncs").add({
        name: name || (kind === "group" ? "New group sync" : "New sync"),
        kind: kind || "two", photo: photo || null, inviteCode: tsCode(),
        theme: "lavender", chores: null,
        ownerUid: uid, memberUids: [uid],
        members: { [uid]: { name: me.name, photo: me.photo || null } },
        createdAt: Date.now()
      });
      syncId = ref.id;
      await db.collection("users").doc(uid).update({
        syncIds: firebase.firestore.FieldValue.arrayUnion(ref.id),
        activeSyncId: ref.id
      });
      return this.getSync();
    },
    async updateSync(id, patch) { await db.collection("syncs").doc(id).update(patch); },
    async leaveSync(id) {
      const me = await this.getProfile();
      await db.collection("syncs").doc(id).update({
        memberUids: firebase.firestore.FieldValue.arrayRemove(uid),
        ["members." + uid]: firebase.firestore.FieldValue.delete()
      }).catch(() => {});
      const rest = ((me && me.syncIds) || []).filter(x => x !== id);
      await db.collection("users").doc(uid).update({ syncIds: rest, activeSyncId: rest[0] || null });
      syncId = rest[0] || null;
    },
    async joinSync(code) {
      const q = await db.collection("syncs").where("inviteCode", "==", code.toLowerCase().trim()).limit(1).get();
      if (q.empty) throw new Error("That invite code doesn't match anything. Double-check it?");
      const doc = q.docs[0], d = doc.data();
      if (!d.memberUids.includes(uid)) {
        if ((d.kind || "two") === "two" && d.memberUids.length >= 2)
          throw new Error("That sync is full - a Two Sync is just two people. Ask them to start a Group Sync.");
        const me = await this.getProfile();
        await doc.ref.update({
          memberUids: firebase.firestore.FieldValue.arrayUnion(uid),
          ["members." + uid]: { name: me.name, photo: me.photo || null }
        });
      }
      syncId = doc.id;
      await db.collection("users").doc(uid).update({
        syncIds: firebase.firestore.FieldValue.arrayUnion(doc.id),
        activeSyncId: doc.id
      });
      return this.getSync();
    },
    async demoPartnerJoin() { return this.getSync(); },

    /* ---------- tasks / completions ---------- */
    watchTasks(cb) {
      if (!syncId) { cb([]); return; }
      const un = syncRef().collection("tasks")
        .onSnapshot(s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      unsubs.push(un);
    },
    async addTask(t, targetSyncIds) {
      const targets = (targetSyncIds && targetSyncIds.length) ? targetSyncIds : [syncId];
      const originId = tsRid("o");
      const payload = { ...t, originId, owner: uid, createdAt: Date.now() };
      const results = await Promise.all(targets.map(async sid => {
        try {
          const ref = await db.collection("syncs").doc(sid).collection("tasks").add(payload);
          return { sid, ok: true, id: ref.id };
        } catch (e) {
          console.error("[TooSynced] could not add task to sync", sid, e);
          return { sid, ok: false, error: e && (e.code || e.message) };
        }
      }));
      const good = results.filter(r => r.ok);
      const bad = results.filter(r => !r.ok);
      /* the sync you're looking at has to work - anything else is a partial */
      if (!good.length) throw new Error((bad[0] && bad[0].error) || "Couldn't save that task.");
      return { id: good[0].id, originId, added: good.length, failed: bad.length, failures: bad };
    },
    async updateTask(id, patch, everywhere) {
      await syncRef().collection("tasks").doc(id).update(patch);
      if (!everywhere) return;
      const snap = await syncRef().collection("tasks").doc(id).get();
      const originId = (snap.data() || {}).originId;
      if (!originId) return;
      const me = await this.getProfile();
      await Promise.all(((me && me.syncIds) || []).filter(sid => sid !== syncId).map(async sid => {
        const q = await db.collection("syncs").doc(sid).collection("tasks")
          .where("originId", "==", originId).get().catch(() => null);
        if (!q) return;
        return Promise.all(q.docs.map(d => d.ref.update(patch).catch(() => {})));
      }));
    },
    async deleteTask(id, everywhere) {
      const snap = await syncRef().collection("tasks").doc(id).get();
      const originId = (snap.data() || {}).originId;
      await syncRef().collection("tasks").doc(id).delete();
      if (!everywhere || !originId) return;
      const me = await this.getProfile();
      await Promise.all(((me && me.syncIds) || []).filter(sid => sid !== syncId).map(async sid => {
        const q = await db.collection("syncs").doc(sid).collection("tasks")
          .where("originId", "==", originId).get().catch(() => null);
        if (!q) return;
        return Promise.all(q.docs.map(d => d.ref.delete().catch(() => {})));
      }));
    },

    /* ---------- streak repair ---------- */
    watchRepairs(cb) {
      if (!syncId) { cb([]); return; }
      const un = syncRef().collection("repairs").onSnapshot(s => cb(s.docs.map(d => d.data())));
      unsubs.push(un);
    },
    async repairStreak(dateStr) {
      await syncRef().collection("repairs").doc(dateStr)
        .set({ date: dateStr, by: uid, at: Date.now() });
      const me = await this.getProfile();
      const mk = TSPlan.monthKey();
      const cur = (me && me.streakRepairs) || {};
      cur[mk] = (cur[mk] || 0) + 1;
      await db.collection("users").doc(uid).update({ streakRepairs: cur });
    },

    /* ---------- chore rotation ---------- */
    async setChores(chores) { await syncRef().update({ chores }); },

    async fanOutTask(originId, data, targetSyncIds) {
      await Promise.all((targetSyncIds || []).map(async sid => {
        const col = db.collection("syncs").doc(sid).collection("tasks");
        const q = await col.where("originId", "==", originId).limit(1).get().catch(() => null);
        if (q && !q.empty) return;
        return col.add({ ...data, originId, owner: uid, createdAt: Date.now() }).catch(() => {});
      }));
    },

    /* ---------- RSVP ---------- */
    watchRsvps(cb) {
      if (!syncId) { cb([]); return; }
      const un = syncRef().collection("rsvps").onSnapshot(s => cb(s.docs.map(d => d.data())));
      unsubs.push(un);
    },
    async setRsvp(taskId, dateStr, status) {
      const ref = syncRef().collection("rsvps").doc(taskId + "_" + dateStr + "_" + uid);
      if (status) await ref.set({ taskId, date: dateStr, uid, status, at: Date.now() });
      else await ref.delete();
    },

    /* ---------- location check-in ---------- */
    async shareLocation(coords) {
      await syncRef().collection("presence").doc(uid)
        .set({ at: Date.now(), loc: { ...coords, at: Date.now() } }, { merge: true });
    },
    async clearLocation() {
      await syncRef().collection("presence").doc(uid)
        .set({ loc: firebase.firestore.FieldValue.delete() }, { merge: true }).catch(() => {});
    },
    watchLocations(cb) {
      if (!syncId) { cb({}); return; }
      const un = syncRef().collection("presence").onSnapshot(s => {
        const out = {};
        s.docs.forEach(d => { const v = d.data() || {}; if (v.loc) out[d.id] = v.loc; });
        cb(out);
      });
      unsubs.push(un);
    },

    watchCompletions(cb) {
      if (!syncId) { cb([]); return; }
      const un = syncRef().collection("completions").onSnapshot(s => cb(s.docs.map(d => d.data())));
      unsubs.push(un);
    },
    async setDone(taskId, dateStr, done) {
      const ref = syncRef().collection("completions").doc(taskId + "_" + dateStr);
      if (done) await ref.set({ taskId, date: dateStr, uid, doneAt: Date.now() });
      else await ref.delete();
    },

    /* ---------- nudges / praise / messages ---------- */
    watchNudges(cb) {
      if (!syncId) { cb([]); return; }
      const un = syncRef().collection("nudges").onSnapshot(s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      unsubs.push(un);
    },
    async sendNudge(toUid, taskId, dateStr) {
      await syncRef().collection("nudges").add({ from: uid, to: toUid, taskId, date: dateStr, createdAt: Date.now(), seen: false });
      const q = await syncRef().collection("nudges").where("from", "==", uid).where("date", "==", tsToday()).get();
      return q.size;
    },
    async nudgesSentToday() {
      if (!syncId) return 0;
      const q = await syncRef().collection("nudges").where("from", "==", uid).where("date", "==", tsToday()).get();
      return q.size;
    },
    async markNudgeSeen(id) { await syncRef().collection("nudges").doc(id).update({ seen: true }); },

    /* ---------- shame (Pro) ---------- */
    watchShames(cb) {
      if (!syncId) { cb([]); return; }
      const un = syncRef().collection("shames").onSnapshot(s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      unsubs.push(un);
    },
    async sendShame(toUid, taskId, dateStr, text) {
      await syncRef().collection("shames").add({
        from: uid, to: toUid, taskId, date: dateStr,
        text: text || "", createdAt: Date.now(), seen: false
      });
    },
    async markShameSeen(id) { await syncRef().collection("shames").doc(id).update({ seen: true }); },

    watchPraises(cb) {
      if (!syncId) { cb([]); return; }
      const un = syncRef().collection("praises").onSnapshot(s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      unsubs.push(un);
    },
    async sendPraise(toUid, taskId, dateStr, emoji) {
      await syncRef().collection("praises").add({ from: uid, to: toUid, taskId, date: dateStr, emoji: emoji || "👏", createdAt: Date.now(), seen: false });
    },
    async markPraiseSeen(id) { await syncRef().collection("praises").doc(id).update({ seen: true }); },

    watchMessages(cb) {
      if (!syncId) { cb([]); return; }
      const un = syncRef().collection("messages").orderBy("at", "asc").limitToLast(200)
        .onSnapshot(s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      unsubs.push(un);
    },
    async sendMessage(text) { await syncRef().collection("messages").add({ from: uid, text, at: Date.now() }); },

    /* ---------- presence ---------- */
    startPresence() {
      if (!syncId || !uid) return;
      const beat = () => {
        if (document.visibilityState !== "hidden")
          syncRef().collection("presence").doc(uid).set({ at: Date.now() }).catch(() => {});
      };
      beat();
      const iv = setInterval(beat, 25000);
      unsubs.push(() => clearInterval(iv));
      document.addEventListener("visibilitychange", beat);
    },
    watchPresence(cb) {
      if (!syncId) { cb([]); return; }
      const seen = {};
      const fresh = () => cb(Object.keys(seen).filter(u => Date.now() - seen[u] < 70000));
      const un = syncRef().collection("presence").onSnapshot(s => {
        s.docs.forEach(d => { if (d.id !== uid) seen[d.id] = (d.data() || {}).at || 0; });
        fresh();
      });
      const iv = setInterval(fresh, 15000);
      unsubs.push(un, () => clearInterval(iv));
    }
  };
})();

const Store = CONFIG.DEMO_MODE ? DemoStore : FirebaseStore;
