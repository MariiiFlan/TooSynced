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

  /* ---------- types ----------
     The three from the concept: one shared creature, one baby, or a
     Duo with one creature per person that react to each other. */
  const TYPES = [
    { id: "creature", name: "Creature", blurb: "One pet you raise together" },
    { id: "duo",      name: "Duo",      blurb: "One each, side by side" },
    { id: "baby",     name: "Baby",     blurb: "Milestones, not levels" }
  ];

  /* shapes, chosen on top of the type. Baby has its own silhouettes,
     so these apply to Creature and to each half of a Duo. */
  const BODIES = [
    { id: "blob",  name: "Blob",  blurb: "Round and unbothered" },
    { id: "bean",  name: "Bean",  blurb: "Tall and dramatic" },
    { id: "puff",  name: "Puff",  blurb: "Wide and smug" },
    { id: "spike", name: "Spike", blurb: "Pointy and anxious" }
  ];

  function bodyPath(shape, stage) {
    const small = stage === "hatch";
    switch (shape) {
      case "bean":
        return small ? "M50 28c11 0 18 10 18 24 0 15-7 24-18 24s-18-9-18-24c0-14 7-24 18-24z"
                     : "M50 18c14 0 23 12 23 30 0 20-9 32-23 32s-23-12-23-32c0-18 9-30 23-30z";
      case "puff":
        return small ? "M50 32c16 0 24 9 24 21 0 13-10 21-24 21s-24-8-24-21c0-12 8-21 24-21z"
                     : "M50 26c20 0 30 11 30 26 0 16-13 26-30 26s-30-10-30-26c0-15 10-26 30-26z";
      case "spike":
        return small ? "M50 24 59 36c7 3 11 10 11 18 0 14-9 22-20 22s-20-8-20-22c0-8 4-15 11-18z"
                     : "M50 14 62 30c9 4 14 12 14 22 0 18-12 28-26 28s-26-10-26-28c0-10 5-18 14-22z";
      default:
        return small ? "M50 30c13 0 21 10 21 23 0 14-9 22-21 22s-21-8-21-22c0-13 8-23 21-23z"
                     : "M50 22c17 0 27 13 27 30 0 18-12 28-27 28s-27-10-27-28c0-17 10-30 27-30z";
    }
  }
  function armX(shape) { return shape === "puff" ? 21 : shape === "bean" ? 28 : 26; }
  function armY(shape) { return shape === "bean" ? 60 : shape === "puff" ? 64 : 62; }

  /* stage labels differ per type */
  const STAGE_NAMES = {
    creature: { egg: "Egg", hatch: "Hatchling", young: "Young", grown: "Grown" },
    duo:      { egg: "Two eggs", hatch: "Hatchlings", young: "Young", grown: "Grown" },
    baby:     { egg: "On the way", hatch: "Swaddled", young: "Sitting up", grown: "Toddling" }
  };
  function stageLabel(type, key) {
    return (STAGE_NAMES[type] || STAGE_NAMES.creature)[key] || key;
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

  /* the shape, per type and stage */
  function bodyFor(sl, stage, c, uid) {
    const type = (sl && sl.type) || "creature";

    if (type === "baby") {
      const skin = "#F0D2B4", cheek = "rgba(224,120,120,.35)";
      if (stage === "hatch") {
        /* swaddled: a bundle with a head poking out */
        return '<path d="M26 62c0-14 11-22 24-22s24 8 24 22c0 12-9 20-24 20s-24-8-24-20z" fill="url(#' + uid + ')"/>' +
               '<circle cx="50" cy="40" r="17" fill="' + skin + '"/>' +
               '<ellipse cx="40" cy="45" rx="4" ry="2.6" fill="' + cheek + '"/>' +
               '<ellipse cx="60" cy="45" rx="4" ry="2.6" fill="' + cheek + '"/>';
      }
      if (stage === "young") {
        /* sitting up, arms out */
        return '<path d="M32 78c0-14 8-22 18-22s18 8 18 22z" fill="url(#' + uid + ')"/>' +
               '<circle cx="50" cy="44" r="19" fill="' + skin + '"/>' +
               '<ellipse cx="27" cy="70" rx="6" ry="5" fill="' + skin + '"/>' +
               '<ellipse cx="73" cy="70" rx="6" ry="5" fill="' + skin + '"/>' +
               '<ellipse cx="38" cy="50" rx="4.5" ry="3" fill="' + cheek + '"/>' +
               '<ellipse cx="62" cy="50" rx="4.5" ry="3" fill="' + cheek + '"/>' +
               '<path d="M44 26q6-8 12 0" stroke="#6B4A2F" stroke-width="3" fill="none" stroke-linecap="round"/>';
      }
      /* toddling */
      return '<rect x="34" y="54" width="32" height="26" rx="10" fill="url(#' + uid + ')"/>' +
             '<circle cx="50" cy="40" r="20" fill="' + skin + '"/>' +
             '<path d="M30 24q20-12 40 0v6q-20-9-40 0z" fill="#6B4A2F"/>' +
             '<ellipse cx="26" cy="62" rx="5" ry="7" fill="' + skin + '"/>' +
             '<ellipse cx="74" cy="62" rx="5" ry="7" fill="' + skin + '"/>' +
             '<rect x="38" y="79" width="9" height="7" rx="3" fill="' + c.dark + '"/>' +
             '<rect x="53" y="79" width="9" height="7" rx="3" fill="' + c.dark + '"/>' +
             '<ellipse cx="36" cy="47" rx="5" ry="3.2" fill="' + cheek + '"/>' +
             '<ellipse cx="64" cy="47" rx="5" ry="3.2" fill="' + cheek + '"/>';
    }

    /* creature (and each half of a duo) */
    const shape = (sl && sl.body) || "blob";
    const g = bodyPath(shape, stage);
    const ax = armX(shape), ay = armY(shape);
    let ears = "";
    if ((stage === "young" || stage === "grown") && shape !== "spike") {
      ears = '<path d="M36 26q2-11 8-2z" fill="' + c.body + '"/><path d="M64 26q-2-11-8-2z" fill="' + c.body + '"/>';
    }
    return '<path d="' + g + '" fill="url(#' + uid + ')"/>' + ears +
      '<ellipse cx="' + ax + '" cy="' + ay + '" rx="6" ry="9" fill="' + c.body + '"/>' +
      '<ellipse cx="' + (100 - ax) + '" cy="' + ay + '" rx="6" ry="9" fill="' + c.body + '"/>';
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
        bodyFor(sl, stage, c, uid) +
        face(mood) +
        accSvg(sl && sl.acc) +
      "</g></svg>";
  }

  /* A Duo is two creatures in one scene. Each half mirrors that person's
     day, which is the whole point - you can see who is carrying it. */
  function drawDuo(sl, opts) {
    opts = opts || {};
    const size = opts.size || 130;
    const days = opts.days || 0;
    const stage = opts.stage || stageFor(days).key;
    const a = opts.moodA || opts.mood || "waiting";
    const b = opts.moodB || opts.mood || "waiting";
    const other = sl && sl.color2 ? { color: sl.color2 } : { color: "peach" };
    const half = Math.round(size * 0.62);
    return '<div class="sl-duo">' +
      draw({ ...sl, type: "creature" }, { size: half, days, stage, mood: a, still: opts.still }) +
      draw({ ...other, type: "creature", acc: [] }, { size: half, days, stage, mood: b, still: opts.still }) +
      "</div>";
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
  function unlockedItems(bestStreak, isPro, all) {
    if (typeof TS_ITEMS === "undefined") return [];
    if (all) return TS_ITEMS.slice();
    return TS_ITEMS.filter(i => i.day <= bestStreak && (i.tier === "free" || isPro));
  }
  function ownsItem(item, bestStreak, isPro, all) {
    if (all) return true;
    return item.day <= bestStreak && (item.tier === "free" || isPro);
  }

  return {
    STAGES, COLORS, TYPES, BODIES, MOODS, UNLOCK_AT, FADE_HOURS, bodyPath,
    stageFor, stageLabel, ageOf, colorOf, moodFor, draw, drawDuo,
    isFading, hoursLeft, isLost, youngestAlive, canRequest,
    unlockedItems, ownsItem
  };
})();
