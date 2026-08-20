/* ============================================================
   TooSynced - invite people into the active sync
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  const joinCode = new URLSearchParams(location.search).get("join");
  let inviteUrl = "";
  let me = null;
  let wired = false;

  tsAurora();

  Store.init().then(() => {
    Store.onAuth(async (user) => {
      if (!user) { location.href = "index.html"; return; }
      me = user;
      $("#me-avatar").innerHTML = tsAvatar(user, 32);

      /* arrived from an invite link */
      if (joinCode) {
        try { await Store.joinSync(joinCode); location.href = "app.html"; return; }
        catch (err) { tsToast(err.message); }
      }

      let sync = await Store.getSync();
      if (!sync) { location.href = "syncs.html"; return; }

      Store.watchSync((s) => { if (s) paint(s); });
      paint(sync);

      if (CONFIG.DEMO_MODE) {
        const b = $("#btn-demo-join");
        b.classList.remove("hidden");
        b.addEventListener("click", () => Store.demoPartnerJoin());
      }
    });
  });

  function paint(sync) {
    const group = sync.kind === "group";
    $("#sync-title").textContent = sync.name;
    $("#sync-sub").textContent = group
      ? "Group sync - send this to everyone you want in."
      : "Two Sync - send this to your person.";
    $("#sync-photo").innerHTML = sync.photo
      ? '<img src="' + sync.photo + '" alt="">'
      : (group ? "👥" : "🫂");
    $("#invite-note").textContent = group
      ? "Anyone with this link can join the group."
      : "Only one person can join with it.";

    const members = (sync.memberUids || []).map(u => ({ uid: u, ...(sync.members[u] || { name: "?" }) }));
    members.sort((a, b) => (a.uid === me.uid ? -1 : b.uid === me.uid ? 1 : 0));
    tsColorMembers(members, me.uid);
    $("#members-title").textContent = "In this sync (" + members.length + ")";
    $("#member-list").innerHTML = members.map(m =>
      '<div style="display:flex;align-items:center;gap:11px;font-size:14px;font-weight:500;">' +
      tsAvatar(m, 28) + "<span>" + tsEsc(m.name) + (m.uid === me.uid ? " (you)" : "") + "</span></div>"
    ).join("");

    const enough = group ? members.length >= 2 : members.length >= 2;
    if (enough) {
      $("#waiting-title").textContent = group ? "Your group is rolling" : "You're synced";
      $("#waiting-sub").textContent = group
        ? "Invite more anytime - the link keeps working."
        : "Head to the schedule and add your first task.";
      const chip = document.querySelector(".pending-chip");
      chip.innerHTML = '<i style="background:var(--green);"></i> ACTIVE';
      chip.style.color = "var(--green)";
      document.querySelector(".pulse-ring").style.display = "none";
    }

    const code = sync.inviteCode;
    inviteUrl = tsInviteUrl(code);
    $("#code-text").textContent = code.toUpperCase();
    $("#invite-link").textContent = inviteUrl;

    if (wired) return;
    wired = true;

    /* tapping the big code copies just the code */
    $("#code-big").addEventListener("click", async () => {
      const c = (sync.inviteCode || "").toUpperCase();
      try {
        await navigator.clipboard.writeText(c);
        tsToast("Code " + c + " copied");
      } catch {
        /* clipboard blocked: select it so they can copy by hand */
        const r = document.createRange();
        r.selectNodeContents($("#code-text"));
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(r);
        tsToast("Long-press the code to copy");
      }
    });

    $("#btn-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(inviteUrl); tsToast("Invite link copied"); }
      catch { tsToast("Couldn't copy - long-press the link instead"); }
    });

    /* the share sheet sends code AND link, so it works either way */
    $("#btn-share-text").addEventListener("click", () => {
      const msg = tsInviteMessage(sync.inviteCode, sync.name);
      if (window.TSNative && TSNative.isNative) { TSNative.share(msg); return; }
      if (navigator.share) { navigator.share({ text: msg }).catch(() => {}); return; }
      location.href = "sms:?&body=" + encodeURIComponent(msg);
    });
  }
})();
