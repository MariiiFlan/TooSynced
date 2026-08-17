/* ============================================================
   TooSynced - auth page (index.html)
   Email + Google + Phone (SMS code) sign-in, sign-up with
   optional phone number, ?join=CODE deep links.
   ============================================================ */
(function () {
  let mode = "signin";   // signin | signup
  let method = "email";  // email | phone
  const $ = (s) => document.querySelector(s);
  const joinCode = new URLSearchParams(location.search).get("join");

  function setMode(m) {
    mode = m;
    $("#f-name").classList.toggle("hidden", m === "signin");
    $("#fp-name").classList.toggle("hidden", m === "signin");
    $("#f-phone-opt").classList.toggle("hidden", m === "signin");
    $("#btn-email").textContent = m === "signin" ? "Continue with email" : "Create account";
    /* the big create-account CTA only makes sense while signing in */
    $("#create-row").classList.toggle("hidden", m === "signup");
    $("#auth-switch-top").innerHTML = m === "signin"
      ? 'First time? <a href="#" id="switch-mode-link">Create an account</a>'
      : 'Have an account? <a href="#" id="switch-mode-link">Sign in</a>';
    $("#switch-mode-link").addEventListener("click", (e) => {
      e.preventDefault(); setMode(mode === "signin" ? "signup" : "signin");
    });
  }

  function setMethod(m) {
    method = m;
    document.querySelectorAll("#method-seg span").forEach(x =>
      x.classList.toggle("on", x.dataset.method === m));
    $("#method-email").classList.toggle("hidden", m !== "email");
    $("#method-phone").classList.toggle("hidden", m !== "phone");
  }

  function showError(msg) {
    const el = $("#auth-error");
    el.textContent = msg; el.classList.remove("hidden");
  }
  function clearError() { $("#auth-error").classList.add("hidden"); }

  function next() {
    location.href = joinCode ? ("invite.html?join=" + encodeURIComponent(joinCode)) : "syncs.html";
  }

  /* ---------- interactive preview card ---------- */
  function buildPreviewViews() {
    const wk = $("#pview-week");
    const days = ["S","M","T","W","T","F","S"];
    const states = [
      ["d","d","u"], ["d","d","d"], ["d","m","u"], ["d","d","u"],
      ["d","u","u"], ["d","d","m"], ["u","u","u"]
    ];
    const colors = { d:"#DDF3E7", m:"#FBE8D2", u:"#EFEAF9" };
    wk.innerHTML = states.map((col, i) =>
      '<div class="pcol"><span>' + days[i] + "</span>" +
      col.map(s => '<i style="background:' + colors[s] + ';"></i>').join("") +
      "</div>"
    ).join("");

    const mo = $("#pview-month");
    let seed = 7, cells = "";
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let i = 0; i < 35; i++) {
      const r = rnd();
      const bg = r > .72 ? "#C9B4FA" : r > .45 ? "#DDF3E7" : r > .3 ? "#FBE8D2" : "#F4F1FA";
      cells += '<i style="background:' + bg + ';"></i>';
    }
    mo.innerHTML = cells;

    const order = ["day","week","month"];
    let cur = "day";
    document.querySelectorAll("#preview-seg span").forEach(tab => {
      tab.addEventListener("click", () => {
        if (tab.dataset.pview === cur) return;
        const forward = order.indexOf(tab.dataset.pview) > order.indexOf(cur);
        cur = tab.dataset.pview;
        document.querySelectorAll("#preview-seg span").forEach(x => x.classList.toggle("on", x === tab));
        order.forEach(v => $("#pview-" + v).classList.toggle("hidden", v !== cur));
        const el = $("#pview-" + cur);
        el.style.setProperty("--in-x", forward ? "22px" : "-22px");
        el.classList.remove("view-in"); void el.offsetWidth; el.classList.add("view-in");
        $("#preview-title").textContent =
          cur === "day" ? "Your crew today" :
          cur === "week" ? "Your crew this week" : "Your month together";
      });
    });
  }

  async function start() {
    await Store.init();
    tsAurora();
    buildPreviewViews();

    if (CONFIG.DEMO_MODE) {
      $("#demo-hint").innerHTML = "Demo mode is on - any email or phone works, nothing is sent anywhere.";
    }
    if (joinCode) {
      $("#hero-title").innerHTML = "You've been<br><span>invited</span>.";
      $("#live-pill-text").textContent = "Invite code " + joinCode.toUpperCase() + " ready to join";
      setMode("signup");
    } else {
      setMode("signin");
    }
    setMethod("email");

    document.querySelectorAll("#method-seg span").forEach(t =>
      t.addEventListener("click", () => { clearError(); setMethod(t.dataset.method); }));

    $("#btn-create-account").addEventListener("click", () => {
      clearError();
      setMode("signup");
      (method === "email" ? $("#f-name") : $("#fp-name")).focus();
    });

    /* already signed in? skip ahead */
    Store.onAuth(async (user) => {
      if (user) {
        if (joinCode) { next(); return; }
        const sync = await Store.getSync();
        location.href = sync ? "app.html" : "syncs.html";
      }
    });

    /* ----- email ----- */
    $("#auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (method !== "email") return;
      clearError();
      const name = $("#f-name").value.trim();
      const email = $("#f-email").value.trim();
      const pass = $("#f-pass").value;
      const phone = $("#f-phone-opt").value.trim();
      if (!email || !pass) { showError("Email and password, then you're in."); return; }
      if (mode === "signup" && !name && !CONFIG.DEMO_MODE) { showError("What should we call you?"); return; }
      $("#btn-email").disabled = true;
      try {
        if (mode === "signup") await Store.signUpEmail(name || email.split("@")[0], email, pass, phone);
        else await Store.signInEmail(email, pass);
        next();
      } catch (err) {
        showError(friendly(err));
        $("#btn-email").disabled = false;
      }
    });

    $("#btn-google").addEventListener("click", async () => {
      clearError();
      try { await Store.signInGoogle(); next(); }
      catch (err) { showError(friendly(err)); }
    });

    /* ----- phone ----- */
    $("#btn-send-code").addEventListener("click", async () => {
      clearError();
      const phone = $("#fp-phone").value;
      const btn = $("#btn-send-code");
      btn.disabled = true; btn.textContent = "Sending…";
      try {
        await Store.startPhoneSignIn(phone, "btn-send-code");
        $("#code-step").classList.remove("hidden");
        btn.textContent = "Code sent - resend";
        btn.disabled = false;
        $("#fp-code").focus();
      } catch (err) {
        showError(friendly(err));
        btn.textContent = "Text me a code";
        btn.disabled = false;
      }
    });

    $("#btn-confirm-code").addEventListener("click", async () => {
      clearError();
      const code = $("#fp-code").value.trim();
      const name = $("#fp-name").value.trim();
      if (code.length < 6) { showError("Enter the 6-digit code from the text."); return; }
      $("#btn-confirm-code").disabled = true;
      try {
        await Store.confirmPhoneCode(code, name || "You");
        next();
      } catch (err) {
        showError(friendly(err));
        $("#btn-confirm-code").disabled = false;
      }
    });
  }

  function friendly(err) {
    const code = (err && err.code) || "";
    if (code.includes("user-not-found") || code.includes("invalid-credential")) return "That email and password don't match. Try again, or create an account.";
    if (code.includes("email-already-in-use")) return "That email already has an account - sign in instead.";
    if (code.includes("weak-password")) return "Password needs at least 6 characters.";
    if (code.includes("invalid-email")) return "That doesn't look like an email address.";
    if (code.includes("invalid-phone-number")) return "That phone number didn't go through - try the format +1 951 555 0134.";
    if (code.includes("invalid-verification-code")) return "That code didn't match. Check the text and try again.";
    if (code.includes("code-expired")) return "That code expired - tap resend for a new one.";
    if (code.includes("too-many-requests")) return "Too many tries - give it a few minutes.";
    if (code.includes("quota-exceeded")) return "SMS limit hit for today (Firebase free tier is 10/day). Use email for now.";
    return err.message || "Something went wrong. Try again.";
  }

  start();
})();
