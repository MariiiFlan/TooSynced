/* ============================================================
   TooSynced — main schedule page
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const ICONS = ["🚶","🏃","🏋️","🧘","💊","📚","💻","☕","🍝","📖","🧹","💧","🛏️","🎸","🛒","💜"];

  let me = null, partner = null;
  let tasks = [];
  let completions = new Map(); // `${taskId}_${date}` -> completion
  let nudges = [];
  let seenNudgeIds = new Set();
  let currentDate = TS.today();
  let currentView = "day";
  let editingId = null;
  let modalRepeat = "none";
  let modalDays = new Set();
  let modalIcon = ICONS[0];
  let modalAllowNudge = true;
  let firstNudgeLoad = true;

  tsRequireAuth(async (user, pair) => {
    me = user;
    if (!pair) { location.href = "pair.html"; return; }
    partner = (pair.members || []).find(m => m.uid !== me.uid) || null;

    $("#me-avatar").textContent = initial(me.name);
    $("#col-me-av").textContent = initial(me.name);
    if (partner) {
      $("#col-them-av").textContent = initial(partner.name);
      $("#them-title").textContent = partner.name + "'s day";
      $("#mtab-theirs").textContent = partner.name;
      $("#nudge-toggle-label").textContent = "Let " + partner.name + " nudge me if I miss it";
    } else {
      $("#them-title").textContent = "Partner's day";
      $("#them-count").textContent = "not paired yet";
    }

    Store.watchTasks((t) => { tasks = t; render(); });
    Store.watchCompletions((c) => {
      completions = new Map(c.map(x => [x.taskId + "_" + x.date, x]));
      render();
    });
    Store.watchNudges((n) => {
      nudges = n;
      handleIncomingNudges();
      firstNudgeLoad = false;
    });
  });

  function initial(n) { return (n || "?").charAt(0).toUpperCase(); }

  /* ---------- incoming nudges: chime + notification ---------- */
  function handleIncomingNudges() {
    const mine = nudges.filter(n => n.to === me.uid && !n.seen && !seenNudgeIds.has(n.id));
    mine.forEach(n => {
      seenNudgeIds.add(n.id);
      if (!firstNudgeLoad) {
        const task = tasks.find(t => t.id === n.taskId);
        const who = partner ? partner.name : "Your partner";
        const what = task ? task.name : "a task";
        tsChime();
        tsToast("🔔 " + who + " nudged you about " + what);
        tsNotify("TooSynced", who + " nudged you: " + what);
      }
      Store.markNudgeSeen(n.id);
    });
  }

  /* ---------- view switching ---------- */
  $$(".viewseg button").forEach(b => b.addEventListener("click", () => {
    currentView = b.dataset.view;
    $$(".viewseg button").forEach(x => x.classList.toggle("on", x === b));
    render();
  }));
  $$(".mobile-tabs button").forEach(b => b.addEventListener("click", () => {
    $$(".mobile-tabs button").forEach(x => x.classList.toggle("on", x === b));
    $("#day-cols").dataset.mtab = b.dataset.mtab;
  }));
  $("#nav-prev").addEventListener("click", () => shift(-1));
  $("#nav-next").addEventListener("click", () => shift(1));
  $("#nav-today").addEventListener("click", () => { currentDate = TS.today(); render(); });
  function shift(dir) {
    const n = currentView === "day" ? 1 : currentView === "week" ? 7 : 30;
    if (currentView === "month") {
      const d = TS.parseDate(currentDate); d.setMonth(d.getMonth() + dir);
      currentDate = TS.fmtDate(d);
    } else currentDate = TS.addDays(currentDate, dir * n);
    render();
  }

  /* ---------- render ---------- */
  function render() {
    if (!me) return;
    renderStreakPill();
    $("#view-day").classList.toggle("hidden", currentView !== "day");
    $("#view-week").classList.toggle("hidden", currentView !== "week");
    $("#view-month").classList.toggle("hidden", currentView !== "month");
    if (currentView === "day") renderDay();
    if (currentView === "week") renderWeek();
    if (currentView === "month") renderMonth();
  }

  function tasksFor(uid, dateStr) {
    return tasks
      .filter(t => t.owner === uid && TS.occursOn(t, dateStr))
      .sort((a, b) => a.time.localeCompare(b.time));
  }
  function isDone(t, dateStr) { return completions.has(t.id + "_" + dateStr); }

  function renderStreakPill() {
    const streak = sharedStreak();
    $("#streak-label").textContent = streak > 0 ? streak + "-day streak 🔥" : "start your streak 🔥";
  }
  function dayComplete(uid, dateStr) {
    const list = tasksFor(uid, dateStr);
    if (!list.length) return null; // no tasks that day: doesn't count either way
    return list.every(t => isDone(t, dateStr));
  }
  function sharedStreak() {
    let streak = 0, d = TS.today();
    /* today only counts if already fully done; otherwise start from yesterday */
    const t1 = dayComplete(me.uid, d), t2 = partner ? dayComplete(partner.uid, d) : null;
    if ((t1 === true || t1 === null) && (t2 === true || t2 === null) && (t1 === true || t2 === true)) streak++;
    d = TS.addDays(d, -1);
    for (let i = 0; i < 365; i++) {
      const a = dayComplete(me.uid, d), b = partner ? dayComplete(partner.uid, d) : null;
      if (a === false || b === false) break;
      if (a === null && b === null) break;
      streak++;
      d = TS.addDays(d, -1);
    }
    return streak;
  }

  /* ---------- DAY ---------- */
  function renderDay() {
    $("#date-title").textContent = currentDate === TS.today() ? "Today · " + TS.prettyShort(currentDate) : TS.prettyDay(currentDate);
    renderColumn(me.uid, "#me-tasks", "#me-count", "#me-bar", "#me-pct", true);
    if (partner) renderColumn(partner.uid, "#them-tasks", "#them-count", "#them-bar", "#them-pct", false);
    else $("#them-tasks").innerHTML = emptyHtml("Share your invite link on the pairing page — their day shows up here.");
  }

  function renderColumn(uid, listSel, countSel, barSel, pctSel, isMine) {
    const list = tasksFor(uid, currentDate);
    const done = list.filter(t => isDone(t, currentDate)).length;
    $(countSel).textContent = list.length ? done + " of " + list.length + " done" : (isMine ? "nothing planned" : "nothing planned");
    const pct = list.length ? Math.round(done / list.length * 100) : 0;
    $(barSel).style.width = pct + "%";
    $(pctSel).textContent = pct + "%";

    const el = $(listSel);
    el.innerHTML = "";
    if (!list.length) {
      el.innerHTML = emptyHtml(isMine ? "Nothing planned. Tap + to add your first task." : "Their day is clear.");
      return;
    }
    list.forEach(t => el.appendChild(taskRow(t, isMine)));
  }

  function emptyHtml(msg) { return '<div class="empty-day">' + msg + "</div>"; }

  function taskRow(t, isMine) {
    const done = isDone(t, currentDate);
    const missed = !done && TS.isMissed(t, currentDate, completions);
    const row = document.createElement("div");
    row.className = "task" + (done ? " is-done" : "") + (missed ? " is-missed" : "");

    const ring = document.createElement("button");
    ring.className = "ring";
    ring.setAttribute("aria-label", done ? "Mark not done" : "Mark done");
    if (done) ring.textContent = "✓";
    if (isMine) {
      ring.addEventListener("click", (e) => {
        e.stopPropagation();
        Store.setDone(t.id, currentDate, !done);
        if (!done) tsToast("Nice. " + t.name + " ✓");
      });
    } else ring.style.pointerEvents = "none";

    const emoji = document.createElement("span");
    emoji.className = "emoji"; emoji.textContent = t.icon || "✨";

    const mid = document.createElement("div");
    mid.className = "mid";
    const meta = missed
      ? TS.prettyTime(t.time) + " · " + (currentDate === TS.today() ? TS.overdueLabel(t) : "missed")
      : TS.prettyTime(t.time) + (TS.repeatLabel(t) ? " · " + TS.repeatLabel(t) : "");
    mid.innerHTML = '<span class="name"></span><span class="meta"></span>';
    mid.querySelector(".name").textContent = t.name;
    mid.querySelector(".meta").textContent = meta;

    row.append(ring, emoji, mid);

    if (missed && isMine) {
      const chip = document.createElement("span");
      chip.className = "miss-chip"; chip.textContent = "MISSED";
      row.appendChild(chip);
    }
    if (!isMine && missed && t.allowNudge !== false) {
      const nb = document.createElement("button");
      nb.className = "btn btn--nudge"; nb.innerHTML = "🔔 Nudge";
      nb.addEventListener("click", async (e) => {
        e.stopPropagation();
        const sent = await Store.nudgesSentToday();
        if (sent >= CONFIG.NUDGE_DAILY_LIMIT) { tsToast("Nudge limit reached for today — keep it kind 💜"); return; }
        nb.disabled = true; nb.textContent = "Sent 💜";
        await Store.sendNudge(t.owner, t.id, currentDate);
        tsChime();
        tsToast("Nudge sent to " + (partner ? partner.name : "your partner"));
      });
      row.appendChild(nb);
    } else if (!isMine && !done && !missed && t.allowNudge !== false) {
      const nb = document.createElement("button");
      nb.className = "bell-quiet"; nb.textContent = "🔔";
      nb.setAttribute("aria-label", "Send a reminder");
      nb.addEventListener("click", async (e) => {
        e.stopPropagation();
        const sent = await Store.nudgesSentToday();
        if (sent >= CONFIG.NUDGE_DAILY_LIMIT) { tsToast("Nudge limit reached for today — keep it kind 💜"); return; }
        await Store.sendNudge(t.owner, t.id, currentDate);
        tsChime();
        tsToast("Reminder sent 💜");
      });
      row.appendChild(nb);
    }
    if (!isMine && !missed && !done && t.allowNudge === false) {
      const up = document.createElement("span");
      up.className = "upcoming"; up.textContent = "upcoming";
      row.appendChild(up);
    }

    if (isMine) {
      row.dataset.clickable = "1";
      row.style.cursor = "pointer";
      row.addEventListener("click", () => openModal(t));
    }
    return row;
  }

  /* ---------- WEEK ---------- */
  function renderWeek() {
    const start = TS.addDays(currentDate, -TS.weekday(currentDate)); // Sunday
    $("#date-title").textContent = "Week of " + TS.prettyShort(start);
    const grid = $("#week-grid");
    grid.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const d = TS.addDays(start, i);
      const cell = document.createElement("div");
      cell.className = "week-day" + (d === TS.today() ? " is-today" : "");
      const myList = tasksFor(me.uid, d);
      const theirList = partner ? tasksFor(partner.uid, d) : [];
      const dayName = TS.parseDate(d).toLocaleDateString("en-US", { weekday: "short" });
      let html = '<div class="wd"><span>' + dayName + '</span><span class="num">' + TS.parseDate(d).getDate() + "</span></div>";
      const both = [...myList.map(t => ({ t, mine: true })), ...theirList.map(t => ({ t, mine: false }))]
        .sort((a, b) => a.t.time.localeCompare(b.t.time));
      both.slice(0, 4).forEach(({ t }) => {
        const done = isDone(t, d);
        const missed = !done && TS.isMissed(t, d, completions);
        html += '<div class="mini ' + (done ? "d" : missed ? "m" : "") + '"><span class="dot"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(t.name) + "</span></div>";
      });
      if (both.length > 4) html += '<span class="more">+' + (both.length - 4) + " more</span>";
      cell.innerHTML = html;
      cell.addEventListener("click", () => {
        currentDate = d; currentView = "day";
        $$(".viewseg button").forEach(x => x.classList.toggle("on", x.dataset.view === "day"));
        render();
      });
      grid.appendChild(cell);
    }
  }

  /* ---------- MONTH ---------- */
  function renderMonth() {
    const d = TS.parseDate(currentDate);
    $("#date-title").textContent = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const grid = $("#month-grid");
    grid.innerHTML = "";
    ["S","M","T","W","T","F","S"].forEach(h => {
      const el = document.createElement("div"); el.className = "mh"; el.textContent = h; grid.appendChild(el);
    });
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const startOffset = first.getDay();
    const cells = 42;
    for (let i = 0; i < cells; i++) {
      const cd = new Date(d.getFullYear(), d.getMonth(), 1 - startOffset + i);
      const ds = TS.fmtDate(cd);
      const inMonth = cd.getMonth() === d.getMonth();
      const cell = document.createElement("div");
      cell.className = "month-cell" + (inMonth ? "" : " out") + (ds === TS.today() ? " is-today" : "");
      let dots = "";
      const myList = tasksFor(me.uid, ds);
      const theirList = partner ? tasksFor(partner.uid, ds) : [];
      myList.slice(0, 3).forEach(t => {
        const done = isDone(t, ds);
        const missed = !done && TS.isMissed(t, ds, completions);
        dots += "<i class='" + (done ? "d" : missed ? "m" : "") + "'></i>";
      });
      theirList.slice(0, 2).forEach(t => { dots += "<i class='" + (isDone(t, ds) ? "d" : "p") + "'></i>"; });
      cell.innerHTML = "<span>" + cd.getDate() + "</span><div class='dots'>" + dots + "</div>";
      cell.addEventListener("click", () => {
        currentDate = ds; currentView = "day";
        $$(".viewseg button").forEach(x => x.classList.toggle("on", x.dataset.view === "day"));
        render();
      });
      grid.appendChild(cell);
    }
  }

  function esc(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

  /* ============================================================
     TASK MODAL
     ============================================================ */
  const modal = $("#task-modal");

  function buildIconRow() {
    const row = $("#icon-row");
    row.innerHTML = "";
    ICONS.forEach(ic => {
      const b = document.createElement("button");
      b.className = "icon-opt" + (ic === modalIcon ? " on" : "");
      b.textContent = ic;
      b.addEventListener("click", () => { modalIcon = ic; buildIconRow(); });
      row.appendChild(b);
    });
  }

  function openModal(task) {
    editingId = task ? task.id : null;
    $("#modal-title").textContent = task ? "Edit task" : "New task";
    $("#modal-sub").textContent = "Adding to my day" + (partner ? " · " + partner.name + " will see it" : "");
    $("#t-name").value = task ? task.name : "";
    $("#t-time").value = task ? task.time : "18:30";
    $("#t-date").value = task ? (task.date || TS.today()) : currentDate;
    $("#t-note").value = task ? (task.note || "") : "";
    modalIcon = task ? (task.icon || ICONS[0]) : ICONS[0];
    modalRepeat = task ? task.repeat.type : "none";
    modalDays = new Set(task && task.repeat.days ? task.repeat.days : []);
    modalAllowNudge = task ? task.allowNudge !== false : true;
    $("#nudge-switch").classList.toggle("on", modalAllowNudge);
    $("#modal-delete").classList.toggle("hidden", !task);
    buildIconRow();
    syncRepeatUI();
    modal.classList.add("open");
    setTimeout(() => $("#t-name").focus(), 220);
  }
  function closeModal() { modal.classList.remove("open"); }

  function syncRepeatUI() {
    $$("#repeat-pills .pill").forEach(p => p.classList.toggle("on", p.dataset.rep === modalRepeat));
    $("#day-picks").classList.toggle("hidden", modalRepeat !== "custom");
    $$("#day-picks .day-pick").forEach(p => p.classList.toggle("on", modalDays.has(Number(p.dataset.d))));
  }

  $$("#repeat-pills .pill").forEach(p => p.addEventListener("click", () => {
    modalRepeat = p.dataset.rep; syncRepeatUI();
  }));
  $$("#day-picks .day-pick").forEach(p => p.addEventListener("click", () => {
    const d = Number(p.dataset.d);
    modalDays.has(d) ? modalDays.delete(d) : modalDays.add(d);
    syncRepeatUI();
  }));
  $("#nudge-toggle").addEventListener("click", () => {
    modalAllowNudge = !modalAllowNudge;
    $("#nudge-switch").classList.toggle("on", modalAllowNudge);
  });

  $("#fab-add").addEventListener("click", () => openModal(null));
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-cancel").addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  $("#modal-save").addEventListener("click", async () => {
    const name = $("#t-name").value.trim();
    if (!name) { $("#t-name").focus(); return; }
    const data = {
      name,
      icon: modalIcon,
      time: $("#t-time").value || "09:00",
      date: $("#t-date").value || TS.today(),
      repeat: { type: modalRepeat, days: modalRepeat === "custom" ? Array.from(modalDays) : [] },
      note: $("#t-note").value.trim(),
      allowNudge: modalAllowNudge
    };
    if (modalRepeat === "custom" && !modalDays.size) { tsToast("Pick at least one day"); return; }
    if (editingId) await Store.updateTask(editingId, data);
    else await Store.addTask(data);
    closeModal();
    tsToast(editingId ? "Task updated" : "Task added");
  });

  $("#modal-delete").addEventListener("click", async () => {
    if (!editingId) return;
    await Store.deleteTask(editingId);
    closeModal();
    tsToast("Task deleted");
  });
})();
