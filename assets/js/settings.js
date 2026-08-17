/* ============================================================
   TooSynced - settings
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

    /* location check-in status */
    Store.watchLocations((locs) => {
      const mine = (locs || {})[user.uid];
      $("#loc-status").textContent = mine
        ? "Sharing" + (mine.label ? " · " + mine.label : "") + " (tap again to refresh)"
        : "Not sharing";
      $("#btn-clear-loc").classList.toggle("hidden", !mine);
    });

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

  $("#btn-share-loc").addEventListener("click", () => {
    if (!navigator.geolocation) { tsToast("This device can't share location"); return; }
    const btn = $("#btn-share-loc");
    btn.disabled = true; btn.textContent = "Finding you...";
    navigator.geolocation.getCurrentPosition(async (pos) => {
      await Store.shareLocation({
        lat: Number(pos.coords.latitude.toFixed(5)),
        lng: Number(pos.coords.longitude.toFixed(5))
      });
      btn.disabled = false; btn.textContent = "Share where I am";
      tsToast("Location shared with this sync 📍");
    }, (err) => {
      btn.disabled = false; btn.textContent = "Share where I am";
      tsToast(err.code === 1
        ? "Location permission denied - allow it in your browser settings"
        : "Couldn't get your location");
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });

  $("#btn-clear-loc").addEventListener("click", async () => {
    await Store.clearLocation();
    tsToast("Stopped sharing your location");
  });

  $("#btn-notif").addEventListener("click", async () => {
    const p = await tsAskNotify();
    if (p === "unsupported") { tsToast("This browser doesn't support notifications"); return; }
    if (p === "granted") {
      tsToast("Notifications on 💜");
      tsNotify("TooSynced", "You're all set - nudges will show up here.", "test");
    } else if (p === "denied") {
      tsToast("Blocked - turn them on in your browser's site settings");
    }
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
