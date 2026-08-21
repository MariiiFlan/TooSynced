/* ============================================================
   TooSynced - Synclings
   A creature the sync raises together. It grows with the streak,
   reacts to today, fades when the streak breaks, and can be
   restored inside a 48 hour window.
   ============================================================ */

const TSSync = (() => {

  /* ---------- stages ---------- */
  const STAGES = [
    { key: "egg",    from: 0,  label: "Egg" },
    { key: "hatch",  from: 3,  label: "Hatchling" },
    { key: "young",  from: 10, label: "Young" },
    { key: "grown",  from: 30, label: "Grown" }
  ];

  function stageFor(days) {
    let s = STAGES[0];
    STAGES.forEach(x => { if (days >= x.from) s = x; });
    return s;
  }

  /* days this creature has been alive, capped by the current streak */
  function ageOf(sl, streak) {
    if (!sl) return 0;
    const born = sl.bornStreak || 0;
    return Math.max(0, streak - born);
  }

  /* ---------- palette ---------- */
  const COLORS = [
    { id: "violet", body: "#8B5CF6", dark: "#6D28D9", name: "Violet" },
    { id: "sky",    body: "#5B9BF9", dark: "#2F6FD0", name: "Sky" },
    { id: "mint",   body: "#3FBF8F", dark: "#1F8A5B", name: "Mint" },
    { id: "peach",  body: "#F0A050", dark: "#C77A22", name: "Peach" },
    { id: "rose",   body: "#EE6FA8", dark: "#C2377A", name: "Rose" },
    { id: "slate",  body: "#7C8AA5", dark: "#4A566B", name: "Slate" },
    { id: "butter", body: "#EFC75E", dark: "#C79A22", name: "Butter" },
    { id: "cocoa",  body: "#B07A55", dark: "#7A4E33", name: "Cocoa" }
  ];
  function colorOf(id) { return COLORS.find(c => c.id === id) || COLORS[0]; }

  /* ---------- moods ----------
     Drawn from what is actually happening today, not the streak. */
  const MOODS = {
    happy:   { eyes: "smile",  mouth: "grin",  bounce: true  },
    proud:   { eyes: "star",   mouth: "grin",  bounce: true  },
    waiting: { eyes: "open",   mouth: "flat",  bounce: false },
    worried: { eyes: "worry",  mouth: "small", bounce: false },
    asleep:  { eyes: "closed", mouth: "flat",  bounce: false },
    fading:  { eyes: "sad",    mouth: "frown", bounce: false }
  };

  function moodFor({ mineDone, theirsDone, anyMissed, fading, hour }) {
    if (fading) return "fading";
    if (hour != null && (hour < 6 || hour >= 23)) return "asleep";
    if (mineDone && theirsDone) return "proud";
    if (anyMissed) return "worried";
    if (mineDone || theirsDone) return "happy";
    return "waiting";
  }

  /* ---------- the drawing ---------- */
  function face(mood, scale) {
    const m = MOODS[mood] || MOODS.waiting;
    const ink = "#241a3d";
    let eyes = "";
    if (m.eyes === "closed") {
      eyes = '<path d="M36 50q5 4 10 0M54 50q5 4 10 0" stroke="' + ink +
             '" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    } else if (m.eyes === "star") {
      eyes = '<path d="m41 44 1.9 4 4.4.5-3.2 3 .8 4.4-3.9-2.2-3.9 2.2.8-4.4-3.2-3 4.4-.5z" fill="' + ink + '"/>' +
             '<path d="m59 44 1.9 4 4.4.5-3.2 3 .8 4.4-3.9-2.2-3.9 2.2.8-4.4-3.2-3 4.4-.5z" fill="' + ink + '"/>';
    } else if (m.eyes === "worry") {
      eyes = '<circle cx="41" cy="51" r="4.2" fill="' + ink + '"/><circle cx="59" cy="51" r="4.2" fill="' + ink + '"/>' +
             '<path d="M35 43q6-3 11 0M54 43q5-3 11 0" stroke="' + ink + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
    } else if (m.eyes === "sad") {
      eyes = '<circle cx="41" cy="52" r="3.6" fill="' + ink + '"/><circle cx="59" cy="52" r="3.6" fill="' + ink + '"/>' +
             '<path d="M36 46q5 3 10 0M54 46q5 3 10 0" stroke="' + ink + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    } else {
      eyes = '<circle cx="41" cy="50" r="4.6" fill="' + ink + '"/><circle cx="59" cy="50" r="4.6" fill="' + ink + '"/>' +
             '<circle cx="42.6" cy="48.4" r="1.6" fill="#fff"/><circle cx="60.6" cy="48.4" r="1.6" fill="#fff"/>';
    }
    let mouth = '<path d="M45 61h10" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/>';
    if (m.mouth === "grin") mouth = '<path d="M44 61q6 5 12 0" stroke="' + ink + '" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    if (m.mouth === "small") mouth = '<circle cx="50" cy="62" r="2.6" fill="' + ink + '"/>';
    if (m.mouth === "frown") mouth = '<path d="M44 64q6-5 12 0" stroke="' + ink + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    return eyes + mouth;
  }

  /* accessories the player has equipped */
  function accSvg(ids) {
    if (!ids || !ids.length || typeof TS_ITEMS === "undefined") return "";
    return ids.map(id => {
      const it = TS_ITEMS.find(x => x.id === id);
      return it ? it.svg : "";
    }).join("");
  }

  /* the whole creature */
  function draw(sl, opts) {
    opts = opts || {};
    const size = opts.size || 120;
    const days = opts.days != null ? opts.days : 0;
    const stage = opts.stage || stageFor(days).key;
    const mood = opts.mood || "waiting";
    const c = colorOf(sl && sl.color);
    const uid = "s" + Math.random().toString(36).slice(2, 7);
    const dim = mood === "fading";

    /* egg: no face, no accessories */
    if (stage === "egg") {
      return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" class="sl-svg' +
        (dim ? " sl-fading" : "") + '">' +
        '<defs><radialGradient id="' + uid + '" cx="38%" cy="28%">' +
        '<stop offset="0%" stop-color="' + c.body + '" stop-opacity=".55"/>' +
        '<stop offset="100%" stop-color="' + c.dark + '" stop-opacity=".75"/></radialGradient></defs>' +
        '<ellipse cx="50" cy="88" rx="17" ry="4" fill="#000" opacity=".08"/>' +
        '<path d="M50 16c14 0 24 16 24 32 0 20-11 32-24 32s-24-12-24-32c0-16 10-32 24-32z" fill="url(#' + uid + ')"/>' +
        '<path d="M38 44q8-5 14 2" stroke="#fff" stroke-width="2.5" fill="none" opacity=".35" stroke-linecap="round"/>' +
        '</svg>';
    }

    /* body shrinks a little at earlier stages */
    const g = stage === "hatch" ? 0.78 : stage === "young" ? 0.9 : 1;
    const bounce = (MOODS[mood] || {}).bounce && !opts.still;

    return '<svg viewBox="0 0 100 100" width="' + size + '" height="' + size + '" class="sl-svg' +
      (bounce ? " sl-bounce" : "") + (dim ? " sl-fading" : "") + '">' +
      '<defs><radialGradient id="' + uid + '" cx="38%" cy="30%">' +
      '<stop offset="0%" stop-color="' + c.body + '"/>' +
      '<stop offset="100%" stop-color="' + c.dark + '"/></radialGradient></defs>' +
      '<ellipse cx="50" cy="88" rx="' + (20 * g) + '" ry="4" fill="#000" opacity=".08"/>' +
      '<g transform="translate(50 56) scale(' + g + ') translate(-50 -56)">' +
        '<path d="M50 22c17 0 27 13 27 30 0 18-12 28-27 28s-27-10-27-28c0-17 10-30 27-30z" fill="url(#' + uid + ')"/>' +
        '<ellipse cx="26" cy="62" rx="6" ry="9" fill="' + c.body + '"/>' +
        '<ellipse cx="74" cy="62" rx="6" ry="9" fill="' + c.body + '"/>' +
        face(mood) +
        accSvg(sl && sl.acc) +
      "</g></svg>";
  }

  /* ---------- lifecycle ---------- */
  const FADE_HOURS = 48;

  function isFading(sl) {
    return !!(sl && sl.fadingSince && !sl.lost);
  }
  function hoursLeft(sl) {
    if (!isFading(sl)) return null;
    const left = FADE_HOURS - (Date.now() - sl.fadingSince) / 3600000;
    return Math.max(0, left);
  }
  function isLost(sl) {
    if (!sl) return true;
    if (sl.lost) return true;
    return isFading(sl) && hoursLeft(sl) <= 0;
  }

  /* youngest first - the one you have had longest is the last to go */
  function youngestAlive(list) {
    const alive = (list || []).filter(s => !isLost(s));
    if (!alive.length) return null;
    return alive.slice().sort((a, b) => (b.bornStreak || 0) - (a.bornStreak || 0))[0];
  }

  /* when can another one be requested */
  const UNLOCK_AT = [3, 30, 60];
  function canRequest(list, streak) {
    const alive = (list || []).filter(s => !isLost(s));
    if (alive.length >= 3) return { ok: false, reason: "max" };
    const need = UNLOCK_AT[alive.length];
    if (streak < need) return { ok: false, reason: "streak", need };
    return { ok: true, index: alive.length };
  }

  /* ---------- accessories ---------- */
  function unlockedItems(bestStreak, isPro) {
    if (typeof TS_ITEMS === "undefined") return [];
    return TS_ITEMS.filter(i => i.day <= bestStreak && (i.tier === "free" || isPro));
  }
  function ownsItem(item, bestStreak, isPro) {
    return item.day <= bestStreak && (item.tier === "free" || isPro);
  }

  return {
    STAGES, COLORS, MOODS, UNLOCK_AT, FADE_HOURS,
    stageFor, ageOf, colorOf, moodFor, draw,
    isFading, hoursLeft, isLost, youngestAlive, canRequest,
    unlockedItems, ownsItem
  };
})();
