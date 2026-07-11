// campaign.js — the FretFall campaign: a 10-step guided path from guitar
// intermediate to mastery. Each step teaches one skill through one song, with
// quests that auto-complete from play telemetry (no manual checkboxes) and a
// boss gate that opens the next step.
(function () {
  const yt = (q) => "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
  const jg = (q) => "https://www.google.com/search?q=" + encodeURIComponent("justinguitar " + q);

  // Quest types:
  //  warmup      — finish any full play-through of the step song (listen mode fine)
  //  loop_passes — N clean (≥95%) mic-scored loop passes on the step song
  //  boss        — full song, mic-scored, 100% speed, accuracy ≥ minAcc
  const STEPS = [
    {
      n: 1, id: "rhythm", title: "Rhythm Command", songId: "im-yours-jason-mraz",
      skill: "Syncopated strumming, percussive mutes, dynamics — locking your right hand to the groove.",
      lessons: [
        { label: "Strumming dynamics & muting (JustinGuitar)", url: jg("grade 4 rhythm strumming dynamics") },
        { label: "Im Yours lesson (YouTube)", url: yt("im yours jason mraz guitar lesson strumming") },
      ],
      minAcc: 90,
    },
    {
      n: 2, id: "barre", title: "The Barre Gate", songId: "creep",
      skill: "Full barre fluency — G, B, C, Cm. The wall most players quit at; you go through it.",
      lessons: [
        { label: "Barre chord technique series (JustinGuitar)", url: jg("barre chords F shape technique") },
        { label: "Creep lesson (YouTube)", url: yt("marty music creep radiohead guitar lesson") },
      ],
      minAcc: 90,
    },
    {
      n: 3, id: "picking", title: "Fingerpicking Foundations", boss: true, songId: "fast-car-tracy-chapman",
      skill: "BOSS — The Fast Car pattern: thumb independence begins, fingers find their strings.",
      lessons: [
        { label: "Fingerpicking basics (JustinGuitar)", url: jg("fingerstyle folk pattern lesson") },
        { label: "Fast Car lesson (YouTube)", url: yt("fast car tracy chapman guitar lesson fingerpicking") },
      ],
      minAcc: 95,
    },
    {
      n: 4, id: "riffs", title: "Riff Engine", songId: "smells-like-teen-spirit-nirvana",
      skill: "Power chords, palm muting, right-hand drive — playing with weight and attitude.",
      lessons: [
        { label: "Power chords & palm muting (JustinGuitar)", url: jg("power chords palm muting lesson") },
        { label: "Smells Like Teen Spirit lesson (YouTube)", url: yt("smells like teen spirit guitar lesson power chords") },
      ],
      minAcc: 90,
    },
    {
      n: 5, id: "pentatonic", title: "Pentatonic Voice", boss: true, songId: "wish-you-were-here",
      skill: "BOSS — The G-pentatonic riff: hammer-ons, melody woven through chords. Your first voice.",
      lessons: [
        { label: "Pentatonic scale patterns (JustinGuitar)", url: jg("minor pentatonic scale pattern 1") },
        { label: "Wish You Were Here lesson (YouTube)", url: yt("wish you were here pink floyd intro guitar lesson") },
      ],
      minAcc: 95,
    },
    {
      n: 6, id: "travis", title: "Travis Picking", songId: "dust-in-the-wind-kansas",
      skill: "The alternating thumb becomes your metronome; three fingers roll above it.",
      lessons: [
        { label: "Travis picking explained (YouTube)", url: yt("travis picking for beginners tommy emmanuel paul davids") },
        { label: "Dust In The Wind lesson (YouTube)", url: yt("dust in the wind guitar lesson travis picking") },
      ],
      minAcc: 90,
    },
    {
      n: 7, id: "voicing", title: "Voicing Craft", songId: "under-bridge",
      skill: "Moving chord voicings and embellishments — the Under The Bridge intro as a study piece.",
      lessons: [
        { label: "Chord embellishment (JustinGuitar)", url: jg("chord embellishment sus add9 lesson") },
        { label: "Under The Bridge lesson (YouTube)", url: yt("under the bridge intro guitar lesson john frusciante voicings") },
      ],
      minAcc: 90,
    },
    {
      n: 8, id: "fingerstyle", title: "Advanced Fingerstyle", boss: true, songId: "blackbird",
      skill: "BOSS — Blackbird: two independent voices, tenths across the whole neck.",
      lessons: [
        { label: "Blackbird note-perfect lesson (YouTube)", url: yt("blackbird beatles guitar lesson paul davids") },
        { label: "Fingerstyle independence drills (YouTube)", url: yt("fingerstyle thumb independence exercises guitar") },
      ],
      minAcc: 95,
    },
    {
      n: 9, id: "lead", title: "Lead Language", songId: "stairway-to-heaven",
      skill: "From the arpeggiated intro to the solo: bends, vibrato, phrasing — speaking, not typing.",
      lessons: [
        { label: "Bends & vibrato technique (JustinGuitar)", url: jg("bending vibrato lead guitar lesson") },
        { label: "Stairway To Heaven full lesson (YouTube)", url: yt("stairway to heaven guitar lesson marty music") },
      ],
      minAcc: 90,
    },
    {
      n: 10, id: "mastery", title: "Integration — The Tower", boss: true, songId: "hotel-california",
      skill: "FINAL BOSS — Hotel California: barres, arpeggios, lead, endurance. Everything at once.",
      lessons: [
        { label: "Hotel California full lesson (YouTube)", url: yt("hotel california guitar lesson marty music full song") },
        { label: "Solo breakdown (YouTube)", url: yt("hotel california solo lesson slow") },
      ],
      minAcc: 95,
    },
  ];

  const BADGES = ["", "Groovewright", "Wallbreaker", "Six Strings Woven", "Riffsmith",
    "First Voice", "The Steady Thumb", "Voice Leader", "Two Minds One Hand",
    "Speaker of Leads", "The Tower Stands"];

  // Every step has the same three quests, tuned by the step's own gate.
  function questsFor(step) {
    return [
      { id: "warmup", desc: "Warm up: one full play-through (listen mode counts)" },
      { id: "loops", desc: "3 clean loop passes on your hardest section (95%+)", target: 3 },
      { id: "boss", desc: `Clear the gate: full song, mic-scored, 100% speed, ${step.minAcc}%+ accuracy` },
    ];
  }

  // ---- Progress (lives inside the Meta profile blob) ----
  function prog() {
    const p = window.Meta.profile;
    if (!p.campaign) p.campaign = { done: {}, loops: {}, badges: [] };
    return p.campaign;
  }
  const stepDone = (step) => {
    const d = prog().done[step.id] || {};
    return d.warmup && d.loops && d.boss;
  };
  const unlocked = (step) => step.n === 1 || stepDone(STEPS[step.n - 2]);
  const current = () => STEPS.find((s) => !stepDone(s)) || STEPS[STEPS.length - 1];
  const songIndexOf = (step) => window.SONGS.findIndex((s) => s.id === step.songId);
  const stepForSong = (song) => song && STEPS.find((s) => s.songId === song.id);

  // ---- Telemetry hooks (called by app.js) ----
  // Returns a list of events for the UI to toast: {type:"quest"|"step", ...}
  function onRun(song, run, recordable, speed) {
    const step = stepForSong(song);
    if (!step || !unlocked(step)) return [];
    const c = prog();
    const d = c.done[step.id] || (c.done[step.id] = {});
    const events = [];
    if (!d.warmup) {
      d.warmup = true;
      events.push({ type: "quest", step, desc: "Warm-up complete" });
    }
    if (!d.boss && recordable && speed >= 1 && run.acc >= step.minAcc) {
      d.boss = true;
      events.push({ type: "quest", step, desc: "Gate cleared!" });
    }
    if (stepDone(step) && !c.badges.includes(BADGES[step.n])) {
      c.badges.push(BADGES[step.n]);
      window.Meta.addXp(step.boss ? 500 : 250);
      window.Meta.grantFreeze();
      events.push({ type: "step", step, badge: BADGES[step.n], xp: step.boss ? 500 : 250 });
    }
    window.Meta.save();
    return events;
  }

  function onCleanPass(song) {
    const step = stepForSong(song);
    if (!step || !unlocked(step)) return [];
    const c = prog();
    const d = c.done[step.id] || (c.done[step.id] = {});
    if (d.loops) return [];
    c.loops[step.id] = (c.loops[step.id] || 0) + 1;
    const events = [];
    if (c.loops[step.id] >= 3) {
      d.loops = true;
      events.push({ type: "quest", step, desc: "Loop drill complete (3 clean passes)" });
    }
    window.Meta.save();
    return events;
  }

  // ---- Read model for the UI ----
  function view(step) {
    const c = prog();
    const d = c.done[step.id] || {};
    return {
      step,
      unlocked: unlocked(step),
      done: stepDone(step),
      quests: questsFor(step).map((q) => ({
        ...q,
        done: !!d[q.id],
        progress: q.id === "loops" ? Math.min(3, c.loops[step.id] || 0) : (d[q.id] ? 1 : 0),
      })),
      badge: BADGES[step.n],
      songIndex: songIndexOf(step),
    };
  }

  window.Campaign = {
    STEPS, BADGES,
    view, current, unlocked, stepDone, stepForSong, songIndexOf,
    onRun, onCleanPass,
  };
})();
