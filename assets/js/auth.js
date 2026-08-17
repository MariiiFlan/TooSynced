/* ============================================================
   TooSynced — auth page (index.html)
   Handles: sign in / create account toggle, Google, demo mode,
   and ?join=CODE deep links from invite URLs.
   ============================================================ */
(function () {
  let mode = "signin"; // or "signup"
  const $ = (s) => document.querySelector(s);
  const joinCode = new URLSearchParams(location.search).get("join");

  function setMode(m) {
    mode = m;
    $("#f-name").classList.toggle("hidden", m === "signin");
    $("#btn-email").textContent = m === "signin" ? "Continue with email" : "Create account";
    $("#auth-switch-top").innerHTML = m === "signin"
      ? 'New here? <a href="#" id="switch-mode-link">Create a pair</a>'
      : 'Have an account? <a href="#" id="switch-mode-link">Sign in</a>';
    $("#switch-mode-link").addEventListener("click", (e) => {
      e.preventDefault(); setMode(mode === "signin" ? "signup" : "signin");
    });
  }

  function showError(msg) {
    const el = $("#auth-error");
    el.textContent = msg; el.classList.remove("hidden");
  }

  function next() {
    location.href = joinCode ? ("pair.html?join=" + encodeURIComponent(joinCode)) : "pair.html";
  }

  async function start() {
    await Store.init();

    if (CONFIG.DEMO_MODE) {
      $("#demo-hint").innerHTML = "Demo mode is on — any email works, nothing is sent anywhere.";
    }
    if (joinCode) {
      $("#hero-title").innerHTML = "Your person<br>invited <span>you</span>.";
      $("#live-pill-text").textContent = "Invite code " + joinCode.toUpperCase() + " ready to join";
      setMode("signup");
    } else {
      setMode("signin");
    }

    /* already signed in? skip ahead */
    Store.onAuth(async (user) => {
      if (user) {
        const pair = await Store.getPair();
        if (joinCode) next();
        else if (pair && pair.joined) location.href = "app.html";
        else if (pair) location.href = "pair.html";
        /* signed in but no pair and no code: stay, they may want a fresh start */
      }
    });

    $("#auth-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      $("#auth-error").classList.add("hidden");
      const name = $("#f-name").value.trim();
      const email = $("#f-email").value.trim();
      const pass = $("#f-pass").value;
      if (mode === "signup" && !name && !CONFIG.DEMO_MODE) { showError("What should we call you?"); return; }
      $("#btn-email").disabled = true;
      try {
        if (mode === "signup") await Store.signUpEmail(name || email.split("@")[0], email, pass);
        else await Store.signInEmail(email, pass);
        next();
      } catch (err) {
        showError(friendly(err));
        $("#btn-email").disabled = false;
      }
    });

    $("#btn-google").addEventListener("click", async () => {
      $("#auth-error").classList.add("hidden");
      try { await Store.signInGoogle(); next(); }
      catch (err) { showError(friendly(err)); }
    });
  }

  function friendly(err) {
    const code = (err && err.code) || "";
    if (code.includes("user-not-found") || code.includes("invalid-credential")) return "That email and password don't match. Try again, or create an account.";
    if (code.includes("email-already-in-use")) return "That email already has an account — sign in instead.";
    if (code.includes("weak-password")) return "Password needs at least 6 characters.";
    if (code.includes("invalid-email")) return "That doesn't look like an email address.";
    return err.message || "Something went wrong. Try again.";
  }

  start();
})();
