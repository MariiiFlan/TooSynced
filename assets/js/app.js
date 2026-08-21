/* ============================================================
   TooSynced - schedule
   Works for a Two Sync (two columns) or a Group Sync (a column
   per person). Everything below is sync-aware.
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const ICONS = ["🏃","🏋️","🧘","🚶","💊","💧","📚","💻","☕","🍝","📖","🧹","🛏️","🎸","🛒","💜"];
  const PRAISE = ["👏", "🔥", "💜", "💪", "🙌"];
  /* keep these teasing, not cruel - it goes to someone you like */
  const SHAME_LINES = [
    "caught you slippin 👀",
    "the streak is watching 😭",
    "we don't claim this one 💀",
    "L + ratio + you skipped it 😈",
    "it's giving... not done 🙃",
    "bro really said maybe tomorrow 😮‍💨",
    "this is a public callout 📢",
    "the group has noticed 👁️"
  ];

  let me = null, sync = null, members = [];
  let tasks = [], completions = new Map(), nudges = [], praises = [];
  let seenNudges = new Set(), seenPraises = new Set();
  let currentDate = TS.today(), currentView = "day", mobileTab = null;
  let editingId = null, modalRepeat = "none", modalDays = new Set();
  let modalIcon = ICONS[0], modalAllowNudge = true, modalWhen = "anytime";
  let firstNudgeLoad = true, firstPraiseLoad = true;
  let rsvps = [], locations = {}, mySyncs = [], repairs = [], shames = [], synclings = [];
  let seenShames = new Set();
  let modalPlace = "", modalScope = "sync", modalPickIds = new Set(), modalRsvp = false;
  let detailTask = null;

  tsSplash();
  tsAurora();
  tsBottomNav("app.html");

  tsRequireSync((user, s) => {
    me = user; sync = s;
    applySync(s);
    tsSyncSwitcher("#sync-switch", s);

    Store.startPresence();
    Store.watchPresence(paintPresence);
    Store.watchSync((fresh) => { if (fresh) { sync = fresh; applySync(fresh); render(); } });
    Store.watchTasks((t) => { tasks = t; render(); });
    Store.watchCompletions((c) => {
      completions = new Map(c.map(x => [x.taskId + "_" + x.date, x]));
      render();
    });
    Store.watchNudges((n) => { nudges = n; handleNudges(); firstNudgeLoad = false; });
    Store.watchPraises((p) => { praises = p; handlePraises(); firstPraiseLoad = false; render(); });
    Store.watchRsvps((r) => { rsvps = r; render(); if (detailTask) paintDetail(detailTask); });
    Store.watchLocations((l) => { locations = l || {}; render(); });
    Store.watchSyncs((list) => { mySyncs = list || []; });
    if (Store.watchRepairs) Store.watchRepairs((r) => { repairs = r || []; render(); });
    if (Store.watchShames) Store.watchShames((x) => { shames = x || []; handleShames(); render(); });
    if (Store.watchSynclings) Store.watchSynclings((x) => { synclings = x || []; render(); });
  });

  function applySync(s) {
    if (window.tsApplyTheme) tsApplyTheme(s.theme || "lavender");
    const flame = document.querySelector(".streak-pill .flame");
    if (flame) flame.textContent = s.streakIcon || "🔥";
    members = (s.memberUids || []).map(u => ({ uid: u, ...(s.members[u] || { name: "?" }) }));
    /* me first, then everyone else */
    members.sort((a, b) => (a.uid === me.uid ? -1 : b.uid === me.uid ? 1 : 0));
    tsColorMembers(members, me.uid);
    if (!mobileTab || !members.find(m => m.uid === mobileTab)) mobileTab = me.uid;
    const others = members.filter(m => m.uid !== me.uid);
    $("#nudge-toggle-label").textContent = s.kind === "group"
      ? "Let the group nudge me about this"
      : (others[0] ? "Let " + others[0].name + " nudge me about this" : "Let people nudge me about this");
  }

  function person(uid) { return members.find(m => m.uid === uid) || { uid, name: "Someone" }; }
  function isDone(t, d) { return completions.has(t.id + "_" + d); }
  function tasksFor(uid, dateStr) {
    return tasks
      .filter(t => t.owner === uid && TS.occursOn(t, dateStr))
      .filter(t => !t.private || t.owner === me.uid)
      .sort((a, b) => {
        /* timed tasks in clock order first, "anytime" ones after */
        if (a.time && b.time) return a.time.localeCompare(b.time);
        if (a.time) return -1;
        if (b.time) return 1;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
  }
  function shamesFor(taskId, dateStr) {
    return shames.filter(s => s.taskId === taskId && s.date === dateStr);
  }
  function handleShames() {
    shames.filter(x => x.to === me.uid && !x.seen && !seenShames.has(x.id)).forEach(x => {
      seenShames.add(x.id);
      const t = tasks.find(y => y.id === x.taskId);
      const who = person(x.from).name;
      tsChime();
      tsToast("😈 " + who + " shamed you" + (t ? " for " + t.name : ""));
      tsNotify(who + " shamed you 😈", (t ? t.name + " - " : "") + (x.text || "you missed it"), "shame-" + x.id);
      Store.markShameSeen(x.id);
    });
  }

  function praisesFor(taskId, dateStr) {
    return praises.filter(p => p.taskId === taskId && p.date === dateStr);
  }
  function rsvpsFor(taskId, dateStr) {
    return rsvps.filter(r => r.taskId === taskId && r.date === dateStr);
  }
  function myRsvp(taskId, dateStr) {
    const r = rsvpsFor(taskId, dateStr).find(x => x.uid === me.uid);
    return r ? r.status : null;
  }
  /* one place that decides whether a nudge can go out */
  async function tryNudge(task, ownerName, btn) {
    const chk = TSPlan.nudgeCheck(me, nudges, me.uid, TS.today(), task.id);
    if (!chk.ok) {
      tsPaywall("You're out of nudges for today", "More nudges");
      return false;
    }
    await Store.sendNudge(task.owner, task.id, currentDate);
    tsChime();
    if (chk.free) tsToast("Nudge sent to " + ownerName);
    else tsToast("Nudge sent - " + chk.left + " left today");
    return true;
  }

  function mapUrl(place) {
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(place);
  }

  /* ---------- incoming nudges / praise ---------- */
  function handleNudges() {
    nudges.filter(n => n.to === me.uid && !n.seen && !seenNudges.has(n.id)).forEach(n => {
      seenNudges.add(n.id);
      if (!firstNudgeLoad) {
        const t = tasks.find(x => x.id === n.taskId);
        const who = person(n.from).name;
        tsChime();
        tsToast("🔔 " + who + " nudged you about " + (t ? t.name : "a task"));
        tsNotify("TooSynced", who + " nudged you: " + (t ? t.name : "a task"));
      }
      Store.markNudgeSeen(n.id);
    });
  }
  function handlePraises() {
    praises.filter(p => p.to === me.uid && !p.seen && !seenPraises.has(p.id)).forEach(p => {
      seenPraises.add(p.id);
      if (!firstPraiseLoad) {
        const t = tasks.find(x => x.id === p.taskId);
        const who = person(p.from).name;
        tsChime();
        tsToast(p.emoji + " " + who + " cheered you on for " + (t ? t.name : "that"));
        tsNotify("TooSynced", who + " praised you: " + (t ? t.name : "nice work"));
      }
      Store.markPraiseSeen(p.id);
    });
  }
  /* ---------- where people are (opt-in check-in) ---------- */
  function paintLocations() {
    members.forEach(m => {
      const col = document.querySelector('.person-col[data-uid="' + m.uid + '"]');
      if (!col) return;
      const old = col.querySelector(".loc-pin");
      if (old) old.remove();
      const loc = locations[m.uid];
      if (!loc) return;
      const a = document.createElement("a");
      a.className = "loc-pin";
      a.target = "_blank"; a.rel = "noopener";
      a.href = loc.lat != null
        ? "https://www.google.com/maps/search/?api=1&query=" + loc.lat + "," + loc.lng
        : mapUrl(loc.label || "");
      a.title = (loc.label || "Shared location") + " · " + timeAgo(loc.at);
      a.innerHTML = "📍 " + tsEsc(loc.label || "here") + '<span class="ago">' + timeAgo(loc.at) + "</span>";
      col.querySelector(".col-head .who .txt").appendChild(a);
    });
  }
  function timeAgo(ts) {
    const mins = Math.round((Date.now() - (ts || 0)) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const h = Math.round(mins / 60);
    return h < 24 ? h + "h ago" : Math.round(h / 24) + "d ago";
  }

  function paintPresence(hereUids) {
    members.forEach(m => {
      const el = document.querySelector('[data-presence="' + m.uid + '"]');
      if (el) el.classList.toggle("here", (hereUids || []).includes(m.uid));
    });
  }

  /* ---------- view switching ---------- */
  const ORDER = ["day", "week", "month"];
  $$(".viewseg button").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.view === currentView) return;
    const forward = ORDER.indexOf(b.dataset.view) > ORDER.indexOf(currentView);
    currentView = b.dataset.view;
    $$(".viewseg button").forEach(x => x.classList.toggle("on", x === b));
    render();
    const el = $("#view-" + currentView);
    el.style.setProperty("--in-x", forward ? "22px" : "-22px");
    el.classList.remove("view-in"); void el.offsetWidth; el.classList.add("view-in");
  }));
  $("#nav-prev").addEventListener("click", () => shift(-1));
  $("#nav-next").addEventListener("click", () => shift(1));
  $("#nav-today").addEventListener("click", () => { currentDate = TS.today(); render(); });
  function shift(dir) {
    if (currentView === "month") {
      const d = TS.parseDate(currentDate); d.setMonth(d.getMonth() + dir);
      currentDate = TS.fmtDate(d);
    } else currentDate = TS.addDays(currentDate, dir * (currentView === "week" ? 7 : 1));
    render();
  }

  /* ---------- render ---------- */
  /* ---------- synclings ---------- */
  function renderSynclings() {
    /* TSSync/TSSyncUI are declared with const, so they are NOT on window.
       Checking window.X silently disabled this whole function. */
    if (typeof TSSyncUI === "undefined" || typeof TSSync === "undefined" || !sync) return;
    const streak = sharedStreak();
    const today = TS.today();
    const mine = tasksFor(me.uid, today);
    const others = members.filter(m => m.uid !== me.uid);
    const theirTasks = others.flatMap(m => tasksFor(m.uid, today));

    /* keep the fade clock honest: it starts when the streak dies and
       clears the moment the streak is alive again */
    const broke = brokenDay();
    const youngest = TSSync.youngestAlive(synclings);
    if (broke && youngest && !youngest.fadingSince && Store.updateSyncling) {
      Store.updateSyncling(youngest.id, { fadingSince: Date.now() });
    }
    if (!broke) {
      synclings.filter(s => s.fadingSince && !s.lost).forEach(s => {
        if (Store.updateSyncling) Store.updateSyncling(s.id, { fadingSince: null });
      });
    }
    synclings.filter(s => TSSync.isFading(s) && TSSync.hoursLeft(s) <= 0 && !s.lost)
      .forEach(s => {
        if (Store.updateSyncling) Store.updateSyncling(s.id, { lost: true, lostAt: Date.now() });
      });

    TSSyncUI.render("#syncling-mount", {
      me: me, sync: sync, members: members, synclings: synclings, streak: streak,
      bestStreak: Math.max(streak, sync.bestStreak || 0),
      isPro: TSPlan.isPro(me),
      today: today,
      state: {
        mineDone: mine.length > 0 && mine.every(t => isDone(t, today)),
        theirsDone: theirTasks.length > 0 && theirTasks.every(t => isDone(t, today)),
        anyMissed: members.some(m => tasksFor(m.uid, today).some(t => TS.isMissed(t, today, completions)))
      }
    });
  }


  function render() {
    if (!me || !sync) return;
    paintStreak();
    $("#view-day").classList.toggle("hidden", currentView !== "day");
    $("#view-week").classList.toggle("hidden", currentView !== "week");
    $("#view-month").classList.toggle("hidden", currentView !== "month");
    if (currentView === "day") renderDay();
    if (currentView === "week") renderWeek();
    if (currentView === "month") renderMonth();
  }

  function dayComplete(uid, d) {
    const list = tasksFor(uid, d);
    if (!list.length) return null;
    return list.every(t => isDone(t, d));
  }
  function isRepaired(d) { return repairs.some(r => r.date === d); }
  function sharedStreak() {
    let streak = 0, d = TS.today();
    const st = members.map(m => dayComplete(m.uid, d));
    if (st.every(x => x !== false) && st.some(x => x === true)) streak++;
    d = TS.addDays(d, -1);
    for (let i = 0; i < 365; i++) {
      const s2 = members.map(m => dayComplete(m.uid, d));
      if (s2.some(x => x === false) && !isRepaired(d)) break;
      if (s2.every(x => x === null) && !isRepaired(d)) break;
      streak++; d = TS.addDays(d, -1);
    }
    return streak;
  }
  /* The most recent broken day - but only worth offering if a real streak
     died there. Nothing to restore if you never had one. */
  function brokenDay() {
    for (let i = 1; i <= 3; i++) {
      const d = TS.addDays(TS.today(), -i);
      if (isRepaired(d)) continue;
      const st = members.map(m => dayComplete(m.uid, d));
      if (st.some(x => x === false)) {
        return streakBefore(d) >= 1 ? d : null;
      }
      if (st.every(x => x === null)) return null;
    }
    return null;
  }

  /* how long the run was immediately before the given day */
  function streakBefore(dateStr) {
    let n = 0, d = TS.addDays(dateStr, -1);
    for (let i = 0; i < 365; i++) {
      const st = members.map(m => dayComplete(m.uid, d));
      if (st.some(x => x === false) && !isRepaired(d)) break;
      if (st.every(x => x === null) && !isRepaired(d)) break;
      n++; d = TS.addDays(d, -1);
    }
    return n;
  }
  function paintStreak() {
    const s = sharedStreak();
    /* on a narrow phone only the part outside .word survives, so make sure
       something readable is always left */
    $("#streak-label").innerHTML = s > 0
      ? s + '<span class="word">-day streak</span>'
      : 'Start<span class="word"> your streak</span>';

    const broke = brokenDay();
    const pill = document.querySelector(".streak-pill");
    let fix = document.getElementById("btn-repair");
    if (broke && members.length > 1) {
      if (!fix) {
        fix = document.createElement("button");
        fix.id = "btn-repair";
        fix.className = "repair-btn";
        pill.parentNode.insertBefore(fix, pill.nextSibling);
      }
      const short = TS.prettyShort(broke).split(",")[0];
      const lost = streakBefore(broke);
      fix.innerHTML = window.matchMedia("(max-width:820px)").matches
        ? "🛟 Restore"
        : "🛟 Restore " + short;
      fix.title = "Your " + lost + "-day streak broke on " + TS.prettyDay(broke);
      fix.onclick = () => askRepair(broke);
    } else if (fix) fix.remove();
  }

  function askRepair(dateStr) {
    const lost = streakBefore(dateStr);
    if (!TSPlan.isPro(me)) {
      tsPaywall("Restore your " + lost + "-day streak", "Streak restore");
      return;
    }
    if (!TSPlan.canRepair(me)) {
      tsToast("You've used your restore this month - it resets on the 1st");
      return;
    }
    const left = TSPlan.repairsAllowed(me) - TSPlan.repairsUsed(me);
    if (!confirm("Restore the streak for " + TS.prettyDay(dateStr) + "?\n\n" +
                 "You'll get your " + lost + "-day streak back. " +
                 "You have " + left + " restore" + (left === 1 ? "" : "s") + " left this month.")) return;
    Store.repairStreak(dateStr).then(() => {
      tsChime();
      tsToast("Streak restored 🛟");
      setTimeout(() => location.reload(), 800);
    });
  }

  /* ---------- DAY ---------- */
  let lastDate = null;
  function renderDay() {
    $("#date-title").textContent = currentDate === TS.today()
      ? "Today · " + TS.prettyShort(currentDate) : TS.prettyDay(currentDate);
    const changed = lastDate !== currentDate;
    lastDate = currentDate;

    /* mobile tabs, one per person */
    const tabs = $("#mobile-tabs");
    tabs.innerHTML = "";
    members.forEach(m => {
      const b = document.createElement("button");
      b.textContent = m.uid === me.uid ? "You" : m.name.split(" ")[0];
      b.dataset.uid = m.uid;
      b.className = m.uid === mobileTab ? "on" : "";
      b.addEventListener("click", () => { mobileTab = m.uid; applyMobileTab(); });
      tabs.appendChild(b);
    });

    const cols = $("#day-cols");
    cols.className = "cols" + (members.length > 2 ? " group-cols" : "");
    cols.dataset.mtab = mobileTab;
    cols.innerHTML = "";
    members.forEach(m => cols.appendChild(personColumn(m, changed)));

    applyMobileTab();
    renderSynclings();
    if (window.tsRenderChores) tsRenderChores({
      mount: "#chores-mount", sync, members, me,
      onSave: () => setTimeout(() => location.reload(), 500)
    });
    if (changed) sweepBars();
    maybeCelebrate();
    paintPresence([]);
    paintLocations();
  }

  /* on a phone only the selected person's column is shown - the tabs at the
     top switch between them instead of scrolling past everyone */
  function isPhone() { return window.matchMedia("(max-width:820px)").matches; }
  function applyMobileTab() {
    const phone = isPhone();
    document.querySelectorAll("#day-cols .person-col").forEach(col => {
      col.classList.toggle("mtab-hidden", phone && col.dataset.uid !== mobileTab);
    });
    document.querySelectorAll("#mobile-tabs button").forEach(b => {
      b.classList.toggle("on", b.dataset.uid === mobileTab);
    });
  }
  window.addEventListener("resize", applyMobileTab);

  function personColumn(m, cascade) {
    const mine = m.uid === me.uid;
    const list = tasksFor(m.uid, currentDate);
    const done = list.filter(t => isDone(t, currentDate)).length;
    const pct = list.length ? Math.round(done / list.length * 100) : 0;
    const hue = m.color || tsHue(m.name);

    const col = document.createElement("div");
    col.className = "person-col" + (mine ? " mine" : " theirs");
    col.dataset.uid = m.uid;
    col.innerHTML =
      '<div class="col-head">' +
        '<div class="who">' +
          '<span class="presence-wrap" data-presence="' + m.uid + '">' +
            '<span class="aura1"></span><span class="aura2"></span>' + tsAvatar(m, 36) +
          "</span>" +
          '<div class="txt">' +
            "<b>" + (mine ? "My day" : tsEsc(m.name) + "'s day") + "</b>" +
            "<span>" + (list.length ? done + " of " + list.length + " done" : "nothing planned") + "</span>" +
            '<span class="here-note" style="font-size:12px;color:var(--faint);">here now' +
              '<span class="dots"><i></i><i></i><i></i></span></span>' +
          "</div>" +
        "</div>" +
        '<div class="progress' + (mine ? "" : " theirs") + '">' +
          '<div class="bar"><i style="width:' + pct + '%;background:' + hue + ';"></i><span class="sweep"></span></div>' +
          '<span class="pct" style="color:' + hue + ';">' + pct + "%</span>" +
        "</div>" +
      "</div>" +
      '<div class="task-list' + (cascade ? " cascading" : "") + '"></div>';

    const listEl = col.querySelector(".task-list");
    if (!list.length) {
      listEl.innerHTML = mine
        ? tsEmptyState("Nothing planned yet.", "Tap + to add your first task")
        : tsEmptyState("Their day is clear.", "");
    } else {
      list.forEach(t => listEl.appendChild(taskRow(t, mine, m)));
      if (done === list.length) {
        const wrap = document.createElement("div");
        wrap.innerHTML = tsEmptyState("All done. 💜", "");
        wrap.firstChild.style.padding = "18px 16px";
        listEl.appendChild(wrap.firstChild);
      }
    }
    return col;
  }

  function taskRow(t, mine, owner) {
    const done = isDone(t, currentDate);
    const missed = !done && TS.isMissed(t, currentDate, completions);
    const row = document.createElement("div");
    row.className = "task" + (done ? " is-done" : "") + (missed ? " is-missed" : "");

    /* check ring */
    const ring = document.createElement("button");
    ring.className = "ring";
    ring.setAttribute("aria-label", done ? "Mark not done" : "Mark done");
    if (done) ring.textContent = "✓";
    if (mine) {
      ring.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!done && !tsReducedMotion()) {
          row.classList.add("blooming");
          ring.innerHTML = '<span class="ring-ripple"></span>' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" style="position:relative;"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="34"/></svg>';
          setTimeout(() => Store.setDone(t.id, currentDate, true), 520);
        } else Store.setDone(t.id, currentDate, !done);
        if (!done) tsToast("Nice. " + t.name + " ✓");
      });
    } else ring.style.pointerEvents = "none";

    const emoji = document.createElement("span");
    emoji.className = "emoji"; emoji.textContent = t.icon || "✨";

    const mid = document.createElement("div");
    mid.className = "mid";
    let meta;
    if (missed) meta = (t.time ? TS.prettyTime(t.time) + " · " : "") + (currentDate === TS.today() ? TS.overdueLabel(t) : "missed");
    else meta = (t.time ? TS.prettyTime(t.time) : "anytime today") + (TS.repeatLabel(t) ? " · " + TS.repeatLabel(t) : "");
    mid.innerHTML = '<span class="name"></span><span class="meta"></span>';
    mid.querySelector(".name").textContent = t.name;
    mid.querySelector(".meta").textContent = meta;

    row.append(ring, emoji, mid);

    /* little badges so you can see at a glance what a task carries */
    const badges = document.createElement("span");
    badges.style.cssText = "display:flex;align-items:center;gap:5px;flex:none;";
    if (t.place) {
      const b = document.createElement("span");
      b.textContent = "📍"; b.title = t.place; b.style.fontSize = "13px";
      badges.appendChild(b);
    }
    if (t.note) {
      const b = document.createElement("span");
      b.textContent = "📝"; b.title = "Has a note"; b.style.fontSize = "13px";
      badges.appendChild(b);
    }
    if (t.private) {
      const b = document.createElement("span");
      b.textContent = "🔒"; b.title = "Private - only you see this"; b.style.fontSize = "13px";
      badges.appendChild(b);
    } else if (t.owner === me.uid && (t.scope === "all" || t.scope === "pick")) {
      const b = document.createElement("span");
      b.textContent = "🔁";
      b.title = t.scope === "all" ? "Shows in all your syncs" : "Shows in several syncs";
      b.style.fontSize = "13px";
      badges.appendChild(b);
    }
    if (t.rsvp) {
      const going = rsvpsFor(t.id, currentDate).filter(r => r.status === "in").length;
      const b = document.createElement("span");
      b.className = "rsvp-chip";
      b.textContent = going ? going + " IN" : "INVITE";
      b.title = going ? going + " coming" : "Open invite - people can say if they're coming";
      badges.appendChild(b);
    }
    if (badges.children.length) row.appendChild(badges);

    const sh = shamesFor(t.id, currentDate);
    if (sh.length) {
      const chip = document.createElement("span");
      chip.className = "shame-count";
      chip.textContent = "😈 " + sh.length;
      chip.title = sh.map(x => person(x.from).name).join(", ");
      row.appendChild(chip);
    }

    /* praise counts anyone can see */
    const pr = praisesFor(t.id, currentDate);
    if (pr.length) {
      const chip = document.createElement("span");
      chip.className = "praise-count";
      const emojis = [...new Set(pr.map(p => p.emoji))].slice(0, 3).join("");
      chip.textContent = emojis + " " + pr.length;
      chip.title = pr.map(p => person(p.from).name).join(", ");
      row.appendChild(chip);
    }

    if (mine) {
      if (missed) {
        const chip = document.createElement("span");
        chip.className = "miss-chip"; chip.textContent = "MISSED";
        row.appendChild(chip);
      } else if (!t.time && !done) {
        const chip = document.createElement("span");
        chip.className = "anytime-chip"; chip.textContent = "ANYTIME";
        row.appendChild(chip);
      }
      row.dataset.clickable = "1";
      row.style.cursor = "pointer";
      row.addEventListener("click", () => openDetail(t, owner));
    } else {
      /* someone else's task */
      if (done) {
        /* praise them */
        const pb = document.createElement("button");
        pb.className = "praise-btn"; pb.textContent = "👏";
        pb.setAttribute("aria-label", "Send praise");
        pb.addEventListener("click", (e) => { e.stopPropagation(); openPraise(pb, t, owner); });
        row.appendChild(pb);
      } else if (missed && t.allowNudge !== false) {
        /* the moment has passed - nudging to "remind" them is pointless,
           so this becomes the playful callout instead */
        const sb = document.createElement("button");
        sb.className = "btn btn--shame";
        sb.innerHTML = '<span class="bell">😈</span> Shame';
        sb.title = "Playfully shame " + owner.name;
        const already = shamesFor(t.id, currentDate).some(x => x.from === me.uid);
        if (already) { sb.disabled = true; sb.innerHTML = "😈 Shamed"; }
        sb.addEventListener("click", async (e) => {
          e.stopPropagation();
          const chk = TSPlan.shameCheck(me, shames, me.uid, TS.today(), t.id);
          if (!chk.ok) {
            if (chk.reason === "pro") { tsPaywall("Shame them for missing it", "Playful shame"); return; }
            if (chk.reason === "cooldown") { tsToast("Let them breathe - try again in " + chk.wait + "m"); return; }
            tsToast("That's enough shame for one day 😅"); return;
          }
          sb.classList.add("wobbling");
          sb.disabled = true;
          const target = row.closest(".person-col").querySelector(".presence-wrap .av");
          tsFlyDot(sb, target || sb);
          const line = SHAME_LINES[Math.floor(Math.random() * SHAME_LINES.length)];
          await Store.sendShame(t.owner, t.id, currentDate, line);
          tsChime();
          sb.innerHTML = "😈 Shamed";
          tsToast("Shame sent to " + owner.name + " 😈");
        });
        row.appendChild(sb);
      } else if (t.allowNudge !== false) {
        /* still time to get it done - a nudge actually helps */
        const nb = document.createElement("button");
        nb.className = "bell-quiet"; nb.textContent = "🔔";
        nb.setAttribute("aria-label", "Nudge " + owner.name);
        nb.title = "Nudge " + owner.name;
        nb.addEventListener("click", async (e) => {
          e.stopPropagation();
          const chk = TSPlan.nudgeCheck(me, nudges, me.uid, TS.today(), t.id);
          if (!chk.ok) { tsPaywall("You're out of nudges for today", "More nudges"); return; }
          nb.classList.add("wobbling");
          const target = row.closest(".person-col").querySelector(".presence-wrap .av");
          tsFlyDot(nb, target || nb);
          setTimeout(() => nb.classList.remove("wobbling"), 900);
          await tryNudge(t, owner.name, nb);
        });
        row.appendChild(nb);
      }
      row.dataset.clickable = "1";
      row.style.cursor = "pointer";
      row.addEventListener("click", () => openDetail(t, owner));
    }
    return row;
  }

  /* ---------- praise picker ---------- */
  function openPraise(anchor, task, owner) {
    document.querySelectorAll(".praise-picker").forEach(p => p.remove());
    const box = document.createElement("div");
    box.className = "praise-picker";
    PRAISE.forEach(em => {
      const b = document.createElement("button");
      b.textContent = em;
      b.addEventListener("click", async (e) => {
        e.stopPropagation();
        box.remove();
        flyPraise(anchor, em);
        await Store.sendPraise(task.owner, task.id, currentDate, em);
        tsToast("Sent " + em + " to " + owner.name);
      });
      box.appendChild(b);
    });
    document.body.appendChild(box);
    const r = anchor.getBoundingClientRect();
    const w = 5 * 42 + 12;
    box.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + "px";
    box.style.top = (r.top + window.scrollY - 54) + "px";
    setTimeout(() => document.addEventListener("click", function close() {
      box.remove(); document.removeEventListener("click", close);
    }), 0);
  }
  function flyPraise(anchor, emoji) {
    if (tsReducedMotion()) return;
    const r = anchor.getBoundingClientRect();
    const el = document.createElement("span");
    el.className = "praise-fly"; el.textContent = emoji;
    el.style.left = (r.left + r.width / 2 - 13) + "px";
    el.style.top = (r.top - 6) + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  /* ---------- ambience ---------- */
  function sweepBars() {
    $$(".progress").forEach(p => { p.classList.remove("sweeping"); void p.offsetWidth; p.classList.add("sweeping"); });
  }
  function maybeCelebrate() {
    if (members.length < 2 || currentDate !== TS.today()) return;
    const states = members.map(m => dayComplete(m.uid, TS.today()));
    if (states.some(x => x !== true)) return;
    const key = "ts_celebrated_" + sync.id + "_" + TS.today();
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch (e) { return; }
    const el = document.createElement("div");
    el.className = "celebrate";
    el.innerHTML =
      '<div class="rings"><span class="glow"></span>' +
        '<svg class="rl" width="46" height="46" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="15" stroke="#7C3AED" stroke-width="7"/></svg>' +
        '<svg class="rr" width="46" height="46" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="15" stroke="#F0A050" stroke-width="7"/></svg>' +
      '</div><b>' + (sync.kind === "group" ? "Everyone's done today 🎉" : "Both done today 🎉") + "</b>";
    document.body.appendChild(el);
    tsChime();
    setTimeout(() => el.remove(), 3100);
  }

  /* ---------- WEEK / MONTH ---------- */
  function renderWeek() {
    const start = TS.addDays(currentDate, -TS.weekday(currentDate));
    $("#date-title").textContent = "Week of " + TS.prettyShort(start);
    const grid = $("#week-grid");
    grid.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const d = TS.addDays(start, i);
      const cell = document.createElement("div");
      cell.className = "week-day" + (d === TS.today() ? " is-today" : "");
      const all = members.flatMap(m => tasksFor(m.uid, d).map(t => ({ t, m })));
      let html = '<div class="wd"><span>' + TS.parseDate(d).toLocaleDateString("en-US", { weekday: "short" }) +
        '</span><span class="num">' + TS.parseDate(d).getDate() + "</span></div>";
      all.slice(0, 4).forEach(({ t, m }) => {
        const dn = isDone(t, d), ms = !dn && TS.isMissed(t, d, completions);
        html += '<div class="mini ' + (dn ? "d" : ms ? "m" : "") + '">' +
          '<span class="dot"' + (dn || ms ? "" : ' style="background:' + (m.color || "#E4DAF6") + '"') + "></span>" +
          '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
          (t.icon || "") + " " + tsEsc(t.name) + "</span></div>";
      });
      if (all.length > 4) html += '<span class="more">+' + (all.length - 4) + " more</span>";
      cell.innerHTML = html;
      cell.addEventListener("click", () => {
        currentDate = d; currentView = "day";
        $$(".viewseg button").forEach(x => x.classList.toggle("on", x.dataset.view === "day"));
        render();
      });
      grid.appendChild(cell);
    }
  }

  function renderMonth() {
    const d = TS.parseDate(currentDate);
    $("#date-title").textContent = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const grid = $("#month-grid");
    grid.innerHTML = "";
    ["S","M","T","W","T","F","S"].forEach(h => {
      const el = document.createElement("div"); el.className = "mh"; el.textContent = h; grid.appendChild(el);
    });
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const off = first.getDay();
    for (let i = 0; i < 42; i++) {
      const cd = new Date(d.getFullYear(), d.getMonth(), 1 - off + i);
      const ds = TS.fmtDate(cd);
      const cell = document.createElement("div");
      cell.className = "month-cell" + (cd.getMonth() === d.getMonth() ? "" : " out") + (ds === TS.today() ? " is-today" : "");
      const all = members.flatMap(m => tasksFor(m.uid, ds).map(t => ({ t, m })));
      let body = "";
      all.slice(0, 3).forEach(({ t, m }) => {
        const dn = isDone(t, ds), ms = !dn && TS.isMissed(t, ds, completions);
        body += '<div class="m-chip' + (dn ? " d" : ms ? " m" : "") + '">' +
          '<span class="ic">' + (t.icon || "•") + "</span>" +
          '<span class="nm">' + tsEsc(t.name) + "</span></div>";
      });
      if (all.length > 3) body += '<span class="m-more">+' + (all.length - 3) + " more</span>";
      cell.innerHTML = "<span class='m-num'>" + cd.getDate() + "</span>" +
        "<div class='m-body'>" + body + "</div>";
      cell.addEventListener("click", () => {
        currentDate = ds; currentView = "day";
        $$(".viewseg button").forEach(x => x.classList.toggle("on", x.dataset.view === "day"));
        render();
      });
      grid.appendChild(cell);
    }
  }


  /* ============================================================
     TASK DETAIL SHEET - read notes, location, RSVP
     ============================================================ */
  const dModal = $("#detail-modal");

  function openDetail(task, owner) {
    detailTask = task;
    paintDetail(task, owner);
    dModal.classList.add("open");
    /* if this is an all-syncs task and a sync is missing a copy
       (new sync made after the task), quietly top it up */
    if (task.owner === me.uid && task.scope === "all" && task.originId && Store.fanOutTask) {
      Store.listSyncs().then(list => {
        if (!list || list.length < 2) return;
        Store.fanOutTask(task.originId, {
          name: task.name, icon: task.icon, time: task.time, date: task.date,
          repeat: task.repeat, place: task.place || "", note: task.note || "",
          allowNudge: task.allowNudge !== false, rsvp: !!task.rsvp,
          private: false, scope: "all"
        }, list.map(x => x.id)).catch(() => {});
      }).catch(() => {});
    }
  }
  function closeDetail() { dModal.classList.remove("open"); detailTask = null; }

  function paintDetail(task, owner) {
    owner = owner || person(task.owner);
    const mine = task.owner === me.uid;
    const done = isDone(task, currentDate);

    $("#d-icon").textContent = task.icon || "✨";
    $("#d-title").textContent = task.name;
    $("#d-when").textContent =
      (task.time ? TS.prettyTime(task.time) : "anytime today") +
      (TS.repeatLabel(task) ? " · " + TS.repeatLabel(task) : "") +
      (done ? " · done ✓" : "");
    const scopeLabel = task.private ? "🔒 Private"
      : task.scope === "all" ? "🔁 In all your syncs"
      : task.scope === "pick" ? "🔁 In several syncs"
      : null;
    $("#d-owner").innerHTML = tsAvatar(owner, 26) +
      "<span>" + (mine ? "Yours" : tsEsc(owner.name) + "'s task") + "</span>" +
      (scopeLabel && mine ? '<span class="anytime-chip">' + scopeLabel + "</span>" : "");

    /* location */
    const place = $("#d-place");
    if (task.place) {
      place.classList.remove("hidden");
      place.href = mapUrl(task.place);
      $("#d-place-text").textContent = task.place;
    } else place.classList.add("hidden");

    /* note */
    if (task.note) {
      $("#d-note-wrap").classList.remove("hidden");
      $("#d-note").textContent = task.note;
    } else $("#d-note-wrap").classList.add("hidden");

    /* RSVP */
    if (task.rsvp) {
      $("#d-rsvp-wrap").classList.remove("hidden");
      const mine2 = myRsvp(task.id, currentDate);
      $$("#d-rsvp-pills .pill").forEach(p => p.classList.toggle("on", p.dataset.rsvp === mine2));
      const all = rsvpsFor(task.id, currentDate);
      const label = { in: "✅ in", maybe: "🤔 maybe", out: "❌ can't" };
      $("#d-rsvp-list").innerHTML = all.length
        ? all.map(r => '<div style="display:flex;align-items:center;gap:10px;font-size:14px;font-weight:500;">' +
            tsAvatar(person(r.uid), 24) + "<span>" + tsEsc(person(r.uid).name) + "</span>" +
            '<span style="margin-left:auto;color:var(--muted);">' + label[r.status] + "</span></div>").join("")
        : '<span style="font-size:13px;color:var(--faint);">Nobody has answered yet.</span>';
    } else $("#d-rsvp-wrap").classList.add("hidden");

    /* praise received */
    const pr = praisesFor(task.id, currentDate);
    if (pr.length) {
      $("#d-praise-wrap").classList.remove("hidden");
      $("#d-praise-list").innerHTML = pr.map(p =>
        '<span class="praise-count">' + p.emoji + " " + tsEsc(person(p.from).name) + "</span>").join("");
    } else $("#d-praise-wrap").classList.add("hidden");

    /* footer actions */
    const act = $("#d-action"), edit = $("#d-edit");
    edit.classList.toggle("hidden", !mine);
    if (mine) {
      act.textContent = done ? "Mark not done" : "Mark done";
      act.onclick = () => { Store.setDone(task.id, currentDate, !done); closeDetail(); };
    } else if (done) {
      act.textContent = "Send praise 👏";
      act.onclick = () => { Store.sendPraise(task.owner, task.id, currentDate, "👏"); tsToast("Sent 👏 to " + owner.name); closeDetail(); };
    } else if (TS.isMissed(task, currentDate, completions) && task.allowNudge !== false) {
      act.textContent = "Shame " + owner.name + " 😈";
      act.onclick = async () => {
        const chk = TSPlan.shameCheck(me, shames, me.uid, TS.today(), task.id);
        if (!chk.ok) {
          if (chk.reason === "pro") { tsPaywall("Shame them for missing it", "Playful shame"); return; }
          if (chk.reason === "cooldown") { tsToast("Let them breathe - try again in " + chk.wait + "m"); return; }
          tsToast("That's enough shame for one day 😅"); return;
        }
        const line = SHAME_LINES[Math.floor(Math.random() * SHAME_LINES.length)];
        await Store.sendShame(task.owner, task.id, currentDate, line);
        tsChime(); tsToast("Shame sent to " + owner.name + " 😈"); closeDetail();
      };
    } else if (task.allowNudge !== false) {
      act.textContent = "Nudge " + owner.name + " 🔔";
      act.onclick = async () => {
        const sent = await tryNudge(task, owner.name);
        if (sent) closeDetail();
      };
    } else { act.textContent = "Close"; act.onclick = closeDetail; }
    edit.onclick = () => { closeDetail(); openModal(task); };
  }

  $$("#d-rsvp-pills .pill").forEach(p => p.addEventListener("click", async () => {
    if (!detailTask) return;
    const cur = myRsvp(detailTask.id, currentDate);
    const next = cur === p.dataset.rsvp ? null : p.dataset.rsvp;
    await Store.setRsvp(detailTask.id, currentDate, next);
    tsToast(next === "in" ? "You're in 💪" : next === "maybe" ? "Marked maybe" : next === "out" ? "Marked can't make it" : "Answer cleared");
  }));
  $("#d-close").addEventListener("click", closeDetail);
  dModal.addEventListener("click", (e) => { if (e.target === dModal) closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });

  /* ============================================================
     TASK MODAL
     ============================================================ */
  const modal = $("#task-modal");

  function buildIconRow() {
    const row = $("#icon-row");
    row.innerHTML = "";
    ICONS.forEach(ic => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "icon-opt" + (ic === modalIcon ? " on" : "");
      b.textContent = ic;
      b.addEventListener("click", () => { modalIcon = ic; buildIconRow(); });
      row.appendChild(b);
    });
    /* your own emoji - type or paste anything */
    const custom = document.createElement("input");
    custom.className = "icon-custom" + (ICONS.includes(modalIcon) ? "" : " on");
    custom.maxLength = 4;
    custom.placeholder = "✎";
    custom.setAttribute("aria-label", "Type your own emoji");
    if (!ICONS.includes(modalIcon)) custom.value = modalIcon;
    custom.addEventListener("input", () => {
      const v = custom.value.trim();
      if (v) {
        modalIcon = v;
        $$("#icon-row .icon-opt").forEach(x => x.classList.remove("on"));
        custom.classList.add("on");
      }
    });
    row.appendChild(custom);
  }

  function syncWhenUI() {
    $$("#when-pills .pill").forEach(p => p.classList.toggle("on", p.dataset.when === modalWhen));
    $("#t-time").classList.toggle("hidden", modalWhen !== "time");
  }
  function syncRepeatUI() {
    $$("#repeat-pills .pill").forEach(p => p.classList.toggle("on", p.dataset.rep === modalRepeat));
    $("#day-picks").classList.toggle("hidden", modalRepeat !== "custom");
    $$("#day-picks .day-pick").forEach(p => p.classList.toggle("on", modalDays.has(Number(p.dataset.d))));
  }

  function openModal(task) {
    editingId = task ? task.id : null;
    $("#modal-title").textContent = task ? "Edit task" : "New task";
    const others = members.filter(m => m.uid !== me.uid);
    $("#modal-sub").textContent = others.length
      ? "Adding to my day · " + (sync.kind === "group" ? "your group" : others[0].name) + " will see it"
      : "Adding to my day";
    $("#t-name").value = task ? task.name : "";
    modalWhen = task ? (task.time ? "time" : "anytime") : "anytime";
    $("#t-time").value = (task && task.time) ? task.time : "18:30";
    $("#t-date").value = task ? (task.date || TS.today()) : currentDate;
    $("#t-note").value = task ? (task.note || "") : "";
    $("#t-place").value = task ? (task.place || "") : "";
    modalRsvp = task ? !!task.rsvp : false;
    $("#rsvp-switch").classList.toggle("on", modalRsvp);
    modalScope = task ? (task.scope || (task.private ? "private" : "sync")) : "sync";
    modalPickIds = new Set();
    if (task && task.originId && modalScope === "pick") {
      /* re-check the syncs this task already lives in */
      Store.listSyncs().then(list => {
        mySyncs = list || mySyncs;
        buildScopeUI();
      }).catch(() => {});
    }
    buildScopeUI();
    modalIcon = task ? (task.icon || ICONS[0]) : ICONS[0];
    modalRepeat = task ? task.repeat.type : "none";
    modalDays = new Set(task && task.repeat.days ? task.repeat.days : []);
    modalAllowNudge = task ? task.allowNudge !== false : true;
    $("#nudge-switch").classList.toggle("on", modalAllowNudge);
    $("#modal-delete").classList.toggle("hidden", !task);
    buildIconRow(); syncWhenUI(); syncRepeatUI();
    /* refresh the list so "all my syncs" always reflects reality */
    Store.listSyncs().then(list => {
      if (list && list.length) { mySyncs = list; buildScopeUI(); }
    }).catch(() => {});
    modal.classList.add("open");
    $("#fab-add").classList.add("open");
    /* only pull focus on a real keyboard - on touch it yanks the sheet around */
    if (window.matchMedia("(any-pointer:fine)").matches) {
      setTimeout(() => $("#t-name").focus(), 260);
    }
  }
  function closeModal() {
    modal.classList.remove("open");
    $("#fab-add").classList.remove("open");
  }

  function buildScopeUI() {
    $$("#scope-pills .pill").forEach(p => p.classList.toggle("on", p.dataset.scope === modalScope));
    const list = $("#scope-pick-list");
    list.classList.toggle("hidden", modalScope !== "pick");
    const n = mySyncs.length || 1;
    const names = mySyncs.map(x => x.name);
    const hints = {
      sync: "Only people in " + sync.name + " see it.",
      all: n > 1
        ? "Adds it to all " + n + " of your syncs: " + names.slice(0, 3).join(", ") +
          (names.length > 3 ? " +" + (names.length - 3) + " more" : "")
        : "You're only in 1 sync right now, so this behaves the same as \"This sync\". Make another sync and it'll appear in both.",
      pick: "Choose which syncs it shows up in.",
      private: "Only you can see this, even inside a sync."
    };
    $("#scope-hint").textContent = hints[modalScope];
    if (modalScope === "pick") {
      list.innerHTML = "";
      mySyncs.forEach(sy => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "toggle-row";
        const on = modalPickIds.has(sy.id) || sy.id === sync.id;
        row.innerHTML = '<span class="switch' + (on ? " on" : "") + '"><i></i></span><span>' +
          tsEsc(sy.name) + '</span>';
        row.addEventListener("click", () => {
          if (sy.id === sync.id) { tsToast("This sync is always included"); return; }
          modalPickIds.has(sy.id) ? modalPickIds.delete(sy.id) : modalPickIds.add(sy.id);
          buildScopeUI();
        });
        list.appendChild(row);
      });
      if (!mySyncs.length) list.innerHTML = '<span style="font-size:13px;color:var(--faint);">You\'re only in this one sync.</span>';
    }
  }
  $$("#scope-pills .pill").forEach(p => p.addEventListener("click", () => { modalScope = p.dataset.scope; buildScopeUI(); }));
  $("#rsvp-toggle").addEventListener("click", () => {
    modalRsvp = !modalRsvp;
    $("#rsvp-switch").classList.toggle("on", modalRsvp);
  });

  $$("#when-pills .pill").forEach(p => p.addEventListener("click", () => { modalWhen = p.dataset.when; syncWhenUI(); }));
  $$("#repeat-pills .pill").forEach(p => p.addEventListener("click", () => { modalRepeat = p.dataset.rep; syncRepeatUI(); }));
  $$("#day-picks .day-pick").forEach(p => p.addEventListener("click", () => {
    const d = Number(p.dataset.d);
    modalDays.has(d) ? modalDays.delete(d) : modalDays.add(d);
    syncRepeatUI();
  }));
  $("#nudge-toggle").addEventListener("click", () => {
    modalAllowNudge = !modalAllowNudge;
    $("#nudge-switch").classList.toggle("on", modalAllowNudge);
  });

  $("#fab-add").addEventListener("click", () => {
    modal.classList.contains("open") ? closeModal() : openModal(null);
  });
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  $("#modal-save").addEventListener("click", async () => {
    const name = $("#t-name").value.trim();
    if (!name) { tsToast("Give it a name first"); $("#t-name").focus(); return; }
    if (modalRepeat === "custom" && !modalDays.size) { tsToast("Pick at least one day"); return; }
    const data = {
      name,
      icon: modalIcon || "✨",
      time: modalWhen === "time" ? ($("#t-time").value || "09:00") : null,
      date: $("#t-date").value || TS.today(),
      repeat: { type: modalRepeat, days: modalRepeat === "custom" ? Array.from(modalDays) : [] },
      place: $("#t-place").value.trim(),
      note: $("#t-note").value.trim(),
      allowNudge: modalAllowNudge,
      rsvp: modalRsvp,
      private: modalScope === "private",
      scope: modalScope
    };

    /* the sync list may not have streamed in yet - never silently fall back
       to "this sync only" when the person asked for every sync */
    let all = mySyncs;
    if ((modalScope === "all" || modalScope === "pick") && !all.length) {
      try { all = await Store.listSyncs(); } catch (e) { all = []; }
    }
    let targets = null;
    if (modalScope === "all") {
      targets = all.length ? all.map(x => x.id) : [sync.id];
    } else if (modalScope === "pick") {
      targets = [sync.id].concat(Array.from(modalPickIds).filter(id => id !== sync.id));
    }

    let result = null;
    try {
      if (editingId) {
        await Store.updateTask(editingId, data, true);
        if (targets && targets.length > 1) {
          const existing = tasks.find(t => t.id === editingId);
          if (existing && existing.originId && Store.fanOutTask) {
            await Store.fanOutTask(existing.originId, data, targets);
          }
        }
      } else {
        result = await Store.addTask(data, targets);
      }
    } catch (err) {
      tsToast(err.message || "Couldn't save that task");
      return;
    }
    closeModal();

    /* say exactly what happened - no more guessing whether it fanned out */
    if (editingId) { tsToast("Task updated"); return; }
    if (data.private) { tsToast("Private task added 🔒"); return; }

    const added = result && result.added ? result.added : 1;
    const failed = result && result.failed ? result.failed : 0;

    if (failed) {
      tsToast("Saved here, but " + failed + " other sync" + (failed === 1 ? "" : "s") + " rejected it - check the console");
    } else if (modalScope === "all" && all.length <= 1) {
      /* the honest case: "all my syncs" when you only have one */
      tsToast("Task added. You're only in 1 sync right now, so that's the only place it shows.");
    } else if (added > 1) {
      const names = all.filter(x => targets.includes(x.id)).map(x => x.name);
      tsToast("Added to " + (names.length ? names.slice(0, 2).join(", ") +
        (names.length > 2 ? " +" + (names.length - 2) + " more" : "") : added + " syncs"));
    } else {
      tsToast("Task added");
    }
  });

  $("#modal-delete").addEventListener("click", async () => {
    if (!editingId) return;
    await Store.deleteTask(editingId, true);
    closeModal();
    tsToast("Task deleted");
  });
})();
