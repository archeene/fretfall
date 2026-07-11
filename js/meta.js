// meta.js — FretFall progression layer: persistence, daily goal & streaks,
// per-song records with star ratings, XP/levels, and the song difficulty
// ladder. One localStorage blob so the game remembers you between sessions.
(function () {
  const KEY = "fretfall:profile";
  const pad = (n) => String(n).padStart(2, "0");
  const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayKey = (offsetDays) => {
    const d = new Date();
    if (offsetDays) d.setDate(d.getDate() + offsetDays);
    return dkey(d);
  };

  const DEFAULTS = {
    v: 1,
    songs: {},        // id -> {title, plays, best:{score,acc,combo,stars}, hist:[{d,acc,score}]}
    days: {},         // "YYYY-MM-DD" -> minutes played (number)
    frozen: [],       // dates covered by a streak freeze
    streak: { cur: 0, best: 0, last: null, freezes: 0 },
    xp: 0,
    goalMin: 5,       // daily goal in minutes — tiny floor by design
  };

  let profile = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), JSON.parse(raw));
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULTS));
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch (e) {}
  }

  // ---- Daily goal & streak ----
  // Streak rules: meeting the daily goal on consecutive days builds the streak.
  // Every 7 straight days earns a freeze (max 2). A single missed day is
  // auto-covered by a freeze; otherwise the streak restarts — framed as a
  // comeback, never a punishment.
  function addPlayTime(seconds) {
    const today = todayKey();
    const before = profile.days[today] || 0;
    const after = before + seconds / 60;
    profile.days[today] = after;
    const out = { goalJustMet: false, streak: profile.streak.cur, freezeEarned: false };
    if (before < profile.goalMin && after >= profile.goalMin) {
      out.goalJustMet = true;
      const s = profile.streak;
      if (s.last !== today) {
        if (s.last === todayKey(-1)) {
          s.cur += 1;
        } else if (s.last === todayKey(-2) && s.freezes > 0) {
          s.freezes -= 1;
          profile.frozen.push(todayKey(-1));   // yesterday is covered, streak survives
          s.cur += 1;
        } else {
          s.cur = 1;                            // comeback — day one of the next run
        }
        s.last = today;
        s.best = Math.max(s.best, s.cur);
        if (s.cur > 0 && s.cur % 7 === 0 && s.freezes < 2) { s.freezes += 1; out.freezeEarned = true; }
        profile.xp += 10;                       // showing up pays
      }
      out.streak = s.cur;
    }
    save();
    return out;
  }

  function todayMinutes() { return profile.days[todayKey()] || 0; }

  // ---- Star ratings ----
  function starsFor(accPct) {
    return accPct >= 97 ? 5 : accPct >= 90 ? 4 : accPct >= 80 ? 3 : accPct >= 65 ? 2 : 1;
  }

  // ---- Per-song records ----
  // Only full-song, mic-scored runs land here (the app gates that); listen-mode
  // and loop-practice runs still show results but never write records.
  function recordRun(song, run) {
    const id = song.id || song.title;
    const rec = profile.songs[id] || (profile.songs[id] = {
      title: song.title, plays: 0,
      best: { score: 0, acc: 0, combo: 0, stars: 0 },
      hist: [],
    });
    rec.plays += 1;
    rec.hist.push({ d: todayKey(), acc: run.acc, score: run.score });
    if (rec.hist.length > 30) rec.hist = rec.hist.slice(-30);
    const stars = starsFor(run.acc);
    const prev = { ...rec.best };
    const newBestScore = run.score > rec.best.score;
    const newBestAcc = run.acc > rec.best.acc;
    rec.best.score = Math.max(rec.best.score, run.score);
    rec.best.acc = Math.max(rec.best.acc, run.acc);
    rec.best.combo = Math.max(rec.best.combo, run.maxCombo);
    rec.best.stars = Math.max(rec.best.stars, stars);
    const xpGain = Math.max(5, Math.round(run.score / 20)) + (newBestScore ? 25 : 0);
    profile.xp += xpGain;
    save();
    return { stars, prev, newBestScore, newBestAcc, xpGain };
  }

  function songRec(song) {
    return profile.songs[(song && (song.id || song.title))] || null;
  }

  // ---- XP / level ----
  // Level N requires 200*N XP beyond the previous level (gentle early ramp).
  function levelInfo() {
    let xp = profile.xp, level = 1;
    while (xp >= level * 200) { xp -= level * 200; level += 1; }
    return { level, into: xp, need: level * 200 };
  }

  // ---- Song difficulty ladder ----
  // Chord songs live in tiers 1–3 (by how many distinct shapes you must know);
  // note/tab songs in tiers 2–5 (by note density at the song's own tempo).
  // Thresholds calibrated against the library's actual distribution.
  const diffCache = new Map();
  function difficulty(song) {
    const id = song.id || song.title;
    if (diffCache.has(id)) return diffCache.get(id);
    let tier;
    const bpm = song.bpm || 90;
    const src = (song.notes && song.notes.length) ? song.notes : (song.picked || []);
    if (src.length) {
      const maxB = src[src.length - 1].b || 1;
      const dur = Math.max(1, (maxB + 1) * (30 / bpm));   // eighth note = 30/bpm sec
      const nps = src.length / dur;
      tier = nps < 2.5 ? 2 : nps < 4.5 ? 3 : nps < 7 ? 4 : 5;
    } else {
      let uniq = 4;
      try {
        const parsed = window.TabParser.parseTab(song.text || "");
        uniq = new Set(parsed.chords.map((c) => c.name)).size;
      } catch (e) {}
      tier = uniq <= 4 ? 1 : uniq <= 7 ? 2 : 3;
    }
    diffCache.set(id, tier);
    return tier;
  }

  const TIER_NAMES = ["", "Campfire", "Porch", "Stage", "Studio", "Arena"];

  function ladder() {
    const tiers = [[], [], [], [], [], []];   // index by tier 1..5
    (window.SONGS || []).forEach((s, i) => {
      const rec = songRec(s);
      tiers[difficulty(s)].push({
        i, title: s.title, tier: difficulty(s),
        stars: rec ? rec.best.stars : 0,
        acc: rec ? rec.best.acc : null,
        plays: rec ? rec.plays : 0,
        hist: rec ? rec.hist : [],
      });
    });
    tiers.forEach((t) => t.sort((a, b) => a.title.localeCompare(b.title)));
    return tiers;
  }

  // Lowest-tier song not yet at 3 stars = the recommended next climb.
  function nextUp() {
    const tiers = ladder();
    for (let t = 1; t <= 5; t++) {
      const cand = tiers[t].find((s) => s.stars < 3);
      if (cand) return cand;
    }
    return null;
  }

  // ---- Streak calendar (last `n` days, oldest first) ----
  function calendar(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const date = todayKey(-i);
      const min = profile.days[date] || 0;
      out.push({
        date,
        min,
        met: min >= profile.goalMin,
        frozen: profile.frozen.includes(date),
      });
    }
    return out;
  }

  function addXp(n) { profile.xp += n; save(); }
  function grantFreeze() {
    if (profile.streak.freezes >= 2) return false;
    profile.streak.freezes += 1; save(); return true;
  }

  window.Meta = {
    get profile() { return profile; },
    save, addPlayTime, todayMinutes, starsFor, recordRun, songRec,
    levelInfo, difficulty, ladder, nextUp, calendar,
    addXp, grantFreeze,
    TIER_NAMES,
    todayKey,
  };
})();
