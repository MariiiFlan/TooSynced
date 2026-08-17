/* ============================================================
   TooSynced — pairing page
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  const joinCode = new URLSearchParams(location.search).get("join");
  let inviteUrl = "";
  tsAurora();

  tsRequireAuth(async (user, pair) => {
    const initial = (user.name || "?").charAt(0).toUpperCase();
    $("#me-avatar").textContent = initial;
    $("#me-avatar-2").textContent = initial;

    /* arrived via an invite link → join straight away */
    if (joinCode && (!pair || !pair.joined)) {
      try {
        const joined = await Store.joinPair(joinCode);
        if (joined && joined.joined) { location.href = "app.html"; return; }
      } catch (err) {
        $("#join-error").textContent = err.message;
        $("#join-error").classList.remove("hidden");
      }
    }

    if (pair && pair.joined) { location.href = "app.html"; return; }

    /* no pair yet → create one so there's a code to share */
    if (!pair) pair = await Store.createPair();
    renderInvite(pair);

    /* live: the moment the partner joins, move on */
    Store.watchPair((p) => {
      if (p && p.joined) {
        tsToast("Your partner joined! Opening your shared schedule…");
        setTimeout(() => location.href = "app.html", 900);
      }
    });

    if (CONFIG.DEMO_MODE) {
      const btn = $("#btn-demo-join");
      btn.classList.remove("hidden");
      btn.addEventListener("click", () => Store.demoPartnerJoin());
    }
  });

  function renderInvite(pair) {
    const code = pair.inviteCode;
    inviteUrl = CONFIG.APP_URL + "/index.html?join=" + code;
    const short = CONFIG.APP_URL.replace(/^https?:\/\//, "") + "/join/";
    $("#invite-link").innerHTML = short + "<b>" + code + "</b>";

    $("#btn-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(inviteUrl); tsToast("Invite link copied"); }
      catch { tsToast("Couldn't copy — long-press the link instead"); }
    });
    $("#btn-share-text").addEventListener("click", () => {
      const msg = "Join me on TooSynced — we keep each other on schedule. " + inviteUrl;
      if (navigator.share) navigator.share({ text: msg }).catch(() => {});
      else location.href = "sms:?&body=" + encodeURIComponent(msg);
    });
    $("#btn-share-email").addEventListener("click", () => {
      location.href = "mailto:?subject=" + encodeURIComponent("Join me on TooSynced")
        + "&body=" + encodeURIComponent("We keep each other on schedule. Join here: " + inviteUrl);
    });
  }

  $("#btn-join").addEventListener("click", async () => {
    const code = $("#join-code").value.trim().toLowerCase();
    if (!code) return;
    $("#join-error").classList.add("hidden");
    try {
      if (CONFIG.DEMO_MODE) { await Store.demoPartnerJoin(); }
      else {
        const p = await Store.joinPair(code);
        if (p && p.joined) location.href = "app.html";
      }
    } catch (err) {
      $("#join-error").textContent = err.message;
      $("#join-error").classList.remove("hidden");
    }
  });
})();
