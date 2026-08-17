/* ============================================================
   TooSynced — settings
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  let inviteUrl = "", sync = null, me = null;

  tsAurora();

  tsRequireSync(async (user, s) => {
    me = user; sync = s;
    tsSyncSwitcher("#sync-switch", s);

    /* profile summary */
    $("#s-avatar").outerHTML = tsAvatar(user, 56);
    $("#s-display-name").textContent = user.name;
    $("#s-birthday-note").textContent = user.birthday
      ? "Birthday " + TS.prettyShort(user.birthday)
      : "No birthday set";
    if (user.phone) $("#s-phone").value = user.phone;

    paintSync(s);
    Store.watchSync((fresh) => { if (fresh) { sync = fresh; paintSync(fresh); } });

    if (CONFIG.DEMO_MODE) $("#btn-reset-demo").classList.remove("hidden");
  });

  function paintSync(s) {
    $("#s-sync-name").value = s.name;
    inviteUrl = CONFIG.APP_URL + "/index.html?join=" + s.inviteCode;
    $("#invite-link").textContent = CONFIG.APP_URL.replace(/^https?:\/\//, "") + "/join/" + s.inviteCode;
    const members = (s.memberUids || []).map(u => ({ uid: u, ...(s.members[u] || { name: "?" }) }));
    members.sort((a, b) => (a.uid === me.uid ? -1 : b.uid === me.uid ? 1 : 0));
    tsColorMembers(members, me.uid);
    $("#sync-info").innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;font-size:14px;color:var(--muted);font-weight:500;">' +
        '<span class="kind-chip ' + (s.kind === "group" ? "group" : "") + '">' + (s.kind === "group" ? "GROUP SYNC" : "TWO SYNC") + "</span>" +
        "<span>" + members.length + (members.length === 1 ? " person" : " people") + "</span></div>" +
      members.map(m =>
        '<div style="display:flex;align-items:center;gap:11px;font-size:14px;font-weight:500;">' +
        tsAvatar(m, 28) + "<span>" + tsEsc(m.name) + (m.uid === me.uid ? " (you)" : "") + "</span></div>"
      ).join("");
  }

  $("#btn-save-phone").addEventListener("click", async () => {
    await Store.updateProfile({ phone: $("#s-phone").value });
    tsToast("Phone saved");
  });

  $("#btn-rename").addEventListener("click", async () => {
    const name = $("#s-sync-name").value.trim();
    if (!name) return;
    await Store.updateSync(sync.id, { name });
    tsToast("Sync renamed");
  });

  $("#btn-leave").addEventListener("click", async () => {
    if (!confirm("Leave \"" + sync.name + "\"? You can rejoin later with the invite code.")) return;
    await Store.leaveSync(sync.id);
    location.href = "syncs.html";
  });

  $("#btn-copy").addEventListener("click", async () => {
    if (!inviteUrl) return;
    try { await navigator.clipboard.writeText(inviteUrl); tsToast("Invite link copied"); }
    catch { tsToast("Couldn't copy on this device"); }
  });

  $("#btn-notif").addEventListener("click", async () => {
    if (!("Notification" in window)) { tsToast("This browser doesn't support notifications"); return; }
    const p = await Notification.requestPermission();
    tsToast(p === "granted" ? "Notifications on 💜" : "Notifications blocked — check browser settings");
  });
  $("#btn-test-chime").addEventListener("click", () => tsChime());

  $("#btn-signout").addEventListener("click", async () => {
    await Store.signOut();
    location.href = "index.html";
  });
  $("#btn-reset-demo").addEventListener("click", async () => {
    await Store.resetDemo();
    location.href = "index.html";
  });
})();
