/* ============================================================
   TooSynced - syncs hub
   List your syncs, switch between them, create a Two Sync or a
   Group Sync, or join one with a code.
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  let kind = "two";
  let syncPhoto = null;
  let me = null;
  let allSyncs = [];

  tsAurora();

  Store.init().then(() => {
    Store.onAuth(async (user) => {
      if (!user) { location.href = "index.html"; return; }
      me = user;
      $("#me-avatar").innerHTML = tsAvatar(user, 32);
      Store.watchSyncs((list) => { allSyncs = list || []; render(list); paintLimits(); });
      const list = await Store.listSyncs();
      render(list);
    });
  });

  function paintLimits() {
    const pro = TSPlan.isPro(me);
    const owned = TSPlan.ownedCount(me, allSyncs);
    const max = TSPlan.maxOwned(me);
    const left = max - owned;

    /* group option is Pro-only to CREATE - joining a group is always free */
    const groupOpt = document.querySelector('[data-kind="group"]');
    groupOpt.classList.toggle("locked", !TSPlan.canCreateGroup(me));
    let lock = groupOpt.querySelector(".lock-chip");
    if (!TSPlan.canCreateGroup(me)) {
      if (!lock) {
        lock = document.createElement("span");
        lock.className = "lock-chip";
        lock.textContent = "PRO";
        groupOpt.appendChild(lock);
      }
    } else if (lock) lock.remove();

    const note = $("#plan-note");
    if (pro) {
      note.innerHTML = '<span class="pro-badge sm">PRO</span> Unlimited syncs, group syncs on.';
    } else if (left > 0) {
      note.innerHTML = "You can create <b>" + left + " more</b> sync" + (left === 1 ? "" : "s") +
        " on free. Joining someone else's is always unlimited. " +
        '<a href="#" id="plan-up">See Pro</a>';
    } else {
      note.innerHTML = "You've used both free syncs. You can still <b>join</b> as many as you like. " +
        '<a href="#" id="plan-up">Get Pro for more</a>';
    }
    const up = $("#plan-up");
    if (up) up.addEventListener("click", (e) => { e.preventDefault(); tsPaywall("More syncs, more people"); });
  }

  function render(list) {
    const el = $("#sync-list");
    if (!list || !list.length) {
      el.innerHTML = tsEmptyState("No syncs yet.", "Create one below, or join with a code someone sent you.");
      $("#hub-sub").textContent = "Start your first sync below.";
      return;
    }
    $("#hub-sub").textContent = list.length === 1
      ? "Pick it to jump in, or start another."
      : "Pick one to jump into, or start a new one.";
    el.innerHTML = "";
    list.forEach(s => {
      const members = (s.memberUids || []).map(u => ({ uid: u, ...(s.members[u] || { name: "?" }) }));
      members.sort((a, b) => (a.uid === me.uid ? -1 : b.uid === me.uid ? 1 : 0));
      tsColorMembers(members, me.uid);
      const stack = members.slice(0, 4).map(m => tsAvatar(m, 30)).join("") +
        (members.length > 4 ? '<span class="more av" style="width:30px;height:30px;">+' + (members.length - 4) + "</span>" : "");
      const btn = document.createElement("button");
      btn.className = "sync-card";
      btn.innerHTML =
        '<span class="sync-avatar">' +
          (s.photo ? '<img src="' + s.photo + '" alt="">' : (s.kind === "group" ? "👥" : "🫂")) +
        "</span>" +
        '<span class="body"><b>' + tsEsc(s.name) + "</b><span>" + tsSyncLabel(s) + "</span></span>" +
        '<span class="stack">' + stack + "</span>" +
        '<span class="kind-chip ' + (s.kind === "group" ? "group" : "") + '">' +
          (s.kind === "group" ? "GROUP" : "TWO") + "</span>";
      btn.addEventListener("click", async () => {
        await Store.setActiveSync(s.id);
        location.href = "app.html";
      });
      el.appendChild(btn);
    });
  }

  /* ---------- create ---------- */
  document.querySelectorAll(".create-opt").forEach(o => o.addEventListener("click", () => {
    if (o.dataset.kind === "group" && !TSPlan.canCreateGroup(me)) {
      tsPaywall("Group Syncs are a Pro thing", "Group Syncs");
      return;
    }
    kind = o.dataset.kind;
    document.querySelectorAll(".create-opt").forEach(x => x.classList.toggle("on", x === o));
    if (!syncPhoto) $("#sync-photo-preview").textContent = kind === "group" ? "👥" : "🫂";
    $("#sync-name").placeholder = kind === "group" ? "Gym crew" : "Me & Jordan";
  }));

  $("#btn-sync-photo").addEventListener("click", () => $("#sync-photo-input").click());
  $("#sync-photo-input").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $("#create-error").classList.add("hidden");
    const btn = $("#btn-sync-photo");
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Working…";
    try {
      syncPhoto = await tsReadPhoto(f, 160);
      $("#sync-photo-preview").innerHTML = '<img src="' + syncPhoto + '" alt="">';
      $("#btn-sync-photo-clear").classList.remove("hidden");
    } catch (err) { showErr("#create-error", err.message); }
    finally { btn.disabled = false; btn.textContent = label; e.target.value = ""; }
  });
  $("#btn-sync-photo-clear").addEventListener("click", () => {
    syncPhoto = null;
    $("#sync-photo-input").value = "";
    $("#sync-photo-preview").textContent = kind === "group" ? "👥" : "🫂";
    $("#btn-sync-photo-clear").classList.add("hidden");
  });

  function showErr(sel, m) { const e = $(sel); e.textContent = m; e.classList.remove("hidden"); }

  $("#btn-create-sync").addEventListener("click", async () => {
    $("#create-error").classList.add("hidden");

    if (kind === "group" && !TSPlan.canCreateGroup(me)) {
      tsPaywall("Group Syncs are a Pro thing", "Group Syncs");
      return;
    }
    if (!TSPlan.canCreateSync(me, allSyncs)) {
      tsPaywall("You've used your " + TSPlan.maxOwned(me) + " free syncs", "Unlimited syncs");
      return;
    }

    const name = $("#sync-name").value.trim();
    if (!name) { showErr("#create-error", "Give it a name so you can tell your syncs apart."); $("#sync-name").focus(); return; }
    $("#btn-create-sync").disabled = true;
    try {
      await Store.createSync(name, kind, syncPhoto);
      location.href = "invite.html";
    } catch (err) {
      showErr("#create-error", err.message || "Couldn't create that sync.");
      $("#btn-create-sync").disabled = false;
    }
  });

  /* ---------- join ---------- */
  $("#btn-join").addEventListener("click", async () => {
    $("#join-error").classList.add("hidden");
    const code = $("#join-code").value.trim().toLowerCase();
    if (!code) return;
    try {
      await Store.joinSync(code);
      location.href = "app.html";
    } catch (err) {
      showErr("#join-error", err.message);
    }
  });
})();
