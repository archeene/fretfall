// app.js — FretFall main application & game loop.
(function () {
  const $ = (id) => document.getElementById(id);

  // ---- DOM ----
  const canvas = $("highway");
  const ctx = canvas.getContext("2d");
  const els = {
    play: $("btnPlay"), restart: $("btnRestart"), mic: $("btnMic"),
    mode: $("btnMode"), songSelect: $("songSelect"),
    bpm: $("bpm"), bpmVal: $("bpmVal"),
    bpc: $("bpc"), bpcVal: $("bpcVal"),
    score: $("score"), combo: $("combo"), detected: $("detected"),
    hint: $("hint"), progressFill: $("progressFill"),
  };

  // ---- State ----
  const state = {
    notes: [],          // {time, name, pcs, root, lane, judged, hit}
    bpm: 90,
    beatsPerChord: 2,
    capo: 0,            // capo fret — shifts matching pitch up by this many semitones
    mode: "chords",     // "chords" | "notes"
    song: null,         // raw song object currently loaded
    playing: false,
    startClock: 0,      // performance.now() at song t=0
    pausedAt: 0,        // song-time when paused
    score: 0,
    combo: 0,
    maxCombo: 0,
    detector: null,
    micOn: false,
    detectedPC: -1,
    detectedName: "—",
    pcHistory: [],      // recent raw pitch classes, for stability gating
  };

  // ---- Layout constants ----
  const LEAD_SECONDS = 3;       // how far ahead a note is visible above hit line
  const HIT_WINDOW = 0.28;      // +/- seconds counted as a hit
  const LANES = 6;
  const LANE_COLORS = ["#29e0c8", "#ff4d8d", "#ffd166", "#7c5cff", "#38ef7d", "#ff8e3c"];

  // Standard tuning. Index 0 = low E (6th string) … 5 = high e (1st string).
  const OPEN_MIDI = [40, 45, 50, 55, 59, 64];     // E2 A2 D3 G3 B3 E4
  const STRING_NAMES = ["E", "A", "D", "G", "B", "e"];
  const PC_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const midiToPc = (m) => ((m % 12) + 12) % 12;
  const midiToName = (m) => PC_NAMES[midiToPc(m)];

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
  function buildChordTimeline(chords) {
    const step = (60 / state.bpm) * state.beatsPerChord;
    state.notes = chords.map((c, i) => ({
      isNote: false,
      label: c.name,
      pcs: c.pcs,
      time: LEAD_SECONDS + i * step,
      lane: c.root % LANES,
      judged: false, hit: false, flash: 0,
    }));
    finishTimeline();
  }

  // ---- Build an individual-NOTE timeline from tab (string/fret events) ----
  // Each source note is {b, s, f}: b = eighth-note index, s = string (0=lowE),
  // f = fret. Lane = string; pitch class derived from tuning.
  function buildNoteTimeline(song) {
    const eighth = (60 / state.bpm) / 2;   // 6/8 feel: count in eighth notes
    state.notes = song.notes.map((n) => {
      const midi = OPEN_MIDI[n.s] + n.f;
      return {
        isNote: true,
        label: String(n.f),
        pc: midiToPc(midi),
        pcs: [midiToPc(midi)],
        string: n.s,
        fret: n.f,
        noteName: midiToName(midi),
        time: LEAD_SECONDS + n.b * eighth,
        lane: n.s,
        judged: false, hit: false, flash: 0,
      };
    });
    finishTimeline();
  }

  function finishTimeline() {
    state.songLength = state.notes.length
      ? state.notes[state.notes.length - 1].time + LEAD_SECONDS
      : 0;
  }

  function buildCurrentTimeline() {
    const s = state.song;
    if (state.mode === "notes" && s.notes && s.notes.length) {
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
    if (s.beatsPerChord) { state.beatsPerChord = s.beatsPerChord; els.bpc.value = s.beatsPerChord; els.bpcVal.textContent = s.beatsPerChord; }
    state.capo = s.capo || 0;
    // fall back to chords if this song has no note track
    if (state.mode === "notes" && !(s.notes && s.notes.length)) state.mode = "chords";
    buildCurrentTimeline();
    updateModeButton();
    resetPlayback();
    els.hint.classList.add("gone");
  }

  function resetPlayback() {
    state.playing = false;
    state.pausedAt = 0;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.notes.forEach((n) => { n.judged = false; n.hit = false; n.flash = 0; });
    els.play.textContent = "▶ Play";
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
    } else {
      state.startClock = performance.now() - state.pausedAt * 1000;
      state.playing = true;
      els.play.textContent = "⏸ Pause";
      els.hint.classList.add("gone");
    }
  }

  // ---- Scoring ----
  function judge(t) {
    for (const n of state.notes) {
      if (n.judged) continue;
      // Missed window entirely
      if (t > n.time + HIT_WINDOW) {
        n.judged = true; n.hit = false;
        state.combo = 0;
        n.flash = 1;
        updateHud();
        continue;
      }
      // Inside window and player is sounding a matching tone
      if (Math.abs(t - n.time) <= HIT_WINDOW && state.detectedPC >= 0) {
        // With a capo, the fingered shape sounds `capo` semitones higher than written.
        if (n.pcs.some((pc) => (pc + state.capo) % 12 === state.detectedPC)) {
          n.judged = true; n.hit = true; n.flash = 1;
          const closeness = 1 - Math.abs(t - n.time) / HIT_WINDOW;
          state.score += Math.round(50 + 50 * closeness + state.combo * 2);
          state.combo += 1;
          state.maxCombo = Math.max(state.maxCombo, state.combo);
          // Double-stops: notes struck together count once — credit the siblings.
          if (n.isNote) {
            for (const m of state.notes) {
              if (!m.judged && m.isNote && Math.abs(m.time - n.time) < 0.001) {
                m.judged = true; m.hit = true; m.flash = 1;
              }
            }
          }
          updateHud();
        }
      }
    }
  }

  function updateHud() {
    els.score.textContent = state.score;
    els.combo.textContent = state.combo;
    els.detected.textContent = state.detectedName;
  }

  // ---- Microphone ----
  async function toggleMic() {
    if (state.micOn) return;
    try {
      state.detector = new window.PitchDetector();
      await state.detector.start();
      state.micOn = true;
      els.mic.textContent = "🎤 Mic On";
      els.mic.classList.add("active");
    } catch (e) {
      alert("Could not access microphone: " + e.message +
        "\n\nTip: run via the bundled launcher (http://localhost) so the browser allows mic access.");
    }
  }

  const STABLE_FRAMES = 3;   // a note must hold this many frames (~50ms) to count
  function pollMic() {
    if (!state.micOn) return;
    const { freq } = state.detector.detect();
    const raw = freq > 0 ? window.freqToPitchClass(freq) : -1;

    state.pcHistory.push(raw);
    if (state.pcHistory.length > STABLE_FRAMES) state.pcHistory.shift();

    // Confirm a pitch only when the last few frames all agree on a valid note.
    // This, with the detector's loudness+clarity gates, rejects noise/silence.
    const stable = state.pcHistory.length === STABLE_FRAMES &&
      raw >= 0 && state.pcHistory.every((p) => p === raw);

    state.detectedPC = stable ? raw : -1;
    state.detectedName = stable ? window.TabParser.pcName(raw) : "—";
    els.detected.textContent = state.detectedName;
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
      const cx = n.lane * laneW + laneW / 2;
      // Fill the lane width; height scales proportionally. In note mode, cap the
      // height to the note spacing so consecutive same-string notes don't overlap.
      const w = laneW - 16;
      let h = w * 0.45;
      if (n.isNote) {
        const spacingPx = ((60 / state.bpm) / 2) * pxPerSec; // one eighth-note gap
        h = Math.min(w * 0.55, spacingPx * 0.86);
      }
      const radius = Math.min(w, h) * 0.26;
      const fontSize = Math.round(Math.min(h * 0.55, w * 0.34));
      const color = LANE_COLORS[n.lane % LANE_COLORS.length];

      ctx.save();
      let alpha = 1;
      if (n.judged) alpha = 0.35 + n.flash * 0.65;
      ctx.globalAlpha = alpha;

      // glow / fill
      ctx.shadowColor = n.judged ? (n.hit ? "#38ef7d" : "#ff5b6e") : color;
      ctx.shadowBlur = n.flash > 0 ? 30 : 14;
      ctx.fillStyle = n.judged ? (n.hit ? "#1c6b3a" : "#5e2230") : color;
      roundRect(cx - w / 2, y - h / 2, w, h, radius);
      ctx.fill();
      ctx.restore();

      // label: fret number (notes) or chord name (chords)
      ctx.font = `${n.isNote ? 800 : 700} ${fontSize}px Segoe UI, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = n.judged ? (n.hit ? "#caffd9" : "#ffd0d6") : "#04121a";
      ctx.fillText(n.label, cx, y);

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

    const notesMode = state.mode === "notes";
    ctx.fillStyle = "rgba(232,238,252,0.5)";
    ctx.font = "700 12px Segoe UI, sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
    ctx.fillText(notesMode ? "NOTES ON SCREEN" : "CHORDS ON SCREEN", px + 16, 28);

    // collect visible events, soonest first
    const vis = [];
    for (const n of state.notes) {
      const y = hitY - (n.time - t) * pxPerSec;
      if (y >= 30 && y <= hitY + 22) vis.push({ n, active: Math.abs(t - n.time) <= HIT_WINDOW });
    }
    vis.sort((a, b) => a.n.time - b.n.time);

    // De-duplicate so each distinct chord/note appears only once on the panel,
    // keeping the soonest instance and OR-ing the "active" flag.
    const byKey = new Map();
    for (const v of vis) {
      const key = notesMode ? `${v.n.string}:${v.n.fret}` : v.n.label;
      if (byKey.has(key)) { byKey.get(key).active = byKey.get(key).active || v.active; }
      else byKey.set(key, v);
    }
    const list = [...byKey.values()];

    const top = 42, bottom = 16;
    const slotH = notesMode ? 96 : 172;
    const maxSlots = Math.max(1, Math.floor((H - top - bottom) / slotH));
    list.slice(0, maxSlots).forEach((v, idx) => {
      const y0 = H - bottom - (idx + 1) * slotH + 14;   // idx 0 (soonest) -> bottom
      if (notesMode) drawNoteCard(px + 20, y0, panelW - 40, slotH - 18, v.n, v.active);
      else drawChordDiagram(px + 20, y0, panelW - 40, slotH - 36, v.n.label, v.active);
    });
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
      const t = songTime();
      judge(t);
      if (t > state.songLength) { // song finished
        state.playing = false;
        els.play.textContent = "▶ Play";
      }
    }
    // song-progress bar
    if (els.progressFill) {
      const frac = state.songLength ? songTime() / state.songLength : 0;
      els.progressFill.style.width = `${Math.max(0, Math.min(1, frac)) * 100}%`;
    }
    draw();
    requestAnimationFrame(frame);
  }

  // ---- Song library ----
  function populateSongs() {
    els.songSelect.innerHTML = "";
    window.SONGS.forEach((s, i) => {
      const opt = document.createElement("option");
      opt.value = i;
      opt.textContent = s.title;
      els.songSelect.appendChild(opt);
    });
  }
  function loadSongByIndex(i) {
    const s = window.SONGS[i];
    if (!s) return;
    loadSongObject(s);
  }

  // Show/enable the Notes/Chords toggle only when the song has a note track.
  function updateModeButton() {
    const hasNotes = !!(state.song && state.song.notes && state.song.notes.length);
    els.mode.style.display = hasNotes ? "" : "none";
    els.mode.textContent = state.mode === "notes" ? "♪ Notes" : "▦ Chords";
    els.mode.classList.toggle("active", state.mode === "notes");
  }

  function toggleMode() {
    if (!(state.song && state.song.notes && state.song.notes.length)) return;
    state.mode = state.mode === "notes" ? "chords" : "notes";
    buildCurrentTimeline();
    updateModeButton();
    resetPlayback();
  }

  // ---- Wire up UI ----
  els.play.addEventListener("click", togglePlay);
  els.restart.addEventListener("click", resetPlayback);
  els.mic.addEventListener("click", toggleMic);
  els.mode.addEventListener("click", toggleMode);
  els.songSelect.addEventListener("change", () => {
    loadSongByIndex(+els.songSelect.value);
    els.hint.classList.add("gone");
  });
  els.bpm.addEventListener("input", () => {
    state.bpm = +els.bpm.value; els.bpmVal.textContent = els.bpm.value;
    if (state.song) { buildCurrentTimeline(); resetPlayback(); }
  });
  els.bpc.addEventListener("input", () => {
    state.beatsPerChord = +els.bpc.value; els.bpcVal.textContent = els.bpc.value;
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
