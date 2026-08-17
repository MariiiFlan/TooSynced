/* ============================================================
   TooSynced - sync chat
   ============================================================ */
(function () {
  const $ = (s) => document.querySelector(s);
  let me = null, sync = null, lastCount = 0;

  tsAurora();

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
      row.innerHTML =
        (mine ? "" : tsAvatar(person, 28)) +
        '<div><div class="bubble">' +
          (showWho ? '<div class="who">' + tsEsc(person.name) + "</div>" : "") +
          tsEsc(m.text) +
        "</div></div>" +
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
    if (nearBottom || lastCount === msgs.length) el.scrollTop = el.scrollHeight;
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
    $("#chat-scroll").scrollTop = $("#chat-scroll").scrollHeight;
  }

  $("#btn-send").addEventListener("click", send);
  $("#msg-input").addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
})();
