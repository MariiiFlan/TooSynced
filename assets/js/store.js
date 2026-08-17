/* ============================================================
   TooSynced — data layer
   One API, two backends:
     - DemoStore     : localStorage, zero setup, instant testing
     - FirebaseStore : real auth + Firestore realtime sync
   Which one runs is decided by CONFIG.DEMO_MODE (config.js).
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

/* ============================================================
   DEMO STORE
   ============================================================ */
const DemoStore = (() => {
  const KEY = "toosynced_demo_v1";
  let listeners = { tasks: [], completions: [], nudges: [], pair: [] };

  function blank() {
    return {
      user: null, // {uid,name}
      pair: null, // {id, inviteCode, members:[{uid,name}], joined:bool}
      tasks: {},        // id -> task
      completions: {},  // `${taskId}_${date}` -> {taskId,date,uid,doneAt}
      nudges: [],       // {id,from,to,taskId,date,createdAt,seen}
      nudgeCount: {}    // date -> count sent by me
    };
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || blank(); }
    catch { return blank(); }
  }
  function save(db) { localStorage.setItem(KEY, JSON.stringify(db)); }
  function emit(kind) {
    const db = load();
    if (kind === "tasks" || kind === "all") listeners.tasks.forEach(cb => cb(Object.values(db.tasks)));
    if (kind === "completions" || kind === "all") listeners.completions.forEach(cb => cb(Object.values(db.completions)));
    if (kind === "nudges" || kind === "all") listeners.nudges.forEach(cb => cb(db.nudges));
    if (kind === "pair" || kind === "all") listeners.pair.forEach(cb => cb(db.pair));
  }

  function seedPartnerTasks(db, partnerUid) {
    const seeds = [
      { name: "Yoga", icon: "🧘", time: "07:15", repeat: { type: "daily", days: [] } },
      { name: "Journal + coffee", icon: "☕", time: "08:00", repeat: { type: "daily", days: [] } },
      { name: "Study block", icon: "📚", time: "11:00", repeat: { type: "weekdays", days: [] } },
      { name: "Guitar practice", icon: "🎸", time: "20:30", repeat: { type: "custom", days: [1, 3, 5] } }
    ];
    seeds.forEach(s => {
      const id = "pt_" + Math.random().toString(36).slice(2, 9);
      db.tasks[id] = {
        id, owner: partnerUid, name: s.name, icon: s.icon, time: s.time,
        date: tsToday(), repeat: s.repeat, note: "", allowNudge: true, createdAt: Date.now()
      };
    });
    // partner already did the morning ones today
    const done = Object.values(db.tasks).filter(t => t.owner === partnerUid && t.time < "10:00");
    done.forEach(t => {
      const k = t.id + "_" + tsToday();
      db.completions[k] = { taskId: t.id, date: tsToday(), uid: partnerUid, doneAt: Date.now() };
    });
  }

  return {
    mode: "demo",
    async init() {},
    onAuth(cb) { const db = load(); setTimeout(() => cb(db.user), 0); },

    async signUpEmail(name) {
      const db = load();
      db.user = { uid: "me", name: name || "You" };
      save(db); return db.user;
    },
    async signInEmail() {
      const db = load();
      if (!db.user) db.user = { uid: "me", name: "You" };
      save(db); return db.user;
    },
    async signInGoogle() { return this.signInEmail(); },
    async signOut() { const db = load(); db.user = null; save(db); },
    async resetDemo() { localStorage.removeItem(KEY); },

    async getProfile() { const db = load(); return db.user; },
    async setName(name) {
      const db = load(); if (db.user) db.user.name = name;
      if (db.pair) { const m = db.pair.members.find(m => m.uid === "me"); if (m) m.name = name; }
      save(db); emit("pair");
    },

    async getPair() { return load().pair; },
    async createPair() {
      const db = load();
      if (!db.pair) {
        db.pair = { id: "demo-pair", inviteCode: tsCode(), members: [{ uid: "me", name: db.user.name }], joined: false };
        save(db);
      }
      emit("pair");
      return db.pair;
    },
    async joinPair() { return this.demoPartnerJoin(); },
    /* demo-only: simulate the partner accepting the invite */
    async demoPartnerJoin() {
      const db = load();
      if (!db.pair) return null;
      if (!db.pair.joined) {
        db.pair.members.push({ uid: "them", name: CONFIG.DEMO_PARTNER_NAME });
        db.pair.joined = true;
        seedPartnerTasks(db, "them");
        save(db);
      }
      emit("all");
      return db.pair;
    },
    watchPair(cb) { listeners.pair.push(cb); cb(load().pair); },

    watchTasks(cb) { listeners.tasks.push(cb); cb(Object.values(load().tasks)); },
    async addTask(t) {
      const db = load();
      const id = "t_" + Math.random().toString(36).slice(2, 9);
      db.tasks[id] = { ...t, id, owner: "me", createdAt: Date.now() };
      save(db); emit("tasks"); return id;
    },
    async updateTask(id, patch) {
      const db = load();
      if (db.tasks[id]) db.tasks[id] = { ...db.tasks[id], ...patch };
      save(db); emit("tasks");
    },
    async deleteTask(id) {
      const db = load(); delete db.tasks[id];
      Object.keys(db.completions).forEach(k => { if (k.startsWith(id + "_")) delete db.completions[k]; });
      save(db); emit("all");
    },

    watchCompletions(cb) { listeners.completions.push(cb); cb(Object.values(load().completions)); },
    async setDone(taskId, dateStr, done, uid) {
      const db = load();
      const k = taskId + "_" + dateStr;
      if (done) db.completions[k] = { taskId, date: dateStr, uid: uid || "me", doneAt: Date.now() };
      else delete db.completions[k];
      save(db); emit("completions");
    },

    watchNudges(cb) { listeners.nudges.push(cb); cb(load().nudges); },
    async sendNudge(toUid, taskId, dateStr) {
      const db = load();
      const today = tsToday();
      db.nudgeCount[today] = (db.nudgeCount[today] || 0) + 1;
      db.nudges.push({
        id: "n_" + Math.random().toString(36).slice(2, 9),
        from: "me", to: toUid, taskId, date: dateStr, createdAt: Date.now(), seen: false
      });
      save(db); emit("nudges");
      /* demo magic: partner "responds" — they check the task off a few seconds later */
      setTimeout(() => {
        const db2 = load();
        const k = taskId + "_" + dateStr;
        if (!db2.completions[k]) {
          db2.completions[k] = { taskId, date: dateStr, uid: toUid, doneAt: Date.now() };
          save(db2); emit("completions");
          if (window.tsToast) window.tsToast(CONFIG.DEMO_PARTNER_NAME + " checked it off 💜");
        }
      }, 6000);
      return db.nudgeCount[today];
    },
    async nudgesSentToday() { const db = load(); return db.nudgeCount[tsToday()] || 0; },
    async markNudgeSeen(id) {
      const db = load();
      const n = db.nudges.find(n => n.id === id);
      if (n) n.seen = true;
      save(db); emit("nudges");
    }
  };
})();

/* ============================================================
   FIREBASE STORE (compat SDK, loaded via script tags in HTML)
   Data model:
     users/{uid}            {name, pairId}
     pairs/{pairId}         {inviteCode, memberUids:[..], members:{uid:{name}}}
     pairs/{p}/tasks/{id}   {owner,name,icon,time,date,repeat,note,allowNudge,createdAt}
     pairs/{p}/completions/{taskId_date} {taskId,date,uid,doneAt}
     pairs/{p}/nudges/{id}  {from,to,taskId,date,createdAt,seen}
   ============================================================ */
const FirebaseStore = (() => {
  let app, auth, db, uid = null, pairId = null;
  let unsubs = [];

  async function profileRef() { return db.collection("users").doc(uid); }
  async function loadPairId() {
    const snap = await db.collection("users").doc(uid).get();
    pairId = snap.exists ? (snap.data().pairId || null) : null;
    return pairId;
  }

  return {
    mode: "firebase",
    async init() {
      app = firebase.initializeApp(CONFIG.FIREBASE);
      auth = firebase.auth();
      db = firebase.firestore();
    },
    onAuth(cb) {
      auth.onAuthStateChanged(async (u) => {
        uid = u ? u.uid : null;
        if (u) {
          const snap = await db.collection("users").doc(uid).get();
          const name = snap.exists ? snap.data().name : (u.displayName || "You");
          if (!snap.exists) await db.collection("users").doc(uid).set({ name, pairId: null });
          pairId = snap.exists ? snap.data().pairId : null;
          cb({ uid, name });
        } else cb(null);
      });
    },
    async signUpEmail(name, email, pass) {
      const cred = await auth.createUserWithEmailAndPassword(email, pass);
      await db.collection("users").doc(cred.user.uid).set({ name: name || "You", pairId: null });
      return { uid: cred.user.uid, name };
    },
    async signInEmail(email, pass) {
      const cred = await auth.signInWithEmailAndPassword(email, pass);
      return { uid: cred.user.uid };
    },
    async signInGoogle() {
      const provider = new firebase.auth.GoogleAuthProvider();
      const cred = await auth.signInWithPopup(provider);
      return { uid: cred.user.uid };
    },
    async signOut() { unsubs.forEach(u => u()); unsubs = []; await auth.signOut(); },
    async resetDemo() {},

    async getProfile() {
      const snap = await db.collection("users").doc(uid).get();
      return snap.exists ? { uid, ...snap.data() } : null;
    },
    async setName(name) {
      await db.collection("users").doc(uid).update({ name });
      if (pairId) await db.collection("pairs").doc(pairId).update({ ["members." + uid + ".name"]: name });
    },

    async getPair() {
      if (!pairId) await loadPairId();
      if (!pairId) return null;
      const snap = await db.collection("pairs").doc(pairId).get();
      if (!snap.exists) return null;
      const d = snap.data();
      return {
        id: pairId, inviteCode: d.inviteCode,
        members: d.memberUids.map(u => ({ uid: u, name: (d.members[u] || {}).name || "Partner" })),
        joined: d.memberUids.length >= 2
      };
    },
    async createPair() {
      const me = await this.getProfile();
      const code = tsCode();
      const ref = await db.collection("pairs").add({
        inviteCode: code, memberUids: [uid],
        members: { [uid]: { name: me.name } }, createdAt: Date.now()
      });
      pairId = ref.id;
      await db.collection("users").doc(uid).update({ pairId });
      return this.getPair();
    },
    async joinPair(code) {
      const q = await db.collection("pairs").where("inviteCode", "==", code.toLowerCase().trim()).limit(1).get();
      if (q.empty) throw new Error("That invite code doesn't match anything. Double-check it?");
      const doc = q.docs[0];
      const d = doc.data();
      if (d.memberUids.includes(uid)) { pairId = doc.id; }
      else if (d.memberUids.length >= 2) throw new Error("That pair is already full — TooSynced is two people only.");
      else {
        const me = await this.getProfile();
        await doc.ref.update({
          memberUids: firebase.firestore.FieldValue.arrayUnion(uid),
          ["members." + uid]: { name: me.name }
        });
        pairId = doc.id;
      }
      await db.collection("users").doc(uid).update({ pairId });
      return this.getPair();
    },
    async demoPartnerJoin() { return this.getPair(); },
    watchPair(cb) {
      const attach = () => {
        if (!pairId) { cb(null); return; }
        const un = db.collection("pairs").doc(pairId).onSnapshot(snap => {
          if (!snap.exists) { cb(null); return; }
          const d = snap.data();
          cb({
            id: pairId, inviteCode: d.inviteCode,
            members: d.memberUids.map(u => ({ uid: u, name: (d.members[u] || {}).name || "Partner" })),
            joined: d.memberUids.length >= 2
          });
        });
        unsubs.push(un);
      };
      if (pairId) attach(); else loadPairId().then(attach);
    },

    watchTasks(cb) {
      if (!pairId) { cb([]); return; }
      const un = db.collection("pairs").doc(pairId).collection("tasks")
        .onSnapshot(s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      unsubs.push(un);
    },
    async addTask(t) {
      const ref = await db.collection("pairs").doc(pairId).collection("tasks")
        .add({ ...t, owner: uid, createdAt: Date.now() });
      return ref.id;
    },
    async updateTask(id, patch) {
      await db.collection("pairs").doc(pairId).collection("tasks").doc(id).update(patch);
    },
    async deleteTask(id) {
      await db.collection("pairs").doc(pairId).collection("tasks").doc(id).delete();
    },

    watchCompletions(cb) {
      if (!pairId) { cb([]); return; }
      const un = db.collection("pairs").doc(pairId).collection("completions")
        .onSnapshot(s => cb(s.docs.map(d => d.data())));
      unsubs.push(un);
    },
    async setDone(taskId, dateStr, done) {
      const ref = db.collection("pairs").doc(pairId).collection("completions").doc(taskId + "_" + dateStr);
      if (done) await ref.set({ taskId, date: dateStr, uid, doneAt: Date.now() });
      else await ref.delete();
    },

    watchNudges(cb) {
      if (!pairId) { cb([]); return; }
      const un = db.collection("pairs").doc(pairId).collection("nudges")
        .onSnapshot(s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      unsubs.push(un);
    },
    async sendNudge(toUid, taskId, dateStr) {
      await db.collection("pairs").doc(pairId).collection("nudges").add({
        from: uid, to: toUid, taskId, date: dateStr, createdAt: Date.now(), seen: false
      });
      const today = tsToday();
      const q = await db.collection("pairs").doc(pairId).collection("nudges")
        .where("from", "==", uid).where("date", "==", today).get();
      return q.size;
    },
    async nudgesSentToday() {
      if (!pairId) return 0;
      const q = await db.collection("pairs").doc(pairId).collection("nudges")
        .where("from", "==", uid).where("date", "==", tsToday()).get();
      return q.size;
    },
    async markNudgeSeen(id) {
      await db.collection("pairs").doc(pairId).collection("nudges").doc(id).update({ seen: true });
    }
  };
})();

const Store = CONFIG.DEMO_MODE ? DemoStore : FirebaseStore;
