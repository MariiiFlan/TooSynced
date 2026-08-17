/* ============================================================
   TooSynced - chore rotation + weekly recap
   Both are Pro features. Chores only make sense in a Group Sync.
   ============================================================ */

/* ---------- week helpers ---------- */
window.tsWeekIndex = (dateStr) => {
  /* whole weeks since a fixed Sunday, so rotation is stable for everyone */
  const epoch = new Date(2024, 0, 7); // a Sunday
  const d = TS.parseDate(dateStr || TS.today());
  return Math.floor((d - epoch) / (7 * 86400000));
};
window.tsWeekStart = (dateStr) => TS.addDays(dateStr || TS.today(), -TS.weekday(dateStr || TS.today()));

/* whose turn is it for a chore this week */
window.tsChoreTurn = (chore, members, dateStr) => {
  const order = (chore.order && chore.order.length ? chore.order : members.map(m => m.uid))
    .filter(u => members.some(m => m.uid === u));
  if (!order.length) return null;
  /* offset spreads chores across different people in the same week,
     then everything shifts along together each week */
  const weeks = tsWeekIndex(dateStr) - (chore.startWeek || 0) + (chore.offset || 0);
  const i = ((weeks % order.length) + order.length) % order.length;
  return order[i];
};

/* ============================================================
   CHORES UI
   ============================================================ */
window.tsRenderChores = (opts) => {
  const { mount, sync, members, me, onSave } = opts;
  const el = document.querySelector(mount);
  if (!el) return;

  if (sync.kind !== "group") { el.innerHTML = ""; return; }

  const chores = (sync.chores && sync.chores.list) || [];
  const pro = TSPlan.isPro(me);

  if (!chores.length) {
    el.innerHTML =
      '<div class="chores-card">' +
        '<div class="chores-head"><b>🧹 Chore rotation</b>' +
          (pro ? "" : '<span class="lock-chip">PRO</span>') + "</div>" +
        '<p class="chores-empty">Trash, dishes, bathroom - set them once and they rotate ' +
          "through the group every week, posted to chat.</p>" +
        '<button class="btn btn--primary" id="btn-chores-setup" style="align-self:flex-start;">Set up chores</button>' +
      "</div>";
    document.getElementById("btn-chores-setup").addEventListener("click", () => {
      if (!pro) { tsPaywall("Chore rotation keeps the peace", "Chore rotation"); return; }
      tsChoreEditor({ sync, members, onSave });
    });
    return;
  }

  const today = TS.today();
  el.innerHTML =
    '<div class="chores-card">' +
      '<div class="chores-head"><b>🧹 This week\'s chores</b>' +
        '<button class="chores-edit" id="btn-chores-edit">Edit</button></div>' +
      '<div class="chore-rows">' +
        chores.map(c => {
          const uid = tsChoreTurn(c, members, today);
          const who = members.find(m => m.uid === uid) || { name: "?" };
          const mine = uid === me.uid;
          const nextUid = tsChoreTurn(c, members, TS.addDays(today, 7));
          const next = members.find(m => m.uid === nextUid) || { name: "?" };
          return '<div class="chore-row' + (mine ? " mine" : "") + '">' +
            '<span class="ic">' + (c.icon || "🧽") + "</span>" +
            '<span class="nm"><b>' + tsEsc(c.name) + "</b>" +
              '<span>next week: ' + tsEsc(next.name) + "</span></span>" +
            '<span class="whose">' + tsAvatar(who, 26) +
              "<span>" + (mine ? "You" : tsEsc(who.name.split(" ")[0])) + "</span></span>" +
          "</div>";
        }).join("") +
      "</div>" +
    "</div>";
  document.getElementById("btn-chores-edit").addEventListener("click", () => {
    if (!pro) { tsPaywall("Chore rotation keeps the peace", "Chore rotation"); return; }
    tsChoreEditor({ sync, members, onSave });
  });

  /* announce the rotation in chat once a week */
  maybePostRotation(sync, members, chores);
};

async function maybePostRotation(sync, members, chores) {
  const wk = tsWeekIndex(TS.today());
  const posted = (sync.chores && sync.chores.lastPostedWeek) || 0;
  if (posted >= wk) return;
  const lines = chores.map(c => {
    const uid = tsChoreTurn(c, members, TS.today());
    const who = members.find(m => m.uid === uid);
    return (c.icon || "🧽") + " " + c.name + " - " + (who ? who.name : "?");
  });
  try {
    await Store.setChores({ list: chores, lastPostedWeek: wk });
    await Store.sendMessage("🧹 This week's chores:\n" + lines.join("\n"));
  } catch (e) { /* not fatal */ }
}

/* ---------- chore editor ---------- */
window.tsChoreEditor = ({ sync, members, onSave }) => {
  let list = JSON.parse(JSON.stringify((sync.chores && sync.chores.list) || []));
  const veil = document.createElement("div");
  veil.className = "modal-veil";
  veil.innerHTML =
    '<div class="modal">' +
      '<div class="modal-head"><div class="t"><b>Chore rotation</b>' +
        "<span>Rotates every week through everyone in the sync.</span></div>" +
        '<button class="modal-x" id="ce-close">✕</button></div>' +
      '<div class="modal-body"><div id="ce-list" style="display:flex;flex-direction:column;gap:10px;"></div>' +
        '<button class="btn btn--ghost btn--block" id="ce-add">+ Add a chore</button></div>' +
      '<div class="modal-foot"><div class="spacer" style="margin-left:0;width:100%;">' +
        '<button class="btn btn--ghost" id="ce-cancel" style="flex:1;">Cancel</button>' +
        '<button class="btn btn--primary" id="ce-save" style="flex:1;">Save</button></div></div>' +
    "</div>";
  document.body.appendChild(veil);
  requestAnimationFrame(() => veil.classList.add("open"));

  function paint() {
    const box = veil.querySelector("#ce-list");
    box.innerHTML = "";
    if (!list.length) {
      box.innerHTML = '<span style="font-size:14px;color:var(--faint);">No chores yet. Add trash, dishes, whatever keeps blowing up.</span>';
    }
    list.forEach((c, i) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:center;";
      row.innerHTML =
        '<input class="input icon-custom" style="width:52px;flex:none;" maxlength="4" value="' + tsEsc(c.icon || "🧽") + '">' +
        '<input class="input" style="flex:1;" maxlength="40" placeholder="Take out trash" value="' + tsEsc(c.name || "") + '">' +
        '<button class="modal-x" title="Remove">✕</button>';
      const [iconIn, nameIn, del] = row.children;
      iconIn.addEventListener("input", () => { list[i].icon = iconIn.value.trim() || "🧽"; });
      nameIn.addEventListener("input", () => { list[i].name = nameIn.value; });
      del.addEventListener("click", () => { list.splice(i, 1); paint(); });
      box.appendChild(row);
    });
  }
  paint();

  veil.querySelector("#ce-add").addEventListener("click", () => {
    list.push({ name: "", icon: "🧽", startWeek: tsWeekIndex(TS.today()), order: members.map(m => m.uid) });
    paint();
  });
  const close = () => { veil.classList.remove("open"); setTimeout(() => veil.remove(), 220); };
  veil.querySelector("#ce-close").addEventListener("click", close);
  veil.querySelector("#ce-cancel").addEventListener("click", close);
  veil.addEventListener("click", (e) => { if (e.target === veil) close(); });
  veil.querySelector("#ce-save").addEventListener("click", async () => {
    const clean = list.filter(c => (c.name || "").trim()).map((c, i) => ({
      name: c.name.trim(), icon: c.icon || "🧽",
      startWeek: c.startWeek || tsWeekIndex(TS.today()),
      offset: i,
      order: c.order && c.order.length ? c.order : members.map(m => m.uid)
    }));
    await Store.setChores({ list: clean, lastPostedWeek: 0 });
    close();
    tsToast(clean.length ? "Chores saved" : "Chores cleared");
    if (onSave) onSave();
  });
};

/* ============================================================
   WEEKLY RECAP CARD - drawn to canvas, saveable / shareable
   ============================================================ */
window.tsRecap = async (data) => {
  const { sync, members, stats, me } = data;
  if (!TSPlan.isPro(me)) { tsPaywall("Get your week as a shareable card", "Weekly recap"); return; }

  const W = 1080, H = 1350;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  const theme = TS_THEMES[sync.theme || "lavender"] || TS_THEMES.lavender;

  /* background */
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, theme.primary);
  g.addColorStop(1, theme.deep);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = "rgba(255,255,255,.08)";
  x.beginPath(); x.arc(W * 0.85, H * 0.12, 260, 0, Math.PI * 2); x.fill();
  x.beginPath(); x.arc(W * 0.1, H * 0.9, 300, 0, Math.PI * 2); x.fill();

  const card = { x: 70, y: 250, w: W - 140, h: H - 430, r: 56 };
  x.fillStyle = "#FFFFFF";
  roundRect(x, card.x, card.y, card.w, card.h, card.r); x.fill();

  /* header */
  x.fillStyle = "rgba(255,255,255,.9)";
  x.font = "600 34px Outfit, sans-serif";
  x.textAlign = "center";
  x.fillText("TOOSYNCED - WEEK RECAP", W / 2, 130);
  x.fillStyle = "#FFFFFF";
  x.font = "800 64px Outfit, sans-serif";
  x.fillText(trunc(x, sync.name, W - 200), W / 2, 205);

  /* big stat */
  let y = card.y + 130;
  x.fillStyle = theme.deep;
  x.font = "800 150px Outfit, sans-serif";
  x.fillText(String(stats.done), W / 2, y);
  x.fillStyle = "#6B6180";
  x.font = "500 36px Outfit, sans-serif";
  x.fillText("things checked off together", W / 2, y + 58);

  /* streak + rate */
  y += 160;
  drawPill(x, W / 2 - 250, y, 240, 96, theme.chipBg, "🔥 " + stats.streak, "day streak", theme.deep);
  drawPill(x, W / 2 + 10, y, 240, 96, theme.chipBg, stats.rate + "%", "kept", theme.deep);

  /* per-person bars */
  y += 170;
  x.textAlign = "left";
  x.fillStyle = "#1E1630";
  x.font = "700 38px Outfit, sans-serif";
  x.fillText("Who showed up", card.x + 60, y);
  y += 40;
  const top = stats.people.slice(0, 4);
  const maxDone = Math.max(1, ...top.map(p => p.done));
  top.forEach(p => {
    y += 72;
    x.fillStyle = "#1E1630";
    x.font = "600 32px Outfit, sans-serif";
    x.fillText(trunc(x, p.name, 260), card.x + 60, y);
    const bx = card.x + 340, bw = card.w - 460;
    x.fillStyle = "#F1EBFC";
    roundRect(x, bx, y - 26, bw, 30, 15); x.fill();
    x.fillStyle = p.color || theme.primary;
    roundRect(x, bx, y - 26, Math.max(30, bw * (p.done / maxDone)), 30, 15); x.fill();
    x.fillStyle = "#6B6180";
    x.font = "600 28px Outfit, sans-serif";
    x.textAlign = "right";
    x.fillText(String(p.done), card.x + card.w - 60, y);
    x.textAlign = "left";
  });

  /* fun line */
  y += 96;
  x.fillStyle = theme.chipBg;
  roundRect(x, card.x + 50, y - 46, card.w - 100, 110, 28); x.fill();
  x.fillStyle = theme.deep;
  x.font = "600 30px Outfit, sans-serif";
  x.textAlign = "center";
  wrapText(x, stats.funLine, W / 2, y, card.w - 160, 40);

  /* footer mark */
  x.fillStyle = "rgba(255,255,255,.85)";
  x.font = "600 32px Outfit, sans-serif";
  x.fillText("toosynced.com", W / 2, H - 90);

  const blob = await new Promise(res => c.toBlob(res, "image/png"));
  const file = new File([blob], "toosynced-week.png", { type: "image/png" });

  /* share sheet on mobile, download everywhere else */
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: "Our week on TooSynced 💜" });
      return;
    } catch (e) { /* cancelled - fall through to download */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "toosynced-week.png"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  tsToast("Recap saved to your downloads");
};

function roundRect(x, X, Y, w, h, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}
function drawPill(x, X, Y, w, h, bg, big, small, ink) {
  x.fillStyle = bg; roundRect(x, X, Y, w, h, 28); x.fill();
  x.textAlign = "center";
  x.fillStyle = ink; x.font = "800 42px Outfit, sans-serif";
  x.fillText(big, X + w / 2, Y + 46);
  x.fillStyle = "#6B6180"; x.font = "500 24px Outfit, sans-serif";
  x.fillText(small, X + w / 2, Y + 78);
}
function trunc(x, s, max) {
  s = s || "";
  if (x.measureText(s).width <= max) return s;
  while (s.length && x.measureText(s + "...").width > max) s = s.slice(0, -1);
  return s + "...";
}
function wrapText(x, text, cx, cy, maxW, lh) {
  const words = (text || "").split(" ");
  const lines = [];
  let line = "";
  words.forEach(w => {
    const test = line ? line + " " + w : w;
    if (x.measureText(test).width > maxW && line) { lines.push(line); line = w; }
    else line = test;
  });
  if (line) lines.push(line);
  lines.slice(0, 2).forEach((l, i) => x.fillText(l, cx, cy + i * lh));
}
