/* ============================================================
   TooSynced — settings page
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  let inviteUrl = "";
  tsAurora();

  tsRequireAuth(async (user, pair) => {
    $("#me-avatar").textContent = (user.name || "?").charAt(0).toUpperCase();
    $("#s-name").value = user.name || "";
    const prof = await Store.getProfile();
    if (prof && prof.phone) $("#s-phone").value = prof.phone;

    if (pair) {
      inviteUrl = CONFIG.APP_URL + "/index.html?join=" + pair.inviteCode;
      $("#invite-link").textContent = CONFIG.APP_URL.replace(/^https?:\/\//, "") + "/join/" + pair.inviteCode;
      const partner = (pair.members || []).find(m => m.uid !== user.uid);
      $("#pair-status-text").textContent = partner
        ? "Paired with " + partner.name
        : "Waiting for your partner to join";
      if (!partner) $("#pair-status").classList.remove("done");
    } else {
      $("#pair-status-text").textContent = "Not paired yet";
      $("#pair-status").classList.remove("done");
    }

    if (CONFIG.DEMO_MODE) $("#btn-reset-demo").classList.remove("hidden");
  });

  $("#btn-save-name").addEventListener("click", async () => {
    const name = $("#s-name").value.trim();
    if (!name) return;
    await Store.setName(name);
    if (Store.setPhone) await Store.setPhone($("#s-phone").value);
    $("#me-avatar").textContent = name.charAt(0).toUpperCase();
    tsToast("Profile saved");
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
