/* ============================================================
   TooSynced - streaks & stats page (all computed client-side)
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  let me = null, sync = null, members = [], partner = null, tasks = [], completions = new Map();
  tsAurora();

  tsRequireSync((user, s) => {
    me = user; sync = s;
    members = (s.memberUids || []).map(u => ({ uid: u, ...(s.members[u] || { name: "?" }) }));
    members.sort((a, b) => (a.uid === me.uid ? -1 : b.uid === me.uid ? 1 : 0));
    tsColorMembers(members, me.uid);
    partner = members.find(m => m.uid !== me.uid) || null;

    tsSyncSwitcher("#sync-switch", s);
    $("#my-av").outerHTML = tsAvatar(members[0] || me, 36);
    $("#my-name").textContent = "You";
    $("#legend-me").textContent = "You";
    if (partner) {
      $("#their-av").outerHTML = tsAvatar(partner, 36);
      $("#their-name").textContent = partner.name;
      $("#legend-them").textContent = partner.name;
    }
    /* a group sync compares you against the group's best day-rate */
    if (members.length > 2) {
      $("#their-name").textContent = "The group";
      $("#legend-them").textContent = "Group avg";
    }

    Store.watchTasks((t) => { tasks = t; render(); });
    Store.watchCompletions((c) => { completions = new Map(c.map(x => [x.taskId + "_" + x.date, x])); render(); });
  });
  function tasksFor(uid, d) { return tasks.filter(t => t.owner === uid && TS.occursOn(t, d)); }
  function isDone(t, d) { return completions.has(t.id + "_" + d); }
  function dayState(uid, d) {
    const list = tasksFor(uid, d);
    if (!list.length) return "none";
    return list.every(t => isDone(t, d)) ? "full" : list.some(t => isDone(t, d)) ? "part" : "zero";
  }

  function personStreak(uid) {
    let streak = 0, d = TS.today();
    const t = dayState(uid, d);
    if (t === "full") streak++;
    d = TS.addDays(d, -1);
    for (let i = 0; i < 365; i++) {
      const s = dayState(uid, d);
      if (s === "none") break;
      if (s !== "full") break;
      streak++; d = TS.addDays(d, -1);
    }
    return streak;
  }
  function rangeStats(uid, days) {
    let occ = 0, done = 0;
    for (let i = 0; i < days; i++) {
      const d = TS.addDays(TS.today(), -i);
      const list = tasksFor(uid, d);
      occ += list.length;
      done += list.filter(t => isDone(t, d)).length;
    }
    return { occ, done, pct: occ ? Math.round(done / occ * 100) : null };
  }

  function render() {
    if (!me) return;

    /* per-person cards */
    renderPerson(me.uid, "my");
    if (partner) renderPerson(partner.uid, "their");
    if (members.length > 2) $("#their-name").textContent = "The group";

    /* shared streak */
    const myS = personStreak(me.uid);
    const allS = members.map(m => personStreak(m.uid));
    const shared = members.length > 1 ? Math.min.apply(null, allS) : myS;
    $("#shared-streak").textContent = "Shared streak · " + shared + (shared === 1 ? " day" : " days");
    if (shared >= 3) {
      $("#hero-line").textContent = "You two are on a roll";
      $("#hero-sub").textContent = shared + " days without either of you dropping the ball.";
    } else if (shared >= 1) {
      $("#hero-line").textContent = "The streak has started";
      $("#hero-sub").textContent = "Keep every task checked today and it keeps climbing.";
    }

    renderBars();
    renderInsights();
  }

  function renderPerson(uid, prefix) {
    $("#" + prefix + "-streak").textContent = personStreak(uid);
    const wk = rangeStats(uid, 7);
    $("#" + prefix + "-week").textContent = "THIS WEEK " + (wk.pct === null ? "-" : wk.pct + "%");
    $("#" + prefix + "-kept").textContent = wk.pct === null ? "-" : wk.pct + "%";
    $("#" + prefix + "-7d").textContent = wk.done;

    /* heatmap: 18 weeks, columns = weeks, rows = weekdays.
       09: cells pop in column by column on first paint */
    const heat = $("#" + prefix + "-heat");
    if (!heat.dataset.painted) heat.dataset.painted = Date.now();
    const waveWindow = Date.now() - Number(heat.dataset.painted) < 1600;
    heat.innerHTML = "";
    heat.classList.toggle("waving", waveWindow);
    const today = TS.today();
    const endWd = TS.weekday(today);
    const start = TS.addDays(today, -(17 * 7 + endWd)); // back to a Sunday 18 weeks ago
    for (let w = 0; w < 18; w++) {
      for (let r = 0; r < 7; r++) {
        const d = TS.addDays(start, w * 7 + r);
        const i = document.createElement("i");
        i.style.setProperty("--d", (w * 0.045).toFixed(3) + "s");
        if (d <= today) {
          const s = dayState(uid, d);
          if (s === "full") i.style.background = prefix === "my" ? "#7C3AED" : "#F0A050";
          else if (s === "part") i.style.background = prefix === "my" ? "#C9B4FA" : "#F8D3A8";
          else if (s === "zero") i.style.background = "#E9E2F6";
        }
        heat.appendChild(i);
      }
    }
  }

  function weekPct(uid, weeksAgo) {
    const endWd = TS.weekday(TS.today());
    const weekStart = TS.addDays(TS.today(), -(endWd + weeksAgo * 7));
    let occ = 0, done = 0;
    for (let i = 0; i < 7; i++) {
      const d = TS.addDays(weekStart, i);
      if (d > TS.today()) continue;
      const list = tasksFor(uid, d);
      occ += list.length;
      done += list.filter(t => isDone(t, d)).length;
    }
    return occ ? Math.round(done / occ * 100) : 0;
  }

  let barsAnimated = false;
  function renderBars() {
    const bars = $("#bars");
    bars.innerHTML = "";
    const animate = !barsAnimated && !tsReducedMotion();
    for (let w = 4; w >= 0; w--) {
      const mine = weekPct(me.uid, w);
      const theirs = partner ? weekPct(partner.uid, w) : 0;
      const g = document.createElement("div");
      g.className = "bar-group" + (w === 0 ? " now" : "");
      g.innerHTML =
        '<div class="pair-bars">' +
          '<div class="bar mine" style="height:' + Math.max(mine, 4) + '%"></div>' +
          '<div class="bar theirs" style="height:' + Math.max(theirs, 4) + '%"></div>' +
        '</div>' +
        '<span class="lbl">' + (w === 0 ? "this week" : w + "w ago") + "</span>";
      bars.appendChild(g);
      if (animate) {
        g.querySelectorAll(".bar").forEach((b, i) => {
          const h = b.style.height;
          b.animate(
            [{ height: "4%" }, { height: h }],
            { duration: 700, delay: (4 - w) * 90 + i * 180, easing: "cubic-bezier(.2,.9,.2,1)", fill: "backwards" }
          );
        });
      }
    }
    if (animate) barsAnimated = true;
  }

  function renderInsights() {
    if (!partner) return;
    /* repeating tasks both have: compare 7-day keep rate */
    const mineRep = tasks.filter(t => t.owner === me.uid && t.repeat.type !== "none");
    const theirRep = tasks.filter(t => t.owner !== me.uid && t.repeat.type !== "none");
    const rows = [];
    const seen = new Set();
    [...mineRep, ...theirRep].forEach(t => {
      const key = t.name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const myMatch = mineRep.find(x => x.name.toLowerCase() === key);
      const theirMatch = theirRep.find(x => x.name.toLowerCase() === key);
      const myRate = myMatch ? keepRate(myMatch) : null;
      const theirRate = theirMatch ? keepRate(theirMatch) : null;
      let stat, color;
      if (myMatch && theirMatch) {
        if (myRate === 100 && theirRate === 100) { stat = "both 100%"; color = "var(--green)"; }
        else if (myRate > theirRate) { stat = "you lead"; color = "var(--primary)"; }
        else if (theirRate > myRate) { stat = "needs a nudge"; color = "var(--partner-deep)"; }
        else { stat = "even"; color = "var(--subtle)"; }
      } else {
        const r = myRate !== null ? myRate : theirRate;
        stat = r + "% kept";
        color = r >= 80 ? "var(--green)" : r >= 50 ? "var(--primary)" : "var(--partner-deep)";
      }
      rows.push({ icon: (myMatch || theirMatch).icon, name: (myMatch || theirMatch).name, stat, color, rate: Math.max(myRate ?? 0, theirRate ?? 0) });
    });
    rows.sort((a, b) => b.rate - a.rate);
    if (rows.length) {
      $("#help-rows").innerHTML = rows.slice(0, 4).map(r =>
        '<div class="help-row"><span style="font-size:17px;">' + r.icon + "</span> " + escTxt(r.name) +
        '<span class="stat" style="color:' + r.color + ';">' + r.stat + "</span></div>"
      ).join("");
      const best = rows[0];
      if (best.rate >= 60) {
        $("#nice-line").innerHTML = "You've been keeping <b>" + escTxt(best.name) + "</b> going strong. That's the streak that counts.";
      }
    }
  }
  function keepRate(t) {
    let occ = 0, done = 0;
    for (let i = 0; i < 7; i++) {
      const d = TS.addDays(TS.today(), -i);
      if (TS.occursOn(t, d)) { occ++; if (isDone(t, d)) done++; }
    }
    return occ ? Math.round(done / occ * 100) : 0;
  }
  function escTxt(s) { const d = document.createElement("div"); d.textContent = s; return d.innerHTML; }
})();
