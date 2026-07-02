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
  };

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
    const secPerBar = (60 / state.bpm) * beatsPerBar;
    const secPerSlot = secPerBar / strum.length;
    const evs = [];
    let t = LEAD_SECONDS;
    for (const c of chords) {
      for (let bar = 0; bar < chordBars; bar++) {
        for (let i = 0; i < strum.length; i++) {
          const tok = strum[i];
          if (tok === "-" || tok === ".") continue;      // rest = no strum
          evs.push({
            isNote: false, isStrum: true, name: c.name, label: c.name,
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
    const eighth = (60 / state.bpm) / 2;   // 6/8 feel: count in eighth notes
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
    state.songLength = state.notes.length
      ? state.notes[state.notes.length - 1].time + LEAD_SECONDS
      : 0;
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
  function judge(t) {
    for (const n of state.notes) {
      if (n.judged) continue;
      // Backing track on = the app is sounding every correct note itself, so credit
      // each note as it crosses the line (mic re-detection of the synth is lossy and
      // can't hit 100%). Mic scoring still applies when audio is off.
      if (state.audioOn && t >= n.time && t <= n.time + HIT_WINDOW) {
        n.judged = true; n.hit = true; n.flash = 1;
        state.hits++; state.played++;
        state.combo += 1; state.maxCombo = Math.max(state.maxCombo, state.combo);
        state.score += 50 + state.combo * 2;
        updateHud();
        continue;
      }
      // Missed window entirely
      if (t > n.time + HIT_WINDOW) {
        n.judged = true; n.hit = false;
        state.combo = 0;
        state.played++;
        n.flash = 1;
        updateHud();
        continue;
      }
      // Inside window and player is sounding a matching tone
      if (Math.abs(t - n.time) <= HIT_WINDOW && state.detectedPC >= 0) {
        // With a capo, the fingered shape sounds `capo` semitones higher than written.
        if (n.pcs.some((pc) => (pc + state.capo) % 12 === state.detectedPC)) {
          n.judged = true; n.hit = true; n.flash = 1;
          state.hits++; state.played++;
          const closeness = 1 - Math.abs(t - n.time) / HIT_WINDOW;
          state.score += Math.round(50 + 50 * closeness + state.combo * 2);
          state.combo += 1;
          state.maxCombo = Math.max(state.maxCombo, state.combo);
          // Double-stops: notes struck together count once — credit the siblings.
          if (n.isNote) {
            for (const m of state.notes) {
              if (!m.judged && m.isNote && Math.abs(m.time - n.time) < 0.001) {
                m.judged = true; m.hit = true; m.flash = 1;
                state.hits++; state.played++;
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
      state.audioMaster.gain.value = 0.22;
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

  function playPitch(when, midi) {
    const ctx = state.audioCtx;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const dur = 0.8;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = Math.min(5000, freq * 6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.6, when + 0.006);          // pluck attack
    g.gain.exponentialRampToValueAtTime(0.0008, when + dur);     // decay
    osc.connect(lp); lp.connect(g); g.connect(state.audioMaster);
    osc.start(when);
    osc.stop(when + dur + 0.05);
    state.audioSources.push({ osc, g });
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
    for (const n of state.notes) {
      const y = hitY - (n.time - t) * pxPerSec;
      if (y < -110 || y > H + 110) {
        if (n.flash > 0) n.flash = Math.max(0, n.flash - 0.04);
        continue;
      }
      // Every note is shown individually in its lane; chords are surfaced on the
      // right panel, not collapsed on the highway.
      const cx = n.lane * laneW + laneW / 2;
      const w = laneW - 16;
      // geometry per type: every note is the SAME fixed-size tile, centred on its
      // onset. Timing is conveyed by the SPACING between tiles — a longer note leaves
      // a bigger gap before the next one — not by tile size. Strum/chord stay as before.
      let top, barH, labelY, fontSize;
      if (n.isNote) {
        const inChord = (n.chordSize || 1) >= 2;
        barH = Math.min(w * 0.44, 40) * (inChord ? 1.35 : 1); // chords render larger
        top = y - barH / 2;
        labelY = y;
        fontSize = Math.max(11, Math.round(Math.min(barH * 0.62, w * 0.34)));
        // bridge band across the chord's strings (once, from the anchor note)
        if (n.chordAnchor && n.chordHi > n.chordLo) {
          const x0 = n.chordLo * laneW + 8, x1 = (n.chordHi + 1) * laneW - 8;
          ctx.save();
          ctx.globalAlpha = n.judged ? 0.15 : 0.3;
          ctx.fillStyle = "#ffffff";
          roundRect(x0, y - barH * 0.36, x1 - x0, barH * 0.72, barH * 0.3);
          ctx.fill();
          ctx.restore();
        }
      } else if (n.isStrum) {
        const slotPx = ((60 / state.bpm) * (state.song.beatsPerBar || 4) /
          ((state.song.strum || []).length || 8)) * pxPerSec;
        barH = Math.min(30, slotPx * 0.7); top = y - barH / 2; labelY = y;
        fontSize = 22;
      } else {
        barH = w * 0.45; top = y - barH / 2; labelY = y;       // chords-mode chord block
        fontSize = Math.max(9, Math.round(Math.min(barH * 0.6, w * 0.34)));
      }
      const radius = Math.min(w, barH) * 0.26;
      const color = LANE_COLORS[n.lane % LANE_COLORS.length];

      ctx.save();
      let alpha = 1;
      if (n.judged) alpha = 0.35 + n.flash * 0.65;
      ctx.globalAlpha = alpha;

      // glow / fill
      ctx.shadowColor = n.judged ? (n.hit ? "#38ef7d" : "#ff5b6e") : color;
      ctx.shadowBlur = n.flash > 0 ? 30 : 14;
      ctx.fillStyle = n.judged ? (n.hit ? "#1c6b3a" : "#5e2230") : color;
      roundRect(cx - w / 2, top, w, barH, radius);
      ctx.fill();
      ctx.restore();

      // label: fret number (notes) or chord name (chords)
      ctx.font = `${n.isNote ? 800 : 700} ${fontSize}px Segoe UI, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // light halo so the digit reads even when tiles are tightly packed
      ctx.lineWidth = Math.max(2, fontSize * 0.18);
      ctx.strokeStyle = n.judged ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.55)";
      ctx.strokeText(n.label, cx, labelY);
      ctx.fillStyle = n.judged ? (n.hit ? "#caffd9" : "#ffd0d6") : "#04121a";
      ctx.fillText(n.label, cx, labelY);

      if (n.flash > 0) n.flash = Math.max(0, n.flash - 0.04);
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
    if (state.playing) {
      let t = songTime();
      const looping = state.loopA > 0.001 || state.loopB < 0.999;  // region narrowed?
      if (state.songLength && t >= state.loopB * state.songLength) {
        if (looping) { seekTo(state.loopA); t = songTime(); }      // jump back to A
        else { state.playing = false; els.play.textContent = "▶ Play"; }  // play-through ends
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
  function populateSongs() {
    els.songSelect.innerHTML = "";
    // show alphabetically by title, but keep each option's value = original index
    window.SONGS
      .map((s, i) => ({ s, i }))
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
  function loadSongByIndex(i) {
    const s = window.SONGS[i];
    if (!s) return;
    loadSongObject(s);
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

  // ---- Wire up UI ----
  els.play.addEventListener("click", togglePlay);
  els.restart.addEventListener("click", () => {
    resetPlayback();
    if (!state.playing) togglePlay();   // restart and immediately play
  });
  els.mic.addEventListener("click", () => { if (state.micOn) disableMic(); else enableMic(true); });
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

  // Spacebar = play/pause (ignore when focused in the song menu)
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target.tagName !== "SELECT") {
      e.preventDefault(); togglePlay();
    }
  });

  // ---- Boot ----
  resize();
  populateSongs();
  // Load the default (first) song so users can just hit Play.
  loadSongByIndex(0);
  els.songSelect.value = 0;
  els.hint.classList.remove("gone"); // keep hint until they interact
  requestAnimationFrame(frame);
})();
