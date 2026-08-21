/* ============================================================
   TooSynced - status pings and shared goals
   ============================================================ */

/* ---------- "on my way" ---------- */
const TSPings = (() => {
  const PRESETS = [
    { e: "🏃", t: "On my way" },
    { e: "🏋️", t: "At the gym" },
    { e: "📚", t: "Locked in" },
    { e: "🍳", t: "Making food" },
    { e: "🛏️", t: "Heading to bed" },
    { e: "🚗", t: "Driving" },
    { e: "😮‍💨", t: "Running late" },
    { e: "✅", t: "Done for today" }
  ];

  function render(mount, { me, sync, members, pings }) {
    const el = document.querySelector(mount);
    if (!el) return;
    const person = (uid) => members.find(m => m.uid === uid) || { name: "Someone" };
    const recent = (pings || [])
      .slice().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 2);

    el.innerHTML =
      '<div class="ping-card">' +
        '<button class="ping-btn" id="ping-open">👋 Let them know what you are doing</button>' +
        (recent.length
          ? '<div class="ping-list">' + recent.map(p =>
              '<div class="ping-row">' + tsAvatar(person(p.from), 22) +
              "<b>" + tsEsc(person(p.from).name.split(" ")[0]) + "</b>" +
              '<span class="ping-txt">' + p.emoji + " " + tsEsc(p.text) + "</span>" +
              '<i>' + ago(p.at) + "</i></div>").join("") + "</div>"
          : "") +
      "</div>";

    document.getElementById("ping-open").addEventListener("click", () => open(sync, me));
  }

  function ago(ts) {
    const m = Math.round((Date.now() - (ts || 0)) / 60000);
    if (m < 1) return "now";
    if (m < 60) return m + "m";
    return Math.round(m / 60) + "h";
  }

  function open(sync, me) {
    const veil = document.createElement("div");
    veil.className = "modal-veil";
    veil.innerHTML =
      '<div class="modal" style="max-width:420px;">' +
        '<div class="modal-head"><div class="t"><b>What are you up to?</b>' +
          "<span>Everyone in " + tsEsc(sync.name) + " sees it for 4 hours.</span></div>" +
          '<button class="modal-x" id="pg-x">✕</button></div>' +
        '<div class="modal-body"><div class="ping-grid">' +
          PRESETS.map((p, i) => '<button class="ping-opt" data-i="' + i + '">' +
            '<span class="e">' + p.e + "</span><span>" + p.t + "</span></button>").join("") +
        "</div></div></div>";
    document.body.appendChild(veil);
    requestAnimationFrame(() => veil.classList.add("open"));
    const close = () => { veil.classList.remove("open"); setTimeout(() => veil.remove(), 220); };
    veil.querySelector("#pg-x").addEventListener("click", close);
    veil.addEventListener("click", e => { if (e.target === veil) close(); });
    veil.querySelectorAll(".ping-opt").forEach(b => b.addEventListener("click", async () => {
      const p = PRESETS[Number(b.dataset.i)];
      await Store.sendPing(p.t, p.e);
      if (typeof TSPush !== "undefined") {
        TSPush.sendToSync(sync, (me.name || "Someone") + " " + p.e, p.t,
                          { syncId: sync.id, page: "app.html" });
      }
      close();
      tsToast("Sent " + p.e);
    }));
  }

  return { render };
})();

/* ---------- shared goals ---------- */
const TSGoals = (() => {

  /* how far along, counted from real completions */
  function progress(goal, tasks, completions, members) {
    const start = goal.start || TS.today();
    const end = goal.end || TS.addDays(start, 30);
    let n = 0;
    let d = start;
    for (let i = 0; i < 400 && d <= end && d <= TS.today(); i++) {
      members.forEach(m => {
        tasks.filter(t => t.owner === m.uid && TS.occursOn(t, d))
          .filter(t => !goal.match || (t.name || "").toLowerCase().includes(goal.match.toLowerCase()))
          .forEach(t => { if (completions.has(t.id + "_" + d)) n++; });
      });
      d = TS.addDays(d, 1);
    }
    return n;
  }

  function render(mount, ctx) {
    const el = document.querySelector(mount);
    if (!el) return;
    const { goals, tasks, completions, members, sync } = ctx;

    if (!goals || !goals.length) {
      el.innerHTML =
        '<div class="goal-card goal-empty">' +
          "<div><b>🎯 Set a goal together</b>" +
          "<p>A streak measures showing up. A goal measures how much you stacked.</p></div>" +
          '<button class="btn btn--ghost" id="goal-new">New</button>' +
        "</div>";
    } else {
      el.innerHTML = '<div class="goal-card">' +
        '<div class="goal-head"><b>Goals</b>' +
          '<button class="goal-add" id="goal-new">+ New</button></div>' +
        goals.map(g => {
          const n = progress(g, tasks, completions, members);
          const pct = Math.min(100, Math.round(n / Math.max(1, g.target) * 100));
          const hit = n >= g.target;
          return '<div class="goal-row' + (hit ? " hit" : "") + '" data-g="' + g.id + '">' +
            '<div class="goal-top"><span class="goal-name">' + (g.icon || "🎯") + " " + tsEsc(g.name) + "</span>" +
              '<span class="goal-num">' + n + " / " + g.target + (hit ? " ✓" : "") + "</span></div>" +
            '<div class="goal-bar"><i style="width:' + pct + '%"></i></div>' +
            "</div>";
        }).join("") + "</div>";
    }

    const nb = document.getElementById("goal-new");
    if (nb) nb.addEventListener("click", () => open(ctx));
    el.querySelectorAll(".goal-row").forEach(r => r.addEventListener("click", () => {
      const g = goals.find(x => x.id === r.dataset.g);
      if (g && confirm("Remove the goal: " + g.name + "?")) Store.deleteGoal(g.id);
    }));
  }

  function open(ctx) {
    const veil = document.createElement("div");
    veil.className = "modal-veil";
    veil.innerHTML =
      '<div class="modal" style="max-width:430px;">' +
        '<div class="modal-head"><div class="t"><b>New goal</b>' +
          "<span>Counts check-offs across everyone in the sync.</span></div>" +
          '<button class="modal-x" id="g-x">✕</button></div>' +
        '<div class="modal-body">' +
          '<div class="field"><label for="g-name">Goal</label>' +
            '<input class="input" id="g-name" maxlength="40" placeholder="Gym sessions this month"></div>' +
          '<div class="grid-2">' +
            '<div class="field"><label for="g-target">Target</label>' +
              '<input class="input" id="g-target" type="number" min="1" value="30"></div>' +
            '<div class="field"><label for="g-icon">Icon</label>' +
              '<input class="input icon-custom" id="g-icon" maxlength="4" value="🎯" style="width:100%;"></div>' +
          "</div>" +
          '<div class="field"><label for="g-match">Only count tasks containing <span class="opt">optional</span></label>' +
            '<input class="input" id="g-match" maxlength="30" placeholder="gym"></div>' +
        "</div>" +
        '<div class="modal-foot"><div class="spacer" style="margin-left:0;width:100%;">' +
          '<button class="btn btn--ghost" id="g-cancel" style="flex:1;">Cancel</button>' +
          '<button class="btn btn--primary" id="g-save" style="flex:1;">Create</button>' +
        "</div></div></div>";
    document.body.appendChild(veil);
    requestAnimationFrame(() => veil.classList.add("open"));
    const close = () => { veil.classList.remove("open"); setTimeout(() => veil.remove(), 220); };
    veil.querySelector("#g-x").addEventListener("click", close);
    veil.querySelector("#g-cancel").addEventListener("click", close);
    veil.addEventListener("click", e => { if (e.target === veil) close(); });
    veil.querySelector("#g-save").addEventListener("click", async () => {
      const name = veil.querySelector("#g-name").value.trim();
      if (!name) { tsToast("Name it first"); return; }
      await Store.addGoal({
        name,
        target: Math.max(1, Number(veil.querySelector("#g-target").value) || 30),
        icon: veil.querySelector("#g-icon").value.trim() || "🎯",
        match: veil.querySelector("#g-match").value.trim(),
        start: TS.today(),
        end: TS.addDays(TS.today(), 30)
      });
      close();
      tsToast("Goal set 🎯");
    });
  }

  return { render };
})();
