/* ============================================================
   TooSynced - settings
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  let inviteUrl = "", sync = null, me = null;

  tsAurora();
  tsBottomNav("settings.html");

  tsRequireUser(async (user, s) => {
    me = user; sync = s;

    /* no sync yet: keep profile, Pro and account usable, hide the rest */
    if (!s) {
      document.querySelectorAll("[data-needs-sync]").forEach(el => el.classList.add("hidden"));
      document.getElementById("no-sync-card").classList.remove("hidden");
      const sw = document.querySelector("#sync-switch");
      if (sw) sw.innerHTML = '<a class="btn btn--ghost" href="syncs.html" style="padding:8px 14px;font-size:14px;">Your syncs</a>';
      document.querySelectorAll('.topnav a[href="app.html"],.topnav a[href="chat.html"],.topnav a[href="streaks.html"]')
        .forEach(a => { a.style.opacity = ".45"; a.title = "Join or create a sync first"; });
    } else {
      tsSyncSwitcher("#sync-switch", s);
    }

    /* profile summary */
    $("#s-avatar").outerHTML = tsAvatar(user, 56);
    $("#s-display-name").textContent = user.name;
    $("#s-birthday-note").textContent = user.birthday
      ? "Birthday " + TS.prettyShort(user.birthday)
      : "No birthday set";
    if (user.phone) $("#s-phone").value = user.phone;

    if (s) {
      paintSync(s);
      Store.watchSync((fresh) => { if (fresh) { sync = fresh; paintSync(fresh); } });
    }

    /* location check-in status */
    if (s) Store.watchLocations((locs) => {
      const mine = (locs || {})[user.uid];
      $("#loc-status").textContent = mine
        ? "Sharing" + (mine.label ? " · " + mine.label : "") + " (tap again to refresh)"
        : "Not sharing";
      $("#btn-clear-loc").classList.toggle("hidden", !mine);
    });

    if (CONFIG.DEMO_MODE) $("#btn-reset-demo").classList.remove("hidden");
    paintMode();
    paintPro(user);
    if (s) { paintThemes(user, s); paintStreakIcon(user, s); }
  });

  function paintSync(s) {
    $("#s-sync-name").value = s.name;
    inviteUrl = tsInviteUrl(s.inviteCode);
    $("#invite-link").textContent = (s.inviteCode || "").toUpperCase();
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
    if (!sync) return;
    const name = $("#s-sync-name").value.trim();
    if (!name) return;
    await Store.updateSync(sync.id, { name });
    tsToast("Sync renamed");
  });

  $("#btn-leave").addEventListener("click", async () => {
    if (!sync) return;
    if (!confirm("Leave \"" + sync.name + "\"? You can rejoin later with the invite code.")) return;
    await Store.leaveSync(sync.id);
    location.href = "syncs.html";
  });

  $("#btn-copy").addEventListener("click", async () => {
    if (!sync) return;
    try {
      await navigator.clipboard.writeText(tsInviteMessage(sync.inviteCode, sync.name));
      tsToast("Invite copied");
    } catch { tsToast("Couldn't copy on this device"); }
  });

  $("#btn-share-loc").addEventListener("click", async () => {
    if (!sync) { tsToast("Join or create a sync first"); return; }
    const btn = $("#btn-share-loc");

    /* native gets the proper system permission dialog */
    if (window.TSNative && TSNative.isNative) {
      btn.disabled = true; btn.textContent = "Finding you...";
      try {
        const c = await TSNative.getPosition();
        await Store.shareLocation({
          lat: Number(c.latitude.toFixed(5)),
          lng: Number(c.longitude.toFixed(5))
        });
        tsToast("Location shared with this sync 📍");
      } catch (e) {
        tsToast(e.message === "denied"
          ? "Location permission denied - turn it on in Android settings"
          : "Couldn't get your location");
      }
      btn.disabled = false; btn.textContent = "Share where I am";
      return;
    }

    if (!navigator.geolocation) { tsToast("This device can't share location"); return; }
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
  $("#btn-delete-account").addEventListener("click", async () => {
    const name = (me && me.name) || "your account";
    if (!confirm("Delete " + name + "?\n\nThis removes your profile, tasks, streaks and location pins. It cannot be undone.")) return;
    const typed = prompt('Type DELETE to confirm.');
    if (!typed || typed.trim().toUpperCase() !== "DELETE") { tsToast("Cancelled"); return; }
    const btn = $("#btn-delete-account");
    btn.disabled = true; btn.textContent = "Deleting...";
    try {
      await Store.deleteAccount();
      tsToast("Your account has been deleted");
      setTimeout(() => { location.href = "index.html"; }, 1200);
    } catch (err) {
      btn.disabled = false; btn.textContent = "Delete my account";
      tsToast(err && /recent/i.test(err.message || "")
        ? "For security, sign out and back in, then delete."
        : (err.message || "Couldn't delete the account"));
    }
  });

  $("#btn-reset-demo").addEventListener("click", async () => {
    await Store.resetDemo();
    location.href = "index.html";
  });
})();

/* ============================================================
   Pro panel + sync themes
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);

  window.paintPro = function (user) {
    const pro = TSPlan.isPro(user);
    const price = CONFIG.PRICE.SYMBOL + CONFIG.PRICE.MONTHLY.toFixed(2);
    $("#pro-state").innerHTML = pro
      ? '<span class="pro-badge sm">ACTIVE</span>'
      : '<span class="lock-chip">FREE</span>';
    $("#pro-blurb").textContent = pro
      ? "Group syncs, unlimited syncs, streak repair, themes, chores and weekly recaps are all on."
      : "Group Syncs, unlimited syncs, streak repair, sync themes, chore rotation and weekly recap cards for " + price + "/month.";

    const owned = TSPlan.ownedCount(user, window.__syncs || []);
    const rows = [
      ["Syncs you've created", owned + " of " + (pro ? "unlimited" : TSPlan.maxOwned(user))],
      ["Nudges a day", TSPlan.nudgeAllowance(user) + " (first nudge on each task is always free)"],
      ["Streak repairs this month",
        TSPlan.repairsUsed(user) + " of " + TSPlan.repairsAllowed(user)]
    ];
    $("#pro-usage").innerHTML = rows.map(([k, v]) =>
      '<div style="display:flex;justify-content:space-between;gap:12px;font-size:14px;">' +
      '<span style="color:var(--muted);">' + k + '</span><b>' + v + "</b></div>").join("");

    $("#btn-pro").textContent = pro ? "Manage Pro" : "See Pro - " + price + "/mo";
    $("#btn-pro").onclick = () => pro ? tsCheckout() : tsPaywall("Everything TooSynced can do");
    $("#btn-pro-off").classList.toggle("hidden", !pro);
    $("#btn-pro-off").onclick = async () => {
      await Store.updateProfile({ pro: false });
      tsToast("Pro turned off");
      setTimeout(() => location.reload(), 600);
    };
    Store.listSyncs().then(list => {
      window.__syncs = list;
      const o = TSPlan.ownedCount(user, list);
      const first = $("#pro-usage").firstChild;
      if (first) first.querySelector("b").textContent = o + " of " + (pro ? "unlimited" : TSPlan.maxOwned(user));
    });
  };

  window.paintMode = function () {
    const cur = TSMode.get();
    document.querySelectorAll(".mode-opt").forEach(b => {
      b.classList.toggle("on", b.dataset.m === cur);
      b.onclick = () => {
        TSMode.set(b.dataset.m);
        paintMode();
        tsToast(b.dataset.m === "auto"
          ? "Following your phone"
          : b.dataset.m === "dark" ? "Dark mode on" : "Light mode on");
      };
    });
  };

  const STREAK_ICONS = ["🔥", "⚡", "💜", "🏆", "💎", "🌟", "🚀", "😤", "🧊", "🍀"];

  window.paintStreakIcon = function (user, sync) {
    const pro = TSPlan.isPro(user);
    $("#icon-sync-name").textContent = sync.name;
    $("#icon-lock").innerHTML = pro ? "" : '<span class="lock-chip">PRO</span>';
    const row = $("#streak-icon-row");
    const current = sync.streakIcon || "🔥";
    row.innerHTML = "";

    const choose = async (icon, el) => {
      if (!pro) { tsPaywall("Make the streak yours", "Your streak icon"); return false; }
      await Store.updateSync(sync.id, { streakIcon: icon });
      sync.streakIcon = icon;
      document.querySelectorAll(".streak-opt,.streak-custom").forEach(x => x.classList.remove("on"));
      if (el) el.classList.add("on");
      tsToast("Streak icon is now " + icon + " for everyone in " + sync.name);
      return true;
    };

    STREAK_ICONS.forEach(ic => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "streak-opt" + (ic === current ? " on" : "");
      b.textContent = ic;
      b.addEventListener("click", () => choose(ic, b));
      row.appendChild(b);
    });

    /* anything they want */
    const custom = document.createElement("input");
    custom.className = "streak-custom" + (STREAK_ICONS.includes(current) ? "" : " on");
    custom.maxLength = 4;
    custom.placeholder = "✎";
    custom.title = "Type any emoji";
    if (!STREAK_ICONS.includes(current)) custom.value = current;
    custom.addEventListener("input", async () => {
      const v = custom.value.trim();
      if (!v) return;
      const ok = await choose(v, custom);
      if (!ok) custom.value = "";
    });
    row.appendChild(custom);
  };

  window.paintThemes = function (user, sync) {
    const pro = TSPlan.isPro(user);
    $("#theme-sync-name").textContent = sync.name;
    $("#theme-lock").innerHTML = pro ? "" : '<span class="lock-chip">PRO</span>';
    const grid = $("#theme-grid");
    grid.innerHTML = "";
    Object.keys(TS_THEMES).forEach(key => {
      const t = TS_THEMES[key];
      const b = document.createElement("button");
      b.className = "theme-opt" + ((sync.theme || "lavender") === key ? " on" : "");
      b.innerHTML =
        '<span class="sw" style="background:' + t.swatch + ';"></span>' +
        "<span>" + t.name + "</span>";
      b.addEventListener("click", async () => {
        if (!pro) { tsPaywall("Themes set the vibe for the whole sync", "Sync themes"); return; }
        await Store.updateSync(sync.id, { theme: key });
        tsApplyTheme(key);
        tsToast(t.name + " applied to " + sync.name);
        document.querySelectorAll(".theme-opt").forEach(x => x.classList.remove("on"));
        b.classList.add("on");
      });
      grid.appendChild(b);
    });
  };
})();
