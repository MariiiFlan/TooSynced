/* ============================================================
   TooSynced - Syncling UI
   The card on the schedule, the request flow, and the wardrobe.
   ============================================================ */

const TSSyncUI = (() => {
  let ctx = null;   // { me, sync, members, synclings, streak, bestStreak, isPro, today, state }

  function alive() { return (ctx.synclings || []).filter(s => !TSSync.isLost(s)); }

  /* ---------- the card on the schedule ---------- */
  function render(mount, c) {
    ctx = c;
    const el = document.querySelector(mount);
    if (!el) return;

    const list = alive();
    const req = TSSync.canRequest(ctx.synclings, ctx.streak);

    if (!list.length) {
      el.innerHTML = emptyCard(req);
      wireEmpty(el, req);
      return;
    }

    const cards = list
      .slice()
      .sort((a, b) => (a.bornStreak || 0) - (b.bornStreak || 0))
      .map(sl => oneCard(sl))
      .join("");

    const addable = req.ok;
    el.innerHTML =
      '<div class="sl-card">' +
        '<div class="sl-head">' +
          "<b>" + (list.length > 1 ? "Your Synclings" : "Your Syncling") + "</b>" +
          (addable
            ? '<button class="sl-add" id="sl-add">+ Hatch another</button>'
            : '<span class="sl-hint">' + nextHint(req) + "</span>") +
        "</div>" +
        '<div class="sl-row">' + cards + "</div>" +
      "</div>";

    el.querySelectorAll("[data-sl]").forEach(b =>
      b.addEventListener("click", () => openSheet(b.dataset.sl)));
    const add = el.querySelector("#sl-add");
    if (add) add.addEventListener("click", () => openRequest());
  }

  function nextHint(req) {
    if (req.reason === "max") return "3 is the most you can raise";
    if (req.reason === "streak") return "Next one at " + req.need + " days";
    return "";
  }

  function oneCard(sl) {
    const days = TSSync.ageOf(sl, ctx.streak);
    const stage = TSSync.stageFor(days);
    const fading = TSSync.isFading(sl);
    const mood = TSSync.moodFor({
      mineDone: ctx.state.mineDone,
      theirsDone: ctx.state.theirsDone,
      anyMissed: ctx.state.anyMissed,
      fading,
      hour: new Date().getHours()
    });
    const left = fading ? TSSync.hoursLeft(sl) : null;

    return '<button class="sl-one' + (fading ? " is-fading" : "") + '" data-sl="' + sl.id + '">' +
      '<div class="sl-art">' + TSSync.draw(sl, { size: 92, days, stage: stage.key, mood }) + "</div>" +
      '<div class="sl-name">' + tsEsc(sl.name || "Syncling") + "</div>" +
      '<div class="sl-meta">' +
        (fading
          ? '<span class="sl-warn">Fading · ' + Math.ceil(left) + "h left</span>"
          : stage.label + " · day " + days) +
      "</div></button>";
  }

  function emptyCard(req) {
    if (!req.ok) {
      const need = req.need || TSSync.UNLOCK_AT[0];
      return '<div class="sl-card sl-empty">' +
        '<div class="sl-egg">' + TSSync.draw({ color: "violet" }, { size: 76, stage: "egg", still: true }) + "</div>" +
        "<div><b>Raise a Syncling</b>" +
        "<p>Keep a " + need + " day streak together and you can hatch one. " +
        "It grows with your streak - and it does not survive a break.</p></div></div>";
    }
    return '<div class="sl-card sl-empty">' +
      '<div class="sl-egg">' + TSSync.draw({ color: "violet" }, { size: 76, stage: "egg", still: true }) + "</div>" +
      "<div><b>You can hatch a Syncling</b>" +
      "<p>You have kept this going " + ctx.streak + " days. Time to raise something.</p>" +
      '<button class="btn btn--primary" id="sl-start">Hatch one</button></div></div>';
  }

  function wireEmpty(el, req) {
    const b = el.querySelector("#sl-start");
    if (b) b.addEventListener("click", () => openRequest());
  }

  /* ---------- request / naming ---------- */
  function openRequest() {
    const req = TSSync.canRequest(ctx.synclings, ctx.streak);
    if (!req.ok) {
      tsToast(req.reason === "max"
        ? "Three is the most you can raise at once"
        : "Get to " + req.need + " days first");
      return;
    }
    let color = TSSync.COLORS[0].id;
    let name = "";

    const veil = document.createElement("div");
    veil.className = "modal-veil";
    veil.innerHTML =
      '<div class="modal sl-modal">' +
        '<div class="modal-head"><div class="t"><b>Hatch a Syncling</b>' +
          "<span>It grows with your streak. Everyone in the sync sees it.</span></div>" +
          '<button class="modal-x" id="sl-x">✕</button></div>' +
        '<div class="modal-body">' +
          '<div class="sl-preview" id="sl-prev"></div>' +
          '<div class="field"><label for="sl-name">Name</label>' +
            '<input class="input" id="sl-name" maxlength="16" placeholder="Momo" autocomplete="off"></div>' +
          '<div class="field"><label>Colour</label><div class="sl-colors" id="sl-colors"></div></div>' +
        "</div>" +
        '<div class="modal-foot"><div class="spacer" style="margin-left:0;width:100%;">' +
          '<button class="btn btn--ghost" id="sl-cancel" style="flex:1;">Cancel</button>' +
          '<button class="btn btn--primary" id="sl-go" style="flex:1;">Hatch</button>' +
        "</div></div></div>";
    document.body.appendChild(veil);
    requestAnimationFrame(() => veil.classList.add("open"));

    const paint = () => {
      veil.querySelector("#sl-prev").innerHTML =
        TSSync.draw({ color }, { size: 132, days: 0, stage: "egg", still: true });
      veil.querySelectorAll(".sl-color").forEach(x =>
        x.classList.toggle("on", x.dataset.c === color));
    };
    veil.querySelector("#sl-colors").innerHTML = TSSync.COLORS.map(c =>
      '<button class="sl-color" data-c="' + c.id + '" title="' + c.name +
      '" style="background:' + c.body + '"></button>').join("");
    veil.querySelectorAll(".sl-color").forEach(b =>
      b.addEventListener("click", () => { color = b.dataset.c; paint(); }));
    paint();

    const close = () => { veil.classList.remove("open"); setTimeout(() => veil.remove(), 220); };
    veil.querySelector("#sl-x").addEventListener("click", close);
    veil.querySelector("#sl-cancel").addEventListener("click", close);
    veil.addEventListener("click", e => { if (e.target === veil) close(); });

    veil.querySelector("#sl-go").addEventListener("click", async () => {
      name = veil.querySelector("#sl-name").value.trim();
      if (!name) { tsToast("Give it a name"); veil.querySelector("#sl-name").focus(); return; }
      await Store.addSyncling({
        name, color, acc: [],
        bornStreak: ctx.streak,          // its age is measured from here
        by: ctx.me.uid
      });
      close();
      tsChime();
      tsToast(name + " is on the way 🥚");
    });
  }

  /* ---------- detail sheet ---------- */
  function openSheet(id) {
    const sl = (ctx.synclings || []).find(s => s.id === id);
    if (!sl) return;
    const days = TSSync.ageOf(sl, ctx.streak);
    const stage = TSSync.stageFor(days);
    const fading = TSSync.isFading(sl);
    const left = fading ? TSSync.hoursLeft(sl) : null;
    const nextStage = TSSync.STAGES.find(x => x.from > days);

    const veil = document.createElement("div");
    veil.className = "modal-veil";
    veil.innerHTML =
      '<div class="modal sl-modal">' +
        '<div class="modal-head"><div class="t"><b>' + tsEsc(sl.name) + "</b>" +
          "<span>" + stage.label + " · day " + days + "</span></div>" +
          '<button class="modal-x" id="sl-x">✕</button></div>' +
        '<div class="modal-body">' +
          '<div class="sl-preview">' +
            TSSync.draw(sl, { size: 150, days, stage: stage.key,
              mood: fading ? "fading" : "happy" }) + "</div>" +
          (fading
            ? '<div class="sl-fade-note"><b>' + tsEsc(sl.name) + " is fading</b>" +
              "<span>" + Math.ceil(left) + " hours left. Restoring the streak brings them back.</span></div>"
            : nextStage
              ? '<div class="sl-next">Next stage at <b>day ' + nextStage.from + "</b> · " +
                (nextStage.from - days) + " to go</div>"
              : '<div class="sl-next">Fully grown. Keep going for rarer accessories.</div>') +
        "</div>" +
        '<div class="modal-foot"><div class="spacer" style="margin-left:0;width:100%;">' +
          '<button class="btn btn--ghost" id="sl-close2" style="flex:1;">Close</button>' +
          '<button class="btn btn--primary" id="sl-wardrobe" style="flex:1;">Wardrobe</button>' +
        "</div></div></div>";
    document.body.appendChild(veil);
    requestAnimationFrame(() => veil.classList.add("open"));
    const close = () => { veil.classList.remove("open"); setTimeout(() => veil.remove(), 220); };
    veil.querySelector("#sl-x").addEventListener("click", close);
    veil.querySelector("#sl-close2").addEventListener("click", close);
    veil.addEventListener("click", e => { if (e.target === veil) close(); });
    veil.querySelector("#sl-wardrobe").addEventListener("click", () => {
      close();
      openWardrobe(sl.id);
    });
  }

  /* ---------- wardrobe ---------- */
  function openWardrobe(id) {
    const sl = (ctx.synclings || []).find(s => s.id === id);
    if (!sl) return;
    let equipped = (sl.acc || []).slice();
    let cat = "Headwear";
    const cats = [];
    TS_ITEMS.forEach(i => { if (!cats.includes(i.cat)) cats.push(i.cat); });

    const veil = document.createElement("div");
    veil.className = "modal-veil sl-wardrobe-veil";
    veil.innerHTML =
      '<div class="modal sl-wardrobe">' +
        '<div class="modal-head"><div class="t"><b>Wardrobe</b>' +
          '<span id="wd-sub"></span></div>' +
          '<button class="modal-x" id="wd-x">✕</button></div>' +
        '<div class="wd-stage"><div id="wd-prev"></div>' +
          '<div class="wd-slots" id="wd-slots"></div></div>' +
        '<div class="wd-tabs" id="wd-tabs"></div>' +
        '<div class="modal-body wd-body"><div class="wd-grid" id="wd-grid"></div></div>' +
        '<div class="modal-foot"><div class="spacer" style="margin-left:0;width:100%;">' +
          '<button class="btn btn--ghost" id="wd-cancel" style="flex:1;">Cancel</button>' +
          '<button class="btn btn--primary" id="wd-save" style="flex:1;">Save</button>' +
        "</div></div></div>";
    document.body.appendChild(veil);
    requestAnimationFrame(() => veil.classList.add("open"));

    const days = TSSync.ageOf(sl, ctx.streak);
    const realStage = TSSync.stageFor(days).key;
    /* an egg can't wear anything, but you should still be able to shop.
       Preview on a hatchling so the items are actually visible. */
    const stage = realStage === "egg" ? "hatch" : realStage;

    function paint() {
      veil.querySelector("#wd-prev").innerHTML =
        TSSync.draw({ ...sl, acc: equipped }, { size: 150, days, stage, mood: "happy", still: true });
      veil.querySelector("#wd-sub").textContent =
        (realStage === "egg" ? "Preview - hatches soon · " : "") +
        equipped.length + " of 3 equipped · " +
        TSSync.unlockedItems(ctx.bestStreak, ctx.isPro).length + " of " + TS_ITEMS.length + " unlocked";

      veil.querySelector("#wd-slots").innerHTML = [0, 1, 2].map(i => {
        const it = equipped[i] ? TS_ITEMS.find(x => x.id === equipped[i]) : null;
        return '<button class="wd-slot' + (it ? " filled" : "") + '" data-slot="' + i + '">' +
          (it ? TSSync.draw({ ...sl, acc: [it.id] }, { size: 44, days, stage, mood: "waiting", still: true })
              : "+") + "</button>";
      }).join("");
      veil.querySelectorAll(".wd-slot").forEach(b => b.addEventListener("click", () => {
        const i = Number(b.dataset.slot);
        if (equipped[i]) { equipped.splice(i, 1); paint(); }
      }));

      veil.querySelector("#wd-tabs").innerHTML = cats.map(c =>
        '<button class="wd-tab' + (c === cat ? " on" : "") + '" data-c="' + c + '">' + c + "</button>").join("");
      veil.querySelectorAll(".wd-tab").forEach(b =>
        b.addEventListener("click", () => { cat = b.dataset.c; paint(); }));

      veil.querySelector("#wd-grid").innerHTML = TS_ITEMS.filter(i => i.cat === cat).map(i => {
        const owned = TSSync.ownsItem(i, ctx.bestStreak, ctx.isPro);
        const on = equipped.includes(i.id);
        const locked = !owned;
        return '<button class="wd-tile' + (locked ? " locked" : "") + (on ? " on" : "") +
          (i.tier === "pro" ? " pro" : "") + '" data-i="' + i.id + '">' +
          '<div class="wd-art">' +
            TSSync.draw({ ...sl, acc: [i.id] }, { size: 84, days, stage, mood: "waiting", still: true }) +
          "</div>" +
          '<div class="wd-lbl">' + i.name + "</div>" +
          '<div class="wd-meta">' +
            (locked
              ? (i.tier === "pro" && i.day <= ctx.bestStreak ? "PRO" : "Day " + i.day)
              : (on ? "Equipped" : i.tier === "pro" ? "PRO" : "Owned")) +
          "</div>" +
          (locked ? '<div class="wd-lock">🔒</div>' : "") +
          "</button>";
      }).join("");

      veil.querySelectorAll(".wd-tile").forEach(b => b.addEventListener("click", () => {
        const it = TS_ITEMS.find(x => x.id === b.dataset.i);
        if (!TSSync.ownsItem(it, ctx.bestStreak, ctx.isPro)) {
          if (it.tier === "pro" && it.day <= ctx.bestStreak) {
            tsPaywall("Unlock " + it.name, "Your streak icon");
          } else {
            tsToast(it.name + " unlocks at day " + it.day);
          }
          return;
        }
        const i = equipped.indexOf(it.id);
        if (i >= 0) equipped.splice(i, 1);
        else {
          /* one per category keeps it readable */
          const clash = equipped.findIndex(id => {
            const e = TS_ITEMS.find(x => x.id === id);
            return e && e.cat === it.cat;
          });
          if (clash >= 0) equipped.splice(clash, 1);
          if (equipped.length >= 3) { tsToast("Three at a time - take one off first"); return; }
          equipped.push(it.id);
        }
        paint();
      }));
    }
    paint();

    const close = () => { veil.classList.remove("open"); setTimeout(() => veil.remove(), 220); };
    veil.querySelector("#wd-x").addEventListener("click", close);
    veil.querySelector("#wd-cancel").addEventListener("click", close);
    veil.querySelector("#wd-save").addEventListener("click", async () => {
      await Store.updateSyncling(sl.id, { acc: equipped });
      close();
      tsToast("Looking good 💜");
    });
  }

  return { render, openRequest, openWardrobe };
})();
