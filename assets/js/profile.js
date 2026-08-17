/* ============================================================
   TooSynced - profile setup (name, photo, birthday)
   Shown right after sign-up, and reachable from Settings.
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  let photo = null;
  let profile = null;

  tsAurora();

  function paintPreview() {
    const el = $("#pfp-preview");
    if (photo) {
      el.innerHTML = '<img src="' + photo + '" alt="">';
      $("#btn-clear-photo").classList.remove("hidden");
    } else {
      const n = ($("#p-name").value || "?").trim().charAt(0).toUpperCase() || "?";
      el.textContent = n;
      $("#btn-clear-photo").classList.add("hidden");
    }
  }

  Store.init().then(() => {
    Store.onAuth(async (user) => {
      if (!user) { location.href = "index.html"; return; }
      profile = await Store.getProfile();
      if (profile) {
        if (profile.name && profile.name !== "You") $("#p-name").value = profile.name;
        if (profile.birthday) $("#p-birthday").value = profile.birthday;
        photo = profile.photo || null;
        /* editing an existing profile rather than first run */
        $("#setup-title").textContent = "Your profile";
        $("#setup-sub").textContent = "Update how everyone in your syncs sees you.";
        $("#btn-save-profile").textContent = "Save profile";
      }
      paintPreview();
    });
  });

  $("#p-name").addEventListener("input", paintPreview);

  $("#btn-pick-photo").addEventListener("click", () => $("#pfp-input").click());
  $("#pfp-input").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $("#p-error").classList.add("hidden");
    const btn = $("#btn-pick-photo");
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Working…";
    try { photo = await tsReadPhoto(f, 160); paintPreview(); }
    catch (err) { showError(err.message); }
    finally { btn.disabled = false; btn.textContent = label; e.target.value = ""; }
  });
  $("#btn-clear-photo").addEventListener("click", () => { photo = null; $("#pfp-input").value = ""; paintPreview(); });

  function showError(m) { const e = $("#p-error"); e.textContent = m; e.classList.remove("hidden"); }

  $("#btn-save-profile").addEventListener("click", async () => {
    $("#p-error").classList.add("hidden");
    const name = $("#p-name").value.trim();
    if (!name) { showError("Pick a name people will recognize."); $("#p-name").focus(); return; }
    $("#btn-save-profile").disabled = true;
    try {
      await Store.updateProfile({
        name, photo, birthday: $("#p-birthday").value || null
      });
      tsToast("Profile saved");
      setTimeout(async () => {
        let sync = null;
        try { sync = await Store.getSync(); } catch (e) {}
        location.href = sync ? "settings.html" : "syncs.html";
      }, 700);
    } catch (err) {
      showError(err.message || "Couldn't save that.");
      $("#btn-save-profile").disabled = false;
    }
  });
})();
