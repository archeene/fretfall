// app.js — FretFall main application & game loop.
(function () {
  const $ = (id) => document.getElementById(id);

  // ---- DOM ----
  const canvas = $("highway");
  const ctx = canvas.getContext("2d");
  const els = {
    play: $("btnPlay"), restart: $("btnRestart"), mic: $("btnMic"),
    mode: $("btnMode"), audio: $("btnAudio"), songSelect: $("songSelect"),
    bpm: $("bpm"), bpmVal: $("bpmVal"),
    accuracy: $("accuracy"), hitCount: $("hitCount"), playedCount: $("playedCount"), detected: $("detected"),
    hint: $("hint"), progress: $("progress"), progressFill: $("progressFill"),
    loopRegion: $("loopRegion"), loopA: $("loopA"), loopB: $("loopB"),
    capoBadge: $("capoBadge"),
    speed: $("speed"), speedVal: $("speedVal"),
    scoreVal: $("scoreVal"), multVal: $("multVal"),
    ringFill: $("ringFill"), ringText: $("ringText"), goalRing: $("goalRing"),
    streakVal: $("streakVal"), btnStats: $("btnStats"),
    resultsModal: $("resultsModal"), resultsTitle: $("resultsTitle"), resultsStars: $("resultsStars"),
    resultsBadge: $("resultsBadge"), resScore: $("resScore"), resAcc: $("resAcc"),
    resCombo: $("resCombo"), resPerfect: $("resPerfect"), resBest: $("resBest"),
    resSections: $("resSections"), resLoopWorst: $("resLoopWorst"),
    resReplay: $("resReplay"), resClose: $("resClose"),
    statsModal: $("statsModal"), statsClose: $("statsClose"),
    statsSummary: $("statsSummary"), statsCal: $("statsCal"), statsLadder: $("statsLadder"),
    toasts: $("toasts"),
    campSelect: $("campSelect"),
    campModal: $("campModal"), campClose: $("campClose"),
    campStepNum: $("campStepNum"), campTitle: $("campTitle"), campBoss: $("campBoss"),
    campSkill: $("campSkill"), campSong: $("campSong"), campPlay: $("campPlay"),
    campQuests: $("campQuests"), campLessons: $("campLessons"), campReward: $("campReward"),
    campPrev: $("campPrev"), campNext: $("campNext"),
  };

  // ---- State ----
  const state = {
    notes: [],          // {time, name, pcs, root, lane, judged, hit}
    bpm: 90,
    capo: 0,            // capo fret — shifts matching pitch up by this many semitones
    mode: "chords",     // "chords" | "notes"
    song: null,         // raw song object currently loaded
    chords: [],         // panel chord markers (note mode): {time, name, pcs}
    loopA: 0,           // practice-loop start (fraction of song)
    loopB: 1,           // practice-loop end (fraction of song)
    playing: false,
    startClock: 0,      // performance.now() at song t=0
    pausedAt: 0,        // song-time when paused
    score: 0,
    combo: 0,
    maxCombo: 0,
    hits: 0,            // notes hit correctly so far
    played: 0,          // notes that have passed the hit line so far
    detector: null,
    micOn: false,
    detectedPC: -1,
    detectedName: "—",
    pcHistory: [],      // recent raw pitch classes, for stability gating
    audioOn: false,     // backing-track playback
    audioCtx: null,
    audioMaster: null,
    audioPtr: 0,        // index into state.notes of the next event to schedule
    audioSources: [],   // currently sounding oscillators
    lessonCapSec: null, // when set, trim the timeline to a focused lesson segment
    speed: 1,           // practice speed multiplier (0.5–1.0) applied to the tempo
    perfects: 0,        // hits graded Perfect this run
    sections: [],       // per-section accuracy: {t0, t1, hits, played}
    floaters: [],       // rising judgment texts: {lane, text, color, born}
    runShown: false,    // results already shown for this run
    playAccumSec: 0,    // seconds of playtime not yet flushed to Meta
    lastFrameTs: 0,     // performance.now() of the previous frame
    passMarkHits: 0,    // hits/played at the start of the current loop pass —
    passMarkPlayed: 0,  //   used to grade each pass for auto speed-up
    cleanPasses: 0,     // consecutive ≥95% loop passes at the current speed
  };

  // Practice speed scales the effective tempo everywhere timing is derived.
  const bpmEff = () => state.bpm * state.speed;

  // ---- Layout constants ----
  const LEAD_SECONDS = 3;       // how far ahead a note is visible above hit line
  const HIT_WINDOW = 0.45;      // +/- seconds counted as a hit (timing tolerance)
  const LANES = 6;
  const LANE_COLORS = ["#29e0c8", "#ff4d8d", "#ffd166", "#7c5cff", "#38ef7d", "#ff8e3c"];

  // Standard tuning. Index 0 = low E (6th string) … 5 = high e (1st string).
  const OPEN_MIDI = [40, 45, 50, 55, 59, 64];     // E2 A2 D3 G3 B3 E4
  const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];
  const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const midiToPc = (m) => ((m % 12) + 12) % 12;
  const midiToName = (m) => PC_NAMES[midiToPc(m)];

  // Identify a chord name from a set of pitch classes (+ the bass pitch class).
  const QUALITIES = [
    { q: "", iv: [0, 4, 7] }, { q: "m", iv: [0, 3, 7] },
    { q: "7", iv: [0, 4, 7, 10] }, { q: "m7", iv: [0, 3, 7, 10] }, { q: "maj7", iv: [0, 4, 7, 11] },
    { q: "sus4", iv: [0, 5, 7] }, { q: "sus2", iv: [0, 2, 7] },
    { q: "6", iv: [0, 4, 7, 9] }, { q: "m6", iv: [0, 3, 7, 9] },
    { q: "add9", iv: [0, 2, 4, 7] }, { q: "dim", iv: [0, 3, 6] }, { q: "aug", iv: [0, 4, 8] },
    { q: "5", iv: [0, 7] },
  ];
  function recognizeChord(pcs, bassPc) {
    const S = [...new Set(pcs)];
    let best = null, bestScore = -1;
    for (let root = 0; root < 12; root++) {
      for (let qi = 0; qi < QUALITIES.length; qi++) {
        const tones = QUALITIES[qi].iv.map((i) => (root + i) % 12);
        if (!S.every((pc) => tones.includes(pc))) continue;   // every played note must be a chord tone
        const matched = tones.filter((t) => S.includes(t)).length;
        let score = matched * 10 - (tones.length - S.length) * 3 - qi * 0.1;
        if (root === bassPc) score += 5;
        if (score > bestScore) { bestScore = score; best = { root, q: QUALITIES[qi].q, tones }; }
      }
    }
    if (!best) return PC_NAMES[bassPc];
    let name = PC_NAMES[best.root] + best.q;
    if (bassPc !== best.root && best.tones.includes(bassPc)) name += "/" + PC_NAMES[bassPc];
    return name;
  }

  // ---- Canvas sizing (HiDPI aware) ----
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.W = rect.width;
    state.H = rect.height;
  }
  window.addEventListener("resize", resize);

  // ---- Build a CHORD timeline (uniform BPM × beats-per-chord) ----
  // ---- Build a CHORD timeline as a STRUM pattern ----
  // Each chord is strummed in rhythm using the song's up/down pattern (one token
  // per eighth note in a bar). Falling blocks show ↓/↑ strokes; the panel shows
  // the chord name + diagram. `chordBars` = how many bars each chord is held.
  const DEFAULT_STRUM = ["D", "-", "D", "U", "-", "U", "D", "U"]; // ↓ ↓↑ ↑↓↑
  function buildChordTimeline(chords) {
    const s = state.song || {};
    const strum = (s.strum && s.strum.length) ? s.strum : DEFAULT_STRUM;
    const beatsPerBar = s.beatsPerBar || 4;
    const chordBars = s.chordBars || 1;
    const secPerBar = (60 / bpmEff()) * beatsPerBar;
    const secPerSlot = secPerBar / strum.length;
    // one distinct color per unique chord, evenly spaced around the hue wheel
    const uniq = [...new Set(chords.map((c) => c.name))];
    state.chordColors = new Map(uniq.map((name, i) =>
      [name, `hsl(${Math.round((i * 360) / uniq.length)}, 78%, 60%)`]));
    const evs = [];
    let t = LEAD_SECONDS;
    for (const c of chords) {
      for (let bar = 0; bar < chordBars; bar++) {
        for (let i = 0; i < strum.length; i++) {
          const tok = strum[i];
          if (tok === "-" || tok === ".") continue;      // rest = no strum
          evs.push({
            isNote: false, isStrum: true, name: c.name, label: c.name, lyric: c.lyric || "",
            pcs: c.pcs, lane: c.root % LANES,
            time: t + bar * secPerBar + i * secPerSlot,
            judged: false, hit: false, flash: 0,
          });
        }
      }
      t += chordBars * secPerBar;
    }
    state.notes = evs;
    state.chords = [];
    finishTimeline();
  }

  // ---- Build an individual-NOTE timeline from tab (string/fret events) ----
  // Each source note is {b, s, f}: b = eighth-note index, s = string (0=lowE),
  // f = fret. Lane = string; pitch class derived from tuning.
  function buildNoteTimeline(song) {
    const eighth = (60 / bpmEff()) / 2;   // 6/8 feel: count in eighth notes
    // group source notes by their beat position (simultaneous notes share `b`)
    const groups = new Map();
    const srcNotes = (song.notes && song.notes.length) ? song.notes : (song.picked || []);
    for (const n of srcNotes) {
      if (!groups.has(n.b)) groups.set(n.b, []);
      groups.get(n.b).push(n);
    }
    const evs = [];
    for (const [b, members] of groups) {
      const time = LEAD_SECONDS + b * eighth;
      // chord metadata: simultaneous notes render larger + visually bridged
      // across their strings so chords stand apart from single notes
      const isChord = members.length >= 2;
      const lanes = members.map((m) => m.s);
      const loLane = Math.min(...lanes), hiLane = Math.max(...lanes);
      // every note shown individually on the highway
      for (const m of members) {
        const midi = OPEN_MIDI[m.s] + m.f;
        evs.push({
          isNote: true, label: String(m.f), pc: midiToPc(midi), pcs: [midiToPc(midi)],
          string: m.s, fret: m.f, noteName: midiToName(midi), midis: [midi],
          time, lane: m.s, judged: false, hit: false, flash: 0,
          chordSize: isChord ? members.length : 1,
          chordAnchor: isChord && m.s === loLane, chordLo: loLane, chordHi: hiLane,
        });
      }
    }
    evs.sort((a, c) => a.time - c.time || (a.lane || 0) - (c.lane || 0));
    // record each note's time gap to the next note in the SAME lane, so the
    // renderer can shrink tiles enough that they never overlap (keeps fret
    // numbers readable in dense passages).
    const lastInLane = {};
    for (const ev of evs) {
      const prev = lastInLane[ev.lane];
      if (prev) { const g = ev.time - prev.time; prev.gapToNext = g; ev.gapToPrev = g; }
      lastInLane[ev.lane] = ev;
    }
    state.notes = evs;
    state.chords = buildChordMarks(song, eighth);   // broken-chord diagrams
    finishTimeline();
  }

  // Chord markers (with start/end times) so a diagram shows while a broken chord
  // (arpeggio) is on screen. Prefers the GPX's labelled chords; otherwise
  // recognizes one chord per bar from the notes in it.
  function buildChordMarks(song, eighth) {
    const marks = [];
    const sn = (song.notes && song.notes.length) ? song.notes : (song.picked || []);
    if (song.chordMarks && song.chordMarks.length) {
      const cm = song.chordMarks;
      const lastB = sn.length ? sn[sn.length - 1].b + 1 : 0;
      for (let i = 0; i < cm.length; i++) {
        const endB = i + 1 < cm.length ? cm[i + 1].b : lastB;
        marks.push({
          time: LEAD_SECONDS + cm[i].b * eighth,
          endTime: LEAD_SECONDS + endB * eighth,
          name: cm[i].name,
          pcs: window.TabParser.chordToPitchClasses(cm[i].name),
        });
      }
      return marks;
    }
    // fallback: recognize a chord per bar window from the notes present
    const barE = song.barEighths || 6;
    const byBar = new Map();
    for (const n of sn) {
      const bar = Math.floor(n.b / barE);
      if (!byBar.has(bar)) byBar.set(bar, []);
      byBar.get(bar).push(n);
    }
    for (const [bar, mem] of byBar) {
      const midis = mem.map((m) => OPEN_MIDI[m.s] + m.f);
      const pcs = [...new Set(midis.map(midiToPc))];
      if (pcs.length < 3) continue;       // need ≥3 distinct tones to name a chord
      marks.push({
        time: LEAD_SECONDS + bar * barE * eighth,
        endTime: LEAD_SECONDS + (bar + 1) * barE * eighth,
        name: recognizeChord(pcs, midiToPc(Math.min(...midis))),
        pcs,
      });
    }
    // merge consecutive identical chords into one span
    const merged = [];
    for (const m of marks) {
      const prev = merged[merged.length - 1];
      if (prev && prev.name === m.name) prev.endTime = m.endTime;
      else merged.push(m);
    }
    return merged;
  }

  function finishTimeline() {
    // Campaign lessons trim to a focused segment so a step is learnable, not a
    // 4-minute grind of the full repeated sheet. The Song menu plays uncapped.
    if (state.lessonCapSec) {
      const limit = LEAD_SECONDS + state.lessonCapSec;
      state.notes = state.notes.filter((n) => n.time <= limit);
      if (state.chords) state.chords = state.chords.filter((c) => c.time <= limit);
    }
    state.songLength = state.notes.length
      ? state.notes[state.notes.length - 1].time + LEAD_SECONDS
      : 0;
    buildSections();
  }

  // Split the song into 4–8 time sections so the results screen can show
  // where the misses live (and loop straight into the worst one).
  function buildSections() {
    if (!state.notes.length) { state.sections = []; return; }
    const first = state.notes[0].time;
    const last = state.notes[state.notes.length - 1].time;
    const dur = Math.max(1, last - first);
    const N = Math.max(4, Math.min(8, Math.round(dur / 12)));
    state.sections = Array.from({ length: N }, (_, i) => ({
      t0: first + (dur * i) / N,
      t1: first + (dur * (i + 1)) / N,
      hits: 0, played: 0,
    }));
  }

  function sectionAt(time) {
    for (const s of state.sections) if (time >= s.t0 && time <= s.t1) return s;
    return state.sections[state.sections.length - 1] || null;
  }

  function buildCurrentTimeline() {
    state.panelSlots = null;   // reset fixed chord-diagram slots
    const s = state.song;
    const hasNoteTrack = (s.notes && s.notes.length) || (s.picked && s.picked.length);
    if (state.mode === "notes" && hasNoteTrack) {
      buildNoteTimeline(s);
    } else {
      const parsed = window.TabParser.parseTab(s.text);
      buildChordTimeline(parsed.chords);
    }
  }

  function loadSongObject(s) {
    state.song = s;
    state.title = s.title || "Untitled";
    if (s.bpm) { state.bpm = s.bpm; els.bpm.value = s.bpm; els.bpmVal.textContent = s.bpm; }
    state.capo = s.capo || 0;
    els.capoBadge.textContent = `Capo ${state.capo}`;
    els.capoBadge.style.display = state.capo ? "" : "none";
    // Default to Notes mode when the song has a note track; else Chords mode.
    state.mode = (s.notes && s.notes.length) ? "notes" : "chords";
    state.loopA = 0; state.loopB = 1;   // new song → full-range loop
    buildCurrentTimeline();
    updateModeButton();
    resetPlayback();
    els.hint.classList.add("gone");
  }

  function resetPlayback() {
    state.playing = false;
    const startT = (state.loopA || 0) * (state.songLength || 0);  // restart at loop start
    state.pausedAt = startT;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.hits = 0;
    state.played = 0;
    state.perfects = 0;
    state.floaters = [];
    state.runShown = false;
    state.passMarkHits = 0; state.passMarkPlayed = 0; state.cleanPasses = 0;
    for (const s of state.sections) { s.hits = 0; s.played = 0; }
    state.notes.forEach((n) => { n.flash = 0; n.hit = false; n.judged = n.time < startT; });
    els.play.textContent = "▶ Play";
    stopAllAudio();
    state.audioPtr = audioPtrFor(startT);
    updateHud();
  }

  // ---- Transport ----
  function songTime() {
    if (!state.playing) return state.pausedAt;
    return (performance.now() - state.startClock) / 1000;
  }

  function togglePlay() {
    if (!state.notes.length) return;
    if (state.playing) {
      state.pausedAt = songTime();
      state.playing = false;
      els.play.textContent = "▶ Play";
      stopAllAudio();
      flushPlayTime();
    } else {
      // if we're outside the practice loop, start at the loop's beginning
      const frac = state.songLength ? state.pausedAt / state.songLength : 0;
      if (frac < state.loopA || frac >= state.loopB) seekTo(state.loopA);
      state.startClock = performance.now() - state.pausedAt * 1000;
      state.playing = true;
      els.play.textContent = "⏸ Pause";
      els.hint.classList.add("gone");
      if (state.audioOn) state.audioPtr = audioPtrFor(songTime());
    }
  }

  // Seek to a fraction (0..1) of the song — used by the draggable progress bar.
  function seekTo(frac) {
    if (!state.songLength) return;
    const newT = Math.max(0, Math.min(1, frac)) * state.songLength;
    if (state.playing) state.startClock = performance.now() - newT * 1000;
    else state.pausedAt = newT;
    for (const n of state.notes) {
      n.flash = 0;
      n.judged = n.time < newT;   // notes before the cursor are "past"
      n.hit = false;
    }
    state.combo = 0;
    stopAllAudio();
    state.audioPtr = audioPtrFor(newT);
    updateHud();
  }

  // ---- Scoring ----
  // Combo multiplier: ×1 → ×4, stepping up every 10 consecutive hits.
  const multiplier = () => 1 + Math.min(3, Math.floor(state.combo / 10));

  // Timing grades within the hit window (delta = seconds from the note's onset).
  function gradeFor(delta) {
    const a = Math.abs(delta);
    if (a <= 0.12) return { text: "Perfect", color: "#29e0c8", perfect: true };
    if (a <= 0.25) return { text: "Good", color: "#ffd166" };
    return delta > 0 ? { text: "Late", color: "#8a96b8" } : { text: "Early", color: "#8a96b8" };
  }

  function addFloater(lane, text, color) {
    state.floaters.push({ lane, text, color, born: performance.now() });
    if (state.floaters.length > 24) state.floaters.shift();
  }

  function creditSection(time, hit) {
    const s = sectionAt(time);
    if (s) { s.played++; if (hit) s.hits++; }
  }

  function judge(t) {
    for (const n of state.notes) {
      if (n.judged) continue;
      // Backing track on = the app is sounding every correct note itself, so credit
      // each note as it crosses the line (mic re-detection of the synth is lossy and
      // can't hit 100%). Mic scoring still applies when audio is off.
      if (state.audioOn && t >= n.time && t <= n.time + HIT_WINDOW) {
        n.judged = true; n.hit = true; n.flash = 1;
        state.hits++; state.played++;
        creditSection(n.time, true);
        state.combo += 1; state.maxCombo = Math.max(state.maxCombo, state.combo);
        state.score += 50 * multiplier();
        updateHud();
        continue;
      }
      // Missed window entirely
      if (t > n.time + HIT_WINDOW) {
        n.judged = true; n.hit = false;
        state.combo = 0;
        state.played++;
        creditSection(n.time, false);
        n.flash = 1;
        addFloater(n.lane, "Miss", "#ff5b6e");
        updateHud();
        continue;
      }
      // Inside window and player is sounding a matching tone
      if (Math.abs(t - n.time) <= HIT_WINDOW && state.detectedPC >= 0) {
        // With a capo, the fingered shape sounds `capo` semitones higher than written.
        if (n.pcs.some((pc) => (pc + state.capo) % 12 === state.detectedPC)) {
          n.judged = true; n.hit = true; n.flash = 1;
          state.hits++; state.played++;
          creditSection(n.time, true);
          const delta = t - n.time;
          const grade = gradeFor(delta);
          if (grade.perfect) state.perfects++;
          addFloater(n.lane, grade.text, grade.color);
          const closeness = 1 - Math.abs(delta) / HIT_WINDOW;
          state.score += Math.round((50 + 50 * closeness) * multiplier());
          state.combo += 1;
          state.maxCombo = Math.max(state.maxCombo, state.combo);
          // Double-stops: notes struck together count once — credit the siblings.
          if (n.isNote) {
            for (const m of state.notes) {
              if (!m.judged && m.isNote && Math.abs(m.time - n.time) < 0.001) {
                m.judged = true; m.hit = true; m.flash = 1;
                state.hits++; state.played++;
                creditSection(m.time, true);
              }
            }
          }
          updateHud();
        }
      }
    }
  }

  function updateHud() {
    const pct = state.played ? Math.round((100 * state.hits) / state.played) : 100;
    els.accuracy.textContent = pct + "%";
    els.hitCount.textContent = state.hits;
    els.playedCount.textContent = state.played;
    els.detected.textContent = state.detectedName;
    if (els.scoreVal) els.scoreVal.textContent = state.score.toLocaleString();
    if (els.multVal) {
      const m = multiplier();
      els.multVal.textContent = "×" + m;
      els.multVal.className = "mult m" + m;
    }
  }

  // ---- Microphone ----
  // Idempotent. `manual` = the user clicked the button (show errors); auto-enable
  // calls stay quiet. Browsers require a user gesture, so this fires on the first
  // interaction (see the autoMic listener in the boot section).
  async function enableMic(manual) {
    if (state.micOn || state.micStarting) return;
    state.micStarting = true;
    try {
      state.detector = new window.PitchDetector();
      await state.detector.start();
      state.micOn = true;
      els.mic.textContent = "🎤 Mic On";
      els.mic.classList.add("active");
    } catch (e) {
      if (manual) {
        alert("Could not access microphone: " + e.message +
          "\n\nTip: run via the bundled launcher (http://localhost) so the browser allows mic access.");
      }
    } finally {
      state.micStarting = false;
    }
  }

  function disableMic() {
    if (state.detector) { try { state.detector.stop(); } catch (e) {} }
    state.micOn = false;
    state.detectedPC = -1;
    state.detectedName = "—";
    if (els.detected) els.detected.textContent = "—";
    els.mic.textContent = "🎤 Enable Mic";
    els.mic.classList.remove("active");
  }

  const VOTE_WINDOW = 6;   // frames to vote over (~100ms)
  const VOTE_MIN = 2;      // a pitch class must win at least this many votes
  function pollMic() {
    if (!state.micOn) return;
    const { freq } = state.detector.detect();
    const raw = freq > 0 ? window.freqToPitchClass(freq) : -1;

    state.pcHistory.push(raw);
    if (state.pcHistory.length > VOTE_WINDOW) state.pcHistory.shift();

    // Majority vote over the recent window: smooths the frame-to-frame jitter of
    // guitar harmonics while the loudness+clarity gates reject noise/silence.
    const counts = {};
    let bestPc = -1, bestN = 0;
    for (const p of state.pcHistory) {
      if (p < 0) continue;
      counts[p] = (counts[p] || 0) + 1;
      if (counts[p] > bestN) { bestN = counts[p]; bestPc = p; }
    }
    const ok = bestN >= VOTE_MIN;
    state.detectedPC = ok ? bestPc : -1;
    state.detectedName = ok ? window.TabParser.pcName(bestPc) : "—";
    els.detected.textContent = state.detectedName;
  }

  // ---- Backing-track audio (Web Audio synthesis, synced to the transport) ----
  function toggleAudio() {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      state.audioMaster = state.audioCtx.createGain();
      state.audioMaster.gain.value = 0.32;
      state.audioMaster.connect(state.audioCtx.destination);
    }
    state.audioOn = !state.audioOn;
    els.audio.textContent = state.audioOn ? "🔊 Audio On" : "🔈 Audio";
    els.audio.classList.toggle("active", state.audioOn);
    if (state.audioOn) {
      state.audioCtx.resume();
      state.audioPtr = audioPtrFor(songTime());
    } else {
      stopAllAudio();
    }
  }

  function audioPtrFor(t) {
    let i = 0;
    while (i < state.notes.length && state.notes[i].time < t) i++;
    return i;
  }

  function stopAllAudio() {
    if (!state.audioCtx) return;
    const now = state.audioCtx.currentTime;
    for (const s of state.audioSources) {
      try {
        s.g.gain.cancelScheduledValues(now);
        s.g.gain.setValueAtTime(0.0001, now);
        s.osc.stop(now + 0.03);
      } catch (e) { /* already stopped */ }
    }
    state.audioSources = [];
  }

  // midi pitches a timeline event should sound (low → high, with capo offset)
  function pitchesFor(ev) {
    if (ev.midis) return ev.midis.map((m) => m + state.capo).sort((a, b) => a - b);
    if (ev.isNote) return [OPEN_MIDI[ev.string] + ev.fret + state.capo];
    return ev.pcs.map((pc) => 48 + pc + state.capo).sort((a, b) => a - b); // chord-mode voicing
  }

  // Karplus-Strong plucked string: a noise burst fed through a short delay line with
  // a decaying averaging (low-pass) filter — physically models a vibrating string,
  // so it sounds like a real plucked guitar rather than a synth beep.
  function guitarBuffer(ctx, freq, dur) {
    const sr = ctx.sampleRate;
    const N = Math.max(2, Math.round(sr / freq));        // delay line = one period
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const line = new Float32Array(N);
    // pluck excitation: noise, slightly low-passed so it's warm not fizzy
    let last = 0;
    for (let i = 0; i < N; i++) { const w = Math.random() * 2 - 1; last = 0.5 * (w + last); line[i] = last; }
    // higher strings ring longer; lower strings damp a touch faster — tuned for guitar
    const decay = Math.min(0.9975, 0.994 + freq / 40000);
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const cur = line[idx];
      const nxt = line[(idx + 1) % N];
      out[i] = cur;
      line[idx] = 0.5 * (cur + nxt) * decay;             // averaging low-pass + string damping
      idx = (idx + 1) % N;
    }
    return buf;
  }

  function playPitch(when, midi) {
    const ctx = state.audioCtx;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const dur = 1.6;
    const src = ctx.createBufferSource();
    src.buffer = guitarBuffer(ctx, freq, dur);
    // body/tone shaping: roll off the very top so it reads acoustic, not brittle
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(9000, freq * 8), when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(700, freq * 2.5), when + dur); // brightness fades as it rings
    lp.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.9, when + 0.004);   // sharp pick attack
    g.gain.exponentialRampToValueAtTime(0.0006, when + dur);
    src.connect(lp); lp.connect(g); g.connect(state.audioMaster);
    src.start(when);
    src.stop(when + dur + 0.05);
    state.audioSources.push({ osc: src, g });
  }

  function scheduleAudio(t) {
    const ctx = state.audioCtx;
    if (ctx.state === "suspended") ctx.resume();
    const LOOKAHEAD = 0.12;
    while (state.audioPtr < state.notes.length && state.notes[state.audioPtr].time <= t + LOOKAHEAD) {
      const t0 = state.notes[state.audioPtr].time;
      // gather all notes sounding at this exact instant (a chord)
      const pitches = [];
      while (state.audioPtr < state.notes.length && Math.abs(state.notes[state.audioPtr].time - t0) < 1e-6) {
        pitches.push(...pitchesFor(state.notes[state.audioPtr]));
        state.audioPtr++;
      }
      pitches.sort((a, b) => a - b);
      const when = ctx.currentTime + Math.max(0, t0 - t);
      // strum simultaneous notes low→high so chords sound plucked, not blocked
      const strum = pitches.length > 1 ? 0.024 : 0;
      pitches.forEach((midi, i) => playPitch(when + i * strum, midi));
    }
    if (state.audioSources.length > 200) state.audioSources = state.audioSources.slice(-100);
  }

  // ---- Rendering ----
  function draw() {
    const W = state.W, H = state.H;
    // Reserve a right-hand panel for live chord diagrams.
    const panelW = Math.max(190, Math.min(300, W * 0.26));
    const HW = W - panelW;          // highway width
    const hitY = H - 120;
    const pxPerSec = (hitY - 40) / LEAD_SECONDS;
    const laneW = HW / LANES;
    const t = songTime();

    ctx.clearRect(0, 0, W, H);

    // lanes
    for (let i = 0; i < LANES; i++) {
      ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(i * laneW, 0, laneW, H);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.moveTo(i * laneW, 0); ctx.lineTo(i * laneW, H); ctx.stroke();
    }

    // hit line with glow
    ctx.save();
    ctx.shadowColor = "#29e0c8";
    ctx.shadowBlur = 24;
    ctx.strokeStyle = "rgba(41,224,200,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(HW, hitY); ctx.stroke();
    ctx.restore();

    // lane hit targets
    for (let i = 0; i < LANES; i++) {
      const tx = i * laneW + laneW / 2;
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.arc(tx, hitY, 22, 0, Math.PI * 2);
      ctx.fill();
      // in note mode, label each lane with its string name
      if (state.mode === "notes") {
        ctx.fillStyle = "rgba(232,238,252,0.5)";
        ctx.font = "700 14px Segoe UI, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(STRING_NAMES[i], tx, hitY + 44);
      }
    }

    // notes
    // uniform note-tile height + per-lane spacing so same-string notes that fall
    // too close together sit ADJACENT (not overlapping, not shrunk). Different-lane
    // notes at the same beat keep their true y, so real chords stay aligned.
    const noteBarH = Math.min((laneW - 16) * 0.44, 40) * 1.35;
    const laneLastY = {};                              // last drawn y per lane (time-ascending = y-descending)
    for (const n of state.notes) {
      let y = hitY - (n.time - t) * pxPerSec;
      if (y < -110 || y > H + 110) {
        if (n.flash > 0) n.flash = Math.max(0, n.flash - 0.04);
        continue;
      }
      if (n.isNote) {
        // chord notes (same beat, ≥2 strings) ALWAYS keep their true y so the chord
        // stays aligned across strings; only LONE same-string notes get nudged apart
        const prevY = laneLastY[n.lane];
        const isChord = (n.chordSize || 1) >= 2;
        if (!isChord && prevY !== undefined && prevY - y < noteBarH) y = prevY - noteBarH;
        laneLastY[n.lane] = y;
      }
      // Every note is shown individually in its lane; chords are surfaced on the
      // right panel, not collapsed on the highway.
      let cx = n.lane * laneW + laneW / 2;
      let w = laneW - 16;
      if (!n.isNote) {
        // chord blocks appear ONLY on the FRETTED strings (the finger positions —
        // e.g. C = 3 segments on A/D/B), drawn as one segment per string
        if (n._frLanes === undefined) {
          const shape = window.ChordShapes && window.ChordShapes.getChordShape(n.name);
          let lanes = null;
          if (shape) {
            lanes = shape.frets.map((f, i) => (f > 0 ? i : -1)).filter((i) => i >= 0);
            if (!lanes.length)                          // all-open chord: use played strings
              lanes = shape.frets.map((f, i) => (f >= 0 ? i : -1)).filter((i) => i >= 0);
          }
          n._frLanes = lanes && lanes.length ? lanes : [n.lane];
        }
        const lanes = n._frLanes;
        const left = lanes[0] * laneW;
        w = (lanes[lanes.length - 1] - lanes[0] + 1) * laneW - 16;
        cx = left + 8 + w / 2;                          // label centering only
      }
      // geometry per type: every note is the SAME fixed-size tile, centred on its
      // onset. Timing is conveyed by the SPACING between tiles — a longer note leaves
      // a bigger gap before the next one — not by tile size. Strum/chord stay as before.
      let top, barH, labelY, fontSize;
      if (n.isNote) {
        barH = Math.min(w * 0.44, 40) * 1.35;          // uniform size for EVERY note tile
        top = y - barH / 2;
        labelY = y;
        fontSize = Math.max(11, Math.round(Math.min(barH * 0.62, w * 0.34)));
      } else if (n.isStrum) {
        const slotPx = ((60 / bpmEff()) * (state.song.beatsPerBar || 4) /
          ((state.song.strum || []).length || 8)) * pxPerSec;
        barH = Math.min(30, slotPx * 0.7); top = y - barH / 2; labelY = y;
        fontSize = 32;
      } else {
        barH = w * 0.45; top = y - barH / 2; labelY = y;       // chords-mode chord block
        fontSize = Math.max(9, Math.round(Math.min(barH * 0.6, w * 0.34)));
      }
      const radius = Math.min(w, barH) * 0.26;
      const color = n.isNote
        ? LANE_COLORS[n.lane % LANE_COLORS.length]
        : ((state.chordColors && state.chordColors.get(n.name)) || LANE_COLORS[n.lane % LANE_COLORS.length]);

      ctx.save();
      let alpha = 1;
      if (n.judged) alpha = 0.35 + n.flash * 0.65;
      ctx.globalAlpha = alpha;

      // glow / fill
      ctx.shadowColor = n.judged ? (n.hit ? "#38ef7d" : "#ff5b6e") : color;
      ctx.shadowBlur = n.flash > 0 ? 30 : 14;
      ctx.fillStyle = n.judged ? (n.hit ? "#1c6b3a" : "#5e2230") : color;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 2;
      if (!n.isNote && n._frLanes && n._frLanes.length > 1) {
        // one segment per FRETTED string — no bar across open/muted strings
        for (const l of n._frLanes) {
          roundRect(l * laneW + 8, top, laneW - 16, barH, radius);
          ctx.fill(); ctx.stroke();
        }
      } else {
        roundRect(cx - w / 2, top, w, barH, radius);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore();

      // label: fret number (notes) or chord name (chords)
      ctx.font = `${n.isNote ? 800 : 700} ${fontSize}px Segoe UI, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // light halo so the digit reads even when tiles are tightly packed
      ctx.lineWidth = Math.max(2, fontSize * 0.18);
      const lx = n.isNote ? cx : HW / 2;               // chord names centred on screen
      ctx.strokeStyle = "rgba(0,0,0,0.85)";            // black border for readability
      ctx.strokeText(n.label, lx, labelY);
      ctx.fillStyle = n.judged ? (n.hit ? "#caffd9" : "#ffd0d6") : "#ffffff";
      ctx.fillText(n.label, lx, labelY);

      if (n.flash > 0) n.flash = Math.max(0, n.flash - 0.04);
    }

    // rising judgment texts (Perfect / Good / Late / Early / Miss) at the hit line
    {
      const now = performance.now();
      state.floaters = state.floaters.filter((f) => now - f.born < 700);
      for (const f of state.floaters) {
        const age = (now - f.born) / 700;                  // 0 → 1
        const fx = f.lane * laneW + laneW / 2;
        const fy = hitY - 34 - age * 46;
        ctx.save();
        ctx.globalAlpha = 1 - age;
        ctx.font = "800 16px Segoe UI, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.strokeText(f.text, fx, fy);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, fx, fy);
        ctx.restore();
      }
    }

    // current lyric line, synced to the chord at the hit line (bottom bar)
    {
      let cur = "", nxt = "";
      for (const ev of state.notes) {
        if (ev.lyric === undefined) break;             // note songs: no lyrics
        if (ev.time <= t + 0.05) { if (ev.lyric) cur = ev.lyric; }
        else if (ev.lyric && ev.lyric !== cur) { nxt = ev.lyric; break; }
      }
      if (cur || nxt) {
        ctx.fillStyle = "rgba(6,10,20,0.82)";
        ctx.fillRect(0, H - 52, HW, 52);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        if (cur) {
          ctx.font = "700 19px Segoe UI, sans-serif";
          ctx.fillStyle = "#e8eefc";
          ctx.fillText(cur, HW / 2, H - 34);
        }
        if (nxt) {
          ctx.font = "400 13px Segoe UI, sans-serif";
          ctx.fillStyle = "rgba(232,238,252,0.45)";
          ctx.fillText(nxt, HW / 2, H - 12);
        }
      }
    }

    // song title + progress
    if (state.title) {
      ctx.fillStyle = "rgba(232,238,252,0.6)";
      ctx.font = "600 14px Segoe UI, sans-serif";
      ctx.textAlign = "left";
      const label = state.capo ? `${state.title}   •   Capo ${state.capo}` : state.title;
      ctx.fillText(label, 16, 24);
    }

    // right-hand chord-diagram panel (drawn last so it sits above note glow)
    drawChordPanel(HW, panelW, H, hitY, t, pxPerSec);
  }

  // Right panel: a diagram for every chord currently on the highway, soonest at
  // the bottom (nearest the hit line), the active chord highlighted.
  function drawChordPanel(HW, panelW, H, hitY, t, pxPerSec) {
    const px = HW;
    ctx.fillStyle = "rgba(8,12,24,0.92)";
    ctx.fillRect(px, 0, panelW, H);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px + 0.5, 0); ctx.lineTo(px + 0.5, H); ctx.stroke();

    ctx.fillStyle = "rgba(232,238,252,0.5)";
    ctx.font = "700 12px Segoe UI, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText("ON SCREEN", px + 16, 28);

    const winStart = t - 0.25, winEnd = t + LEAD_SECONDS;   // on-screen time window

    // Collect chords currently present anywhere on screen (deduped by name).
    const present = new Map();   // name -> {active, time}
    const note = (name, time, active) => {
      const cur = present.get(name);
      if (cur) { cur.active = cur.active || active; cur.time = Math.min(cur.time, time); }
      else present.set(name, { active, time });
    };
    for (const c of (state.chords || [])) {
      const end = c.endTime != null ? c.endTime : c.time;
      if (end > winStart && c.time < winEnd) note(c.name, c.time, t >= c.time - HIT_WINDOW && t <= end + 0.05);
    }
    for (const n of state.notes) {
      if (!n.isStrum) continue;
      const y = hitY - (n.time - t) * pxPerSec;
      if (y >= 30 && y <= hitY + 22) note(n.name, n.time, Math.abs(t - n.time) <= HIT_WINDOW);
    }

    // FIXED slots: a chord keeps its slot the whole time it's on screen, so the
    // diagrams stay put (don't reflow) instead of sliding around.
    const topY = 42, bottom = 16, slotH = 162;
    const maxSlots = Math.max(1, Math.floor((H - topY - bottom) / slotH));
    if (!state.panelSlots || state.panelSlots.length !== maxSlots) {
      state.panelSlots = new Array(maxSlots).fill(null);
    }
    const slots = state.panelSlots;
    for (let i = 0; i < maxSlots; i++) if (slots[i] && !present.has(slots[i])) slots[i] = null;  // free departed
    const held = new Set(slots.filter(Boolean));
    const newcomers = [...present.keys()].filter((n) => !held.has(n))
      .sort((a, b) => present.get(a).time - present.get(b).time);
    for (const name of newcomers) { const f = slots.indexOf(null); if (f < 0) break; slots[f] = name; }

    for (let i = 0; i < maxSlots; i++) {
      const name = slots[i];
      if (!name) continue;
      drawChordDiagram(px + 20, topY + i * slotH, panelW - 40, slotH - 30, name, present.get(name).active);
    }
  }

  // A compact card for note mode: big note name + which string/fret to play.
  function drawNoteCard(x, y, w, h, n, active) {
    const accent = "#29e0c8";
    const col = LANE_COLORS[n.lane % LANE_COLORS.length];
    ctx.save();
    ctx.strokeStyle = active ? accent : "rgba(255,255,255,0.14)";
    ctx.lineWidth = active ? 2 : 1;
    if (active) { ctx.shadowColor = accent; ctx.shadowBlur = 16; }
    roundRect(x, y, w, h, 12); ctx.stroke();
    ctx.restore();

    // colored dot for the string
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x + 26, y + h / 2, 10, 0, Math.PI * 2); ctx.fill();

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.fillStyle = active ? accent : "#e8eefc";
    ctx.font = "800 26px Segoe UI, sans-serif";
    ctx.fillText(n.noteName, x + 48, y + h / 2 - 2);

    ctx.fillStyle = "rgba(232,238,252,0.6)";
    ctx.font = "600 13px Segoe UI, sans-serif";
    ctx.fillText(`${STRING_NAMES[n.string]} string · fret ${n.fret}`, x + 92, y + h / 2 - 2);
  }

  function drawChordDiagram(x, y, w, h, name, active) {
    const shape = window.ChordShapes.getChordShape(name);
    const accent = "#29e0c8";

    // highlight box for the active chord
    if (active) {
      ctx.save();
      ctx.shadowColor = accent; ctx.shadowBlur = 18;
      ctx.strokeStyle = accent; ctx.lineWidth = 2;
      roundRect(x - 8, y - 6, w + 16, h + 34, 12); ctx.stroke();
      ctx.restore();
    }

    // chord name
    ctx.fillStyle = active ? accent : "#e8eefc";
    ctx.font = "800 20px Segoe UI, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText(name, x + w / 2, y + 18);

    if (!shape) {
      ctx.fillStyle = "rgba(232,238,252,0.4)";
      ctx.font = "13px Segoe UI, sans-serif";
      ctx.fillText("(no diagram)", x + w / 2, y + 44);
      return;
    }

    const labelH = 30, markerH = 12;
    const gridLeft = x + 16, gridRight = x + w - 16;
    const gridTop = y + labelH + markerH;
    const gridBottom = y + h + 24;
    const gridW = gridRight - gridLeft;
    const gridH = gridBottom - gridTop;
    const stringGap = gridW / 5;
    const fretGap = gridH / 5;
    const base = shape.base;

    const lineCol = "rgba(232,238,252,0.55)";

    // base-fret label (for barre chords starting above the nut)
    if (base > 1) {
      ctx.fillStyle = "rgba(232,238,252,0.6)";
      ctx.font = "11px Segoe UI, sans-serif";
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillText(base + "fr", gridLeft - 4, gridTop + fretGap / 2);
    }

    // frets (horizontal)
    ctx.strokeStyle = lineCol;
    for (let f = 0; f <= 5; f++) {
      const ry = gridTop + f * fretGap;
      ctx.lineWidth = (f === 0 && base === 1) ? 4 : 1;  // thick nut at open position
      ctx.beginPath(); ctx.moveTo(gridLeft, ry); ctx.lineTo(gridRight, ry); ctx.stroke();
    }
    // strings (vertical)
    ctx.lineWidth = 1;
    for (let s = 0; s < 6; s++) {
      const cx = gridLeft + s * stringGap;
      ctx.beginPath(); ctx.moveTo(cx, gridTop); ctx.lineTo(cx, gridBottom); ctx.stroke();
    }

    // markers + finger dots
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let s = 0; s < 6; s++) {
      const cx = gridLeft + s * stringGap;
      const v = shape.frets[s];
      if (v === -1) {
        ctx.fillStyle = "rgba(232,238,252,0.55)";
        ctx.font = "12px Segoe UI, sans-serif";
        ctx.fillText("×", cx, gridTop - 7);
      } else if (v === 0) {
        ctx.strokeStyle = "rgba(232,238,252,0.6)"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, gridTop - 7, 4, 0, Math.PI * 2); ctx.stroke();
      } else {
        const rel = v - base + 1;            // 1..5 within the window
        const dy = gridTop + (rel - 0.5) * fretGap;
        ctx.fillStyle = active ? accent : "#e8eefc";
        ctx.beginPath(); ctx.arc(cx, dy, Math.min(8, stringGap * 0.34), 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- Main loop ----
  function frame() {
    pollMic();
    const now = performance.now();
    if (state.playing && state.lastFrameTs) {
      // accumulate real practice time; flush to the profile every ~10s so the
      // daily-goal ring moves while you play (not just at the end)
      state.playAccumSec += (now - state.lastFrameTs) / 1000;
      if (state.playAccumSec >= 10) flushPlayTime();
    }
    state.lastFrameTs = now;
    if (state.playing) {
      let t = songTime();
      const looping = state.loopA > 0.001 || state.loopB < 0.999;  // region narrowed?
      if (state.songLength && t >= state.loopB * state.songLength) {
        if (looping) {
          gradeLoopPass();                                         // auto speed-up check
          seekTo(state.loopA); t = songTime();                     // jump back to A
        } else {
          state.playing = false; els.play.textContent = "▶ Play";  // play-through ends
          finishRun();
        }
      }
      judge(t);
      if (state.audioOn && state.audioCtx) scheduleAudio(t);
    }
    // song-progress bar + loop markers
    if (els.progressFill) {
      const frac = state.songLength ? songTime() / state.songLength : 0;
      els.progressFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
      els.loopA.style.left = `${state.loopA * 100}%`;
      els.loopB.style.left = `${state.loopB * 100}%`;
      els.loopRegion.style.left = `${state.loopA * 100}%`;
      els.loopRegion.style.width = `${(state.loopB - state.loopA) * 100}%`;
    }
    draw();
    requestAnimationFrame(frame);
  }

  // ---- Song library ----
  function populateSongs(filter) {
    const q = (filter || "").trim().toLowerCase();
    els.songSelect.innerHTML = "";
    // show alphabetically by title, but keep each option's value = original index
    window.SONGS
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => !q || s.title.toLowerCase().includes(q))
      .sort((a, b) => a.s.title.localeCompare(b.s.title, undefined, { sensitivity: "base" }))
      .forEach(({ s, i }) => {
        const opt = document.createElement("option");
        opt.value = i;
        const hasNotes = (Array.isArray(s.notes) && s.notes.length) || (Array.isArray(s.picked) && s.picked.length);
        // songs with a note/picked track are highlighted; chord-only songs stay muted
        opt.textContent = (hasNotes ? "♪ " : "") + s.title;
        opt.style.color = hasNotes ? "#38ef7d" : "#8a96b8";
        opt.style.fontWeight = hasNotes ? "700" : "400";
        els.songSelect.appendChild(opt);
      });
  }
  function loadSongByIndex(i, opts) {
    const s = window.SONGS[i];
    if (!s) return;
    // Campaign-loaded songs are trimmed to a focused lesson segment.
    state.lessonCapSec = (opts && opts.campaign) ? 100 : null;
    try { localStorage.setItem("fretfall:lastSong", s.id); } catch (e) {}
    loadSongObject(s);
    // reflect this song's campaign step (if any) in the second dropdown
    if (window.Campaign && els.campSelect) {
      const step = window.Campaign.stepForSong(s);
      els.campSelect.value = step ? String(step.n) : "";
    }
  }

  // Show the toggle only when the song has BOTH a note track and a chord chart,
  // so you can switch between them. A `picked` track (generated arpeggio) counts.
  function updateModeButton() {
    const s = state.song || {};
    const hasNoteTrack = (s.notes && s.notes.length) || (s.picked && s.picked.length);
    const canToggle = !!(hasNoteTrack && s.text);
    els.mode.style.display = canToggle ? "" : "none";
    // when the note track is the generated arpeggio (no real notes), call it "Picked"
    const noteLabel = (!(s.notes && s.notes.length) && s.picked) ? "♪ Picked" : "♪ Notes";
    els.mode.textContent = state.mode === "notes" ? noteLabel : "▦ Chords";
    els.mode.classList.toggle("active", state.mode === "notes");
  }

  function toggleMode() {
    const s = state.song || {};
    const hasNoteTrack = (s.notes && s.notes.length) || (s.picked && s.picked.length);
    if (!(hasNoteTrack && s.text)) return;
    state.mode = state.mode === "notes" ? "chords" : "notes";
    buildCurrentTimeline();
    updateModeButton();
    resetPlayback();
  }

  // ---- Progression: playtime, goal ring, streak, toasts ----
  function flushPlayTime() {
    if (state.playAccumSec < 0.5) { state.playAccumSec = 0; return; }
    const res = window.Meta.addPlayTime(state.playAccumSec);
    state.playAccumSec = 0;
    updateGoalRing();
    if (res.goalJustMet) {
      toast(`🎯 Daily goal done — ${res.streak} day streak!`, "good");
      els.goalRing.classList.add("met");
    }
    if (res.freezeEarned) toast("🧊 Streak freeze earned — one missed day is covered.", "info");
  }

  function updateGoalRing() {
    const goal = window.Meta.profile.goalMin;
    const min = window.Meta.todayMinutes();
    const frac = Math.min(1, min / goal);
    const C = 2 * Math.PI * 18;                       // ring circumference (r=18)
    els.ringFill.style.strokeDasharray = `${C * frac} ${C}`;
    els.ringText.textContent = min >= goal ? "✓" : `${Math.floor(min)}m`;
    els.goalRing.classList.toggle("met", min >= goal);
    els.streakVal.textContent = window.Meta.profile.streak.cur;
  }

  function toast(msg, kind) {
    const el = document.createElement("div");
    el.className = "toast " + (kind || "");
    el.textContent = msg;
    els.toasts.appendChild(el);
    setTimeout(() => el.classList.add("show"), 20);
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 3600);
  }

  // ---- Riff-repeater auto speed-up ----
  // Grade each loop pass; 3 consecutive clean (≥95%) mic-scored passes bump the
  // speed 10% toward full tempo — earn your way back to 100%.
  function gradeLoopPass() {
    const played = state.played - state.passMarkPlayed;
    const hits = state.hits - state.passMarkHits;
    state.passMarkPlayed = state.played;
    state.passMarkHits = state.hits;
    if (state.audioOn || !state.micOn || played < 4) return;   // listen mode doesn't count
    if (hits / played >= 0.95) {
      state.cleanPasses += 1;
      if (window.Campaign) for (const ev of window.Campaign.onCleanPass(state.song)) campaignEvent(ev);
      if (state.cleanPasses >= 3 && state.speed < 1) {
        state.speed = Math.min(1, Math.round((state.speed + 0.1) * 20) / 20);
        state.cleanPasses = 0;
        els.speed.value = Math.round(state.speed * 100);
        els.speedVal.textContent = Math.round(state.speed * 100) + "%";
        toast(`⚡ 3 clean passes — speed up to ${Math.round(state.speed * 100)}%`, "good");
        const wasPlaying = state.playing;
        buildCurrentTimeline();
        resetPlayback();
        if (wasPlaying) togglePlay();
      } else if (state.cleanPasses > 0 && state.speed < 1) {
        toast(`Clean pass ${state.cleanPasses}/3`, "info");
      }
    } else {
      state.cleanPasses = 0;
    }
  }

  // ---- End-of-song results ----
  function runIsRecordable() {
    const fullRange = state.loopA <= 0.01 && state.loopB >= 0.99;
    return fullRange && state.micOn && !state.audioOn && state.speed >= 1;
  }

  function finishRun() {
    if (state.runShown || state.played < 5) return;
    state.runShown = true;
    flushPlayTime();
    const acc = state.played ? Math.round((100 * state.hits) / state.played) : 0;
    const run = { score: state.score, acc, maxCombo: state.maxCombo, perfects: state.perfects };
    let rec = null, badge = "";
    const recordable = runIsRecordable();
    if (recordable) {
      rec = window.Meta.recordRun(state.song, run);
      if (rec.newBestScore || rec.newBestAcc) badge = "★ NEW BEST";
    } else {
      badge = state.audioOn ? "Listen mode — not recorded"
        : state.speed < 1 ? `Practice at ${Math.round(state.speed * 100)}% — not recorded`
        : !state.micOn ? "Mic off — not recorded"
        : "Loop practice — not recorded";
    }
    // Campaign quest progress (warm-up + boss gate) for the step this song belongs to.
    if (window.Campaign) {
      for (const ev of window.Campaign.onRun(state.song, run, recordable, state.speed)) campaignEvent(ev);
    }
    showResults(run, rec, badge);
    refreshCampaignUI();
  }

  function starsMarkup(n) {
    let html = "";
    for (let i = 1; i <= 5; i++) html += `<span class="star ${i <= n ? "on" : ""}">★</span>`;
    return html;
  }

  function worstSection() {
    let worst = null;
    for (const s of state.sections) {
      if (!s.played) continue;
      const a = s.hits / s.played;
      if (!worst || a < worst.a) worst = { s, a };
    }
    return worst ? worst.s : null;
  }

  function loopSection(s) {
    if (!s || !state.songLength) return;
    state.loopA = Math.max(0, (s.t0 - 1) / state.songLength);
    state.loopB = Math.min(1, (s.t1 + 0.5) / state.songLength);
    els.resultsModal.classList.add("hidden");
    resetPlayback();
    togglePlay();
    toast("🔁 Looping section — 3 clean passes raises the speed", "info");
  }

  function showResults(run, rec, badge) {
    els.resultsTitle.textContent = state.title || "Song complete";
    els.resultsStars.innerHTML = starsMarkup(window.Meta.starsFor(run.acc));
    els.resScore.textContent = run.score.toLocaleString();
    els.resAcc.textContent = run.acc + "%";
    els.resCombo.textContent = run.maxCombo;
    els.resPerfect.textContent = run.perfects;
    els.resultsBadge.textContent = badge;
    els.resultsBadge.className = "results-badge" + (badge ? "" : " hidden") +
      (badge.startsWith("★") ? " best" : " plain");
    if (rec) {
      const b = rec.prev;
      els.resBest.textContent = b.score
        ? `Previous best: ${b.score.toLocaleString()} pts · ${b.acc}% · combo ${b.combo}   (+${rec.xpGain} XP)`
        : `First recorded run — the baseline is set. (+${rec.xpGain} XP)`;
    } else {
      const sb = window.Meta.songRec(state.song);
      els.resBest.textContent = sb && sb.best.score
        ? `Recorded best stays: ${sb.best.score.toLocaleString()} pts · ${sb.best.acc}%`
        : "Play the full song with mic scoring at 100% speed to set a record.";
    }
    // section bars — click any to loop it
    els.resSections.innerHTML = "";
    state.sections.forEach((s, i) => {
      const a = s.played ? s.hits / s.played : 0;
      const div = document.createElement("div");
      div.className = "section-bar";
      div.title = `Section ${i + 1}: ${Math.round(a * 100)}% — click to loop`;
      div.innerHTML = `<div class="section-fill" style="height:${Math.max(6, a * 100)}%;` +
        `background:${a >= 0.9 ? "var(--good)" : a >= 0.7 ? "#ffd166" : "var(--bad)"}"></div>` +
        `<span>${i + 1}</span>`;
      div.addEventListener("click", () => loopSection(s));
      els.resSections.appendChild(div);
    });
    els.resultsModal.classList.remove("hidden");
    updateGoalRing();
  }

  els.resClose.addEventListener("click", () => els.resultsModal.classList.add("hidden"));
  els.resReplay.addEventListener("click", () => {
    els.resultsModal.classList.add("hidden");
    resetPlayback(); togglePlay();
  });
  els.resLoopWorst.addEventListener("click", () => loopSection(worstSection()));

  // ---- Stats / progression modal ----
  function openStats() {
    const p = window.Meta.profile;
    const lvl = window.Meta.levelInfo();
    const next = window.Meta.nextUp();
    els.statsSummary.innerHTML =
      `<div class="stat"><div class="stat-label">Level</div><div class="stat-val">${lvl.level}</div>` +
      `<div class="xpbar"><div style="width:${Math.round((100 * lvl.into) / lvl.need)}%"></div></div></div>` +
      `<div class="stat"><div class="stat-label">Streak</div><div class="stat-val">🔥 ${p.streak.cur}</div>` +
      `<div class="stat-sub">best ${p.streak.best} · 🧊 ×${p.streak.freezes}</div></div>` +
      `<div class="stat"><div class="stat-label">Today</div><div class="stat-val">${Math.floor(window.Meta.todayMinutes())}m</div>` +
      `<div class="stat-sub">goal ${p.goalMin}m</div></div>` +
      (next ? `<div class="stat next-up"><div class="stat-label">Next up</div>` +
        `<div class="stat-val small">${next.title}</div>` +
        `<div class="stat-sub">${window.Meta.TIER_NAMES[next.tier]} · ${starsMarkup(next.stars)}</div></div>` : "");
    // calendar — last 10 weeks
    els.statsCal.innerHTML = "";
    for (const day of window.Meta.calendar(70)) {
      const el = document.createElement("div");
      el.className = "cal-day" + (day.met ? " met" : day.frozen ? " frozen" : day.min > 0 ? " some" : "");
      el.title = `${day.date}: ${Math.round(day.min)} min` + (day.frozen ? " (freeze)" : "");
      els.statsCal.appendChild(el);
    }
    // ladder — tiers with stars and a mini history sparkline
    els.statsLadder.innerHTML = "";
    const tiers = window.Meta.ladder();
    for (let t = 1; t <= 5; t++) {
      if (!tiers[t].length) continue;
      const head = document.createElement("div");
      head.className = "tier-head";
      head.textContent = `Tier ${t} — ${window.Meta.TIER_NAMES[t]}`;
      els.statsLadder.appendChild(head);
      for (const s of tiers[t]) {
        const row = document.createElement("div");
        row.className = "ladder-row" + (s.plays ? "" : " unplayed");
        const spark = s.hist.slice(-12).map((h) =>
          `<i style="height:${Math.max(8, h.acc)}%"></i>`).join("");
        row.innerHTML =
          `<span class="ladder-title">${s.title}</span>` +
          `<span class="spark">${spark}</span>` +
          `<span class="ladder-stars">${starsMarkup(s.stars)}</span>`;
        row.addEventListener("click", () => {
          els.statsModal.classList.add("hidden");
          loadSongByIndex(s.i);
          for (const o of els.songSelect.options) if (+o.value === s.i) { els.songSelect.value = s.i; break; }
        });
        els.statsLadder.appendChild(row);
      }
    }
    els.statsModal.classList.remove("hidden");
  }
  els.btnStats.addEventListener("click", openStats);
  els.statsClose.addEventListener("click", () => els.statsModal.classList.add("hidden"));

  // ---- Campaign ----
  let campViewStep = null;   // step currently shown in the card (may differ from current)

  // Second dropdown: the 10 steps, marked ✓ done / ▶ current / 🔒 locked.
  function populateCampaign() {
    if (!window.Campaign) return;
    els.campSelect.innerHTML = "";
    const cur = window.Campaign.current();
    const head = document.createElement("option");
    head.value = ""; head.textContent = "— Campaign —";
    els.campSelect.appendChild(head);
    for (const step of window.Campaign.STEPS) {
      const v = window.Campaign.view(step);
      const opt = document.createElement("option");
      opt.value = step.n;
      const mark = v.done ? "✓" : !v.unlocked ? "🔒" : step.n === cur.n ? "▶" : "•";
      opt.textContent = `${mark} ${step.n}. ${step.title}${step.boss ? " ★" : ""}`;
      opt.style.color = v.done ? "#38ef7d" : !v.unlocked ? "#5a637d" : "#e8eefc";
      els.campSelect.appendChild(opt);
    }
  }

  function openCampaignStep(step) {
    const v = window.Campaign.view(step);
    campViewStep = step;
    const song = window.SONGS[v.songIndex];
    els.campStepNum.textContent = `STEP ${step.n} / 10`;
    els.campTitle.textContent = step.title;
    els.campBoss.classList.toggle("hidden", !step.boss);
    els.campSkill.textContent = step.skill;
    els.campSong.textContent = song ? song.title : step.songId;
    els.campPlay.disabled = !v.unlocked;
    els.campPlay.textContent = v.unlocked ? "▶ Load & play" : "🔒 Locked";

    // quests
    els.campQuests.innerHTML = "";
    for (const q of v.quests) {
      const row = document.createElement("div");
      row.className = "quest-row" + (q.done ? " done" : "");
      const prog = q.target ? ` (${q.progress}/${q.target})` : "";
      row.innerHTML = `<span class="quest-check">${q.done ? "✓" : "○"}</span>` +
        `<span class="quest-desc">${q.desc}${q.done ? "" : prog}</span>`;
      els.campQuests.appendChild(row);
    }

    // lessons
    els.campLessons.innerHTML = "";
    for (const l of step.lessons) {
      const a = document.createElement("a");
      a.className = "lesson-link";
      a.href = l.url; a.target = "_blank"; a.rel = "noopener";
      a.innerHTML = `<span>▶</span> ${l.label}`;
      els.campLessons.appendChild(a);
    }

    // reward line
    els.campReward.innerHTML = v.done
      ? `<span class="reward-earned">🏅 Earned: ${v.badge} &nbsp;·&nbsp; step complete</span>`
      : `<span class="muted">Reward: 🏅 ${v.badge} badge · ${step.boss ? 500 : 250} XP · 🧊 +1 streak freeze</span>`;

    els.campPrev.disabled = step.n === 1;
    els.campNext.disabled = step.n === 10;
    els.campModal.classList.remove("hidden");
  }

  function refreshCampaignUI() {
    populateCampaign();
    if (!els.campModal.classList.contains("hidden") && campViewStep) {
      openCampaignStep(campViewStep);   // live-refresh quest ticks while the card is open
    }
    // keep the dropdown reflecting the loaded song's step, if any
    const s = window.Campaign && window.Campaign.stepForSong(state.song);
    els.campSelect.value = s ? String(s.n) : "";
  }

  // A campaign event = a quest tick or a whole step cleared. Toast it loudly.
  function campaignEvent(ev) {
    if (ev.type === "quest") {
      toast(`✅ Step ${ev.step.n}: ${ev.desc}`, "good");
    } else if (ev.type === "step") {
      toast(`🏅 Step ${ev.step.n} cleared — “${ev.badge}” earned! +${ev.xp} XP, +1 freeze`, "good");
      if (ev.step.n === 10) setTimeout(() => toast("🏔️ THE TOWER STANDS — campaign complete.", "good"), 800);
    }
    updateGoalRing();
  }

  els.campSelect.addEventListener("change", () => {
    const n = +els.campSelect.value;
    if (!n) return;
    openCampaignStep(window.Campaign.STEPS[n - 1]);
  });
  els.campClose.addEventListener("click", () => els.campModal.classList.add("hidden"));
  els.campPrev.addEventListener("click", () => {
    if (campViewStep && campViewStep.n > 1) openCampaignStep(window.Campaign.STEPS[campViewStep.n - 2]);
  });
  els.campNext.addEventListener("click", () => {
    if (campViewStep && campViewStep.n < 10) openCampaignStep(window.Campaign.STEPS[campViewStep.n]);
  });
  els.campPlay.addEventListener("click", () => {
    const v = window.Campaign.view(campViewStep);
    if (!v.unlocked || v.songIndex < 0) return;
    els.campModal.classList.add("hidden");
    loadSongByIndex(v.songIndex, { campaign: true });
    els.songSelect.value = v.songIndex;
    refreshCampaignUI();
  });

  // ---- Practice speed ----
  els.speed.addEventListener("input", () => {
    state.speed = (+els.speed.value) / 100;
    els.speedVal.textContent = els.speed.value + "%";
    state.cleanPasses = 0;
    if (state.song) { buildCurrentTimeline(); resetPlayback(); }
  });

  // ---- Wire up UI ----
  els.play.addEventListener("click", togglePlay);
  els.restart.addEventListener("click", () => {
    resetPlayback();
    if (!state.playing) togglePlay();   // restart and immediately play
  });
  els.mic.addEventListener("click", () => {
    if (state.micOn) { disableMic(); try { localStorage.setItem("fretfall:mic", "off"); } catch (e) {} }
    else { enableMic(true); try { localStorage.setItem("fretfall:mic", "on"); } catch (e) {} }
  });
  // Auto-enable the mic on the first user interaction (browsers require a gesture).
  const autoMic = () => {
    enableMic(false);
    window.removeEventListener("pointerdown", autoMic);
    window.removeEventListener("keydown", autoMic);
  };
  window.addEventListener("pointerdown", autoMic);
  window.addEventListener("keydown", autoMic);
  els.mode.addEventListener("click", toggleMode);
  els.audio.addEventListener("click", toggleAudio);

  // Draggable progress bar (click or drag to scrub through the song).
  let seeking = false;
  const fracFromEvent = (e) => {
    const r = els.progress.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };
  els.progress.addEventListener("pointerdown", (e) => {
    seeking = true;
    els.progress.setPointerCapture(e.pointerId);
    seekTo(fracFromEvent(e));
  });
  els.progress.addEventListener("pointermove", (e) => { if (seeking) seekTo(fracFromEvent(e)); });
  els.progress.addEventListener("pointerup", () => { seeking = false; });
  els.progress.addEventListener("pointercancel", () => { seeking = false; });

  // A–B loop markers: drag each to set the practice region (kept at least 3% apart).
  const GAP = 0.03;
  function dragHandle(handle, which) {
    let on = false;
    const move = (e) => {
      if (!on) return;
      let f = Math.max(0, Math.min(1, fracFromEvent(e)));
      if (which === "A") state.loopA = Math.min(f, state.loopB - GAP);
      else state.loopB = Math.max(f, state.loopA + GAP);
    };
    handle.addEventListener("pointerdown", (e) => {
      e.stopPropagation();                 // don't trigger a seek on the bar
      on = true; handle.setPointerCapture(e.pointerId); move(e);
    });
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", () => { on = false; });
    handle.addEventListener("pointercancel", () => { on = false; });
  }
  dragHandle(els.loopA, "A");
  dragHandle(els.loopB, "B");
  els.songSelect.addEventListener("change", () => {
    loadSongByIndex(+els.songSelect.value);
    els.hint.classList.add("gone");
  });
  els.bpm.addEventListener("input", () => {
    state.bpm = +els.bpm.value; els.bpmVal.textContent = els.bpm.value;
    if (state.song) { buildCurrentTimeline(); resetPlayback(); }
  });

  // Spacebar = play/pause (ignore when focused in the song menu or a modal is up)
  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      els.resultsModal.classList.add("hidden");
      els.statsModal.classList.add("hidden");
      els.campModal.classList.add("hidden");
      return;
    }
    const modalOpen = !els.resultsModal.classList.contains("hidden") ||
      !els.statsModal.classList.contains("hidden") ||
      !els.campModal.classList.contains("hidden");
    if (e.code === "Space" && e.target.tagName !== "SELECT" && !modalOpen) {
      e.preventDefault(); togglePlay();
    }
  });

  // Bank any un-flushed practice minutes when the tab closes.
  window.addEventListener("beforeunload", flushPlayTime);

  const searchEl = document.getElementById("songSearch");
  if (searchEl) searchEl.addEventListener("input", () => {
    // filter the dropdown only — the user picks from the list themselves
    const cur = els.songSelect.value;
    populateSongs(searchEl.value);
    // keep the current song selected if it survived the filter
    for (const o of els.songSelect.options) if (o.value === cur) { els.songSelect.value = cur; break; }
  });

  // ---- Boot ----
  resize();
  populateSongs();
  // mic is ON by default unless the user explicitly disabled it
  try {
    if (localStorage.getItem("fretfall:mic") !== "off") enableMic(false);
  } catch (e) {}
  // Resume whatever song was playing last (falls back to the first song).
  let bootIdx = 0;
  try {
    const last = localStorage.getItem("fretfall:lastSong");
    const li = window.SONGS.findIndex((s) => s.id === last);
    if (li >= 0) bootIdx = li;
  } catch (e) {}
  loadSongByIndex(bootIdx);
  els.songSelect.value = bootIdx;
  els.hint.classList.remove("gone"); // keep hint until they interact
  updateGoalRing();
  populateCampaign();
  requestAnimationFrame(frame);
})();
