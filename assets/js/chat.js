/* ============================================================
   TooSynced - sync chat
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  let me = null, sync = null, lastCount = 0;

  tsAurora();
  tsBottomNav("chat.html");

  tsRequireSync((user, s) => {
    me = user; sync = s;
    const mem = (s.memberUids || []).map(u => ({ uid: u, ...(s.members[u] || { name: "?" }) }));
    mem.sort((a, b) => (a.uid === me.uid ? -1 : b.uid === me.uid ? 1 : 0));
    tsColorMembers(mem, me.uid);
    sync._colored = {}; mem.forEach(m => { sync._colored[m.uid] = m; });
    tsSyncSwitcher("#sync-switch", s);
    Store.watchMessages(render);
  });

  function render(msgs) {
    if (window.tsMarkChatRead) tsMarkChatRead();
    const el = $("#chat-scroll");
    if (!msgs || !msgs.length) {
      el.innerHTML = '<div class="chat-empty">No messages yet.<br>Say something to get everyone going.</div>';
      lastCount = 0;
      return;
    }
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    el.innerHTML = "";
    let lastFrom = null;
    msgs.forEach(m => {
      const mine = m.from === me.uid;
      const person = (sync._colored || {})[m.from] || (sync.members || {})[m.from] || { name: "Someone" };
      const row = document.createElement("div");
      row.className = "msg" + (mine ? " mine" : "");
      const showWho = !mine && sync.kind === "group" && lastFrom !== m.from;
      const reacts = m.reactions || {};
      const chips = Object.keys(reacts).filter(k => (reacts[k] || []).length).map(k =>
        '<button class="rx' + ((reacts[k] || []).includes(me.uid) ? " mine" : "") +
        '" data-m="' + m.id + '" data-e="' + k + '">' + k +
        '<span>' + reacts[k].length + "</span></button>").join("");

      row.innerHTML =
        (mine ? "" : tsAvatar(person, 28)) +
        '<div class="bwrap"><div class="bubble" data-m="' + m.id + '">' +
          (showWho ? '<div class="who">' + tsEsc(person.name) + "</div>" : "") +
          tsEsc(m.text) +
        "</div>" + (chips ? '<div class="rxs">' + chips + "</div>" : "") + "</div>" +
        '<span class="time">' + clock(m.at) + "</span>";
      el.appendChild(row);
      lastFrom = m.from;
    });
    /* chime when someone else's message lands while you're watching */
    if (lastCount && msgs.length > lastCount) {
      const latest = msgs[msgs.length - 1];
      if (latest.from !== me.uid) tsChime();
    }
    lastCount = msgs.length;
    wireReactions(el);
    if (nearBottom || lastCount === msgs.length) el.scrollTop = el.scrollHeight;
  }

  /* long-press (or right-click) a bubble to react */
  const RX = ["❤️", "😂", "🔥", "👏", "😭", "💀"];
  function wireReactions(el) {
    el.querySelectorAll(".bubble").forEach(b => {
      let timer = null;
      const open = (e) => { e.preventDefault(); openPicker(b, b.dataset.m); };
      b.addEventListener("contextmenu", open);
      b.addEventListener("touchstart", () => { timer = setTimeout(() => openPicker(b, b.dataset.m), 420); }, { passive: true });
      ["touchend", "touchmove", "touchcancel"].forEach(ev =>
        b.addEventListener(ev, () => clearTimeout(timer), { passive: true }));
      b.addEventListener("dblclick", () => Store.reactToMessage(b.dataset.m, "❤️"));
    });
    el.querySelectorAll(".rx").forEach(c => c.addEventListener("click", () => {
      const already = c.classList.contains("mine");
      Store.reactToMessage(c.dataset.m, already ? null : c.dataset.e);
    }));
  }

  function openPicker(anchor, msgId) {
    document.querySelectorAll(".rx-picker").forEach(x => x.remove());
    const box = document.createElement("div");
    box.className = "rx-picker";
    box.innerHTML = RX.map(e => '<button data-e="' + e + '">' + e + "</button>").join("");
    document.body.appendChild(box);
    const r = anchor.getBoundingClientRect();
    const w = RX.length * 42 + 12;
    box.style.left = Math.max(10, Math.min(window.innerWidth - w - 10, r.left)) + "px";
    box.style.top = Math.max(10, r.top - 54) + "px";
    box.querySelectorAll("button").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation();
      Store.reactToMessage(msgId, b.dataset.e);
      box.remove();
    }));
    setTimeout(() => document.addEventListener("click", function c() {
      box.remove(); document.removeEventListener("click", c);
    }), 0);
  }

  function clock(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  async function send() {
    const input = $("#msg-input");
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    await Store.sendMessage(text);
    if (typeof TSPush !== "undefined") {
      TSPush.sendToSync(sync, me.name || "New message", text,
                        { syncId: sync.id, page: "chat.html" });
    }
    $("#chat-scroll").scrollTop = $("#chat-scroll").scrollHeight;
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && window.tsMarkChatRead) tsMarkChatRead();
  });
  $("#btn-send").addEventListener("click", send);
  $("#msg-input").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
})();
