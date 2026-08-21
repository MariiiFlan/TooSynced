/* ============================================================
   TooSynced - alerts
   One watcher that runs on every app page so notifications and
   the unread chat badge work no matter which screen you're on.

   Fires for things OTHER people do:
     - added a task
     - checked a task off
     - let a task go past its time
     - sent a message
   Never for your own actions.
   ============================================================ */

const TSAlerts = (() => {
  let me = null, sync = null, members = [];
  let tasks = [], completions = new Map(), messages = [];
  let ready = false;          // suppress the initial flood on load
  let seenTasks = new Set();
  let seenDone = new Set();
  let seenMissed = new Set();
  let missedTimer = null;

  /* ---------- what counts as already seen ---------- */
  function key(k) { return "ts_" + k + "_" + (sync ? sync.id : "none"); }
  function readMark(k, fallback) {
    try { return Number(localStorage.getItem(key(k))) || fallback; }
    catch (e) { return fallback; }
  }
  function writeMark(k, v) {
    try { localStorage.setItem(key(k), String(v)); } catch (e) {}
  }

  function person(uid) {
    return members.find(m => m.uid === uid) || { name: "Someone" };
  }
  function onChatPage() { return /chat\.html/.test(location.pathname); }

  /* ---------- unread chat ---------- */
  function unreadCount() {
    if (!messages.length || !me) return 0;
    const since = readMark("msgseen", 0);
    return messages.filter(m => m.from !== me.uid && (m.at || 0) > since).length;
  }

  function paintBadge() {
    const n = unreadCount();
    /* bottom tab bar */
    const tab = document.querySelector('.tabbar a[href="chat.html"]');
    if (tab) {
      let dot = tab.querySelector(".tab-badge");
      if (n > 0) {
        if (!dot) {
          dot = document.createElement("span");
          dot.className = "tab-badge";
          tab.appendChild(dot);
        }
        dot.textContent = n > 99 ? "99+" : n;
      } else if (dot) dot.remove();
    }
    /* top nav on wider screens */
    const link = document.querySelector('.topnav a[href="chat.html"]');
    if (link) {
      let b = link.querySelector(".nav-badge");
      if (n > 0) {
        if (!b) {
          b = document.createElement("span");
          b.className = "nav-badge";
          link.appendChild(b);
        }
        b.textContent = n > 99 ? "99+" : n;
      } else if (b) b.remove();
    }
    /* app icon badge on Android */
    if (window.TSNative && TSNative.isNative) {
      const B = TSNative.plugin("Badge");
      if (B) { n > 0 ? B.set({ count: n }).catch(() => {}) : B.clear().catch(() => {}); }
    }
  }

  window.tsMarkChatRead = () => {
    const latest = messages.reduce((a, m) => Math.max(a, m.at || 0), 0);
    writeMark("msgseen", Math.max(latest, Date.now()));
    paintBadge();
  };

  /* ---------- the watchers ---------- */
  function start(user, activeSync) {
    me = user; sync = activeSync;
    members = (sync.memberUids || []).map(u => ({ uid: u, ...(sync.members[u] || { name: "?" }) }));

    const taskMark = readMark("taskseen", Date.now());
    const doneMark = readMark("doneseen", Date.now());

    Store.watchTasks((list) => {
      tasks = list || [];
      tasks.forEach(t => {
        if (t.owner === me.uid) { seenTasks.add(t.id); return; }
        if (seenTasks.has(t.id)) return;
        seenTasks.add(t.id);
        /* only shout about tasks created after the last time we looked */
        if (!ready || (t.createdAt || 0) <= taskMark) return;
        const who = person(t.owner).name;
        tsChime();
        tsToast("📝 " + who + " added " + t.name);
        tsNotify(who + " added a task", t.name, "task-" + t.id);
      });
      writeMark("taskseen", Date.now());
      checkMissed();
    });

    Store.watchCompletions((list) => {
      const next = new Map((list || []).map(c => [c.taskId + "_" + c.date, c]));
      next.forEach((c, k) => {
        if (completions.has(k)) return;
        if (c.uid === me.uid) { seenDone.add(k); return; }
        if (seenDone.has(k)) return;
        seenDone.add(k);
        if (!ready || (c.doneAt || 0) <= doneMark) return;
        const t = tasks.find(x => x.id === c.taskId);
        const who = person(c.uid).name;
        tsChime();
        tsToast("✅ " + who + " finished " + (t ? t.name : "a task"));
        tsNotify(who + " checked something off", t ? t.name : "Nice work", "done-" + k);
      });
      completions = next;
      writeMark("doneseen", Date.now());
    });

    Store.watchMessages((list) => {
      const prev = messages.length;
      messages = list || [];
      if (ready && messages.length > prev) {
        const latest = messages[messages.length - 1];
        if (latest && latest.from !== me.uid) {
          if (onChatPage() && document.visibilityState === "visible") {
            tsMarkChatRead();
          } else {
            const who = person(latest.from).name;
            tsChime();
            tsNotify(who, latest.text, "msg-" + sync.id);
          }
        }
      }
      if (onChatPage() && document.visibilityState === "visible") tsMarkChatRead();
      paintBadge();
    });

    if (Store.watchShames) {
      const shameMark = readMark("shameseen", Date.now());
      const seenShame = new Set();
      Store.watchShames((list) => {
        (list || []).forEach(x => {
          if (x.to !== me.uid || seenShame.has(x.id)) return;
          seenShame.add(x.id);
          if (!ready || (x.createdAt || 0) <= shameMark) return;
          const t = tasks.find(y => y.id === x.taskId);
          const who = person(x.from).name;
          tsChime();
          tsToast("😈 " + who + " shamed you" + (t ? " for " + t.name : ""));
          tsNotify(who + " shamed you 😈",
                   (t ? t.name + " - " : "") + (x.text || "you missed it"), "shame-" + x.id);
        });
        writeMark("shameseen", Date.now());
      });
    }

    /* someone let a task slip past its time */
    checkMissed();
    if (!missedTimer) missedTimer = setInterval(checkMissed, 60000);

    /* let the first render settle before anything fires */
    setTimeout(() => { ready = true; }, 2500);
  }

  function checkMissed() {
    /* TS is declared with const in ui.js, so it is NOT on window.
       Checking window.TS silently disabled this whole function. */
    if (!me || typeof TS === "undefined") return;
    const today = TS.today();
    tasks.forEach(t => {
      if (t.owner === me.uid) return;
      if (t.private) return;
      if (!TS.occursOn(t, today)) return;
      if (!t.time) return;                       // "anytime" can't be late
      const k = t.id + "_" + today;
      if (completions.has(k)) return;
      if (seenMissed.has(k)) return;
      if (!TS.isMissed(t, today, completions)) return;
      seenMissed.add(k);
      if (!ready) return;
      const who = person(t.owner).name;
      tsToast("🔔 " + who + " hasn't done " + t.name + " yet");
      tsNotify(who + " is running late", t.name + " was due at " + TS.prettyTime(t.time), "late-" + k);
    });
  }

  return { start, paintBadge, unreadCount };
})();

/* every tab-bar page starts this once it knows who's signed in */
window.tsStartAlerts = (user, sync) => {
  if (!user || !sync) return;
  try { TSAlerts.start(user, sync); } catch (e) { console.warn("alerts", e); }
};
