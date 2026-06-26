// app.js — FretFall main application & game loop.
(function () {
  const $ = (id) => document.getElementById(id);

  // ---- DOM ----
  const canvas = $("highway");
  const ctx = canvas.getContext("2d");
  const els = {
    play: $("btnPlay"), restart: $("btnRestart"), mic: $("btnMic"),
    songSelect: $("songSelect"),
    bpm: $("bpm"), bpmVal: $("bpmVal"),
    bpc: $("bpc"), bpcVal: $("bpcVal"),
    score: $("score"), combo: $("combo"), detected: $("detected"),
    hint: $("hint"),
  };

  // ---- State ----
  const state = {
    notes: [],          // {time, name, pcs, root, lane, judged, hit}
    bpm: 90,
    beatsPerChord: 2,
    capo: 0,            // capo fret — shifts matching pitch up by this many semitones
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
  };

  // ---- Layout constants ----
  const LEAD_SECONDS = 3;       // how far ahead a note is visible above hit line
  const HIT_WINDOW = 0.28;      // +/- seconds counted as a hit
  const LANES = 6;
  const LANE_COLORS = ["#29e0c8", "#ff4d8d", "#ffd166", "#7c5cff", "#38ef7d", "#ff8e3c"];

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

  // ---- Build the timeline from parsed chords ----
  function buildTimeline(chords) {
    const secPerBeat = 60 / state.bpm;
    const step = secPerBeat * state.beatsPerChord;
    state.notes = chords.map((c, i) => ({
      ...c,
      time: LEAD_SECONDS + i * step,
      lane: c.root % LANES,
      judged: false,
      hit: false,
      flash: 0,
    }));
    state.songLength = state.notes.length
      ? state.notes[state.notes.length - 1].time + LEAD_SECONDS
      : 0;
  }

  function loadSong(text, title, bpm, bpc, capo) {
    const parsed = window.TabParser.parseTab(text);
    if (!parsed.chords.length) {
      alert("No chords detected in that text. Make sure chord lines like 'G  D  Em  C' are present.");
      return false;
    }
    if (bpm) { state.bpm = bpm; els.bpm.value = bpm; els.bpmVal.textContent = bpm; }
    if (bpc) { state.beatsPerChord = bpc; els.bpc.value = bpc; els.bpcVal.textContent = bpc; }
    state.capo = capo || 0;
    buildTimeline(parsed.chords);
    state.title = title || "Untitled";
    resetPlayback();
    els.hint.classList.add("gone");
    return true;
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

  function pollMic() {
    if (!state.micOn) return;
    const { freq } = state.detector.detect();
    if (freq > 0) {
      state.detectedPC = window.freqToPitchClass(freq);
      state.detectedName = window.TabParser.pcName(state.detectedPC);
    } else {
      state.detectedPC = -1;
      state.detectedName = "—";
    }
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
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      ctx.beginPath();
      ctx.arc(i * laneW + laneW / 2, hitY, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // notes
    for (const n of state.notes) {
      const y = hitY - (n.time - t) * pxPerSec;
      if (y < -60 || y > H + 60) {
        if (n.flash > 0) n.flash = Math.max(0, n.flash - 0.04);
        continue;
      }
      const cx = n.lane * laneW + laneW / 2;
      const w = Math.min(laneW - 18, 120);
      const h = 40;
      const color = LANE_COLORS[n.lane % LANE_COLORS.length];

      ctx.save();
      let alpha = 1;
      if (n.judged) alpha = 0.35 + n.flash * 0.65;
      ctx.globalAlpha = alpha;

      // glow / fill
      ctx.shadowColor = n.judged ? (n.hit ? "#38ef7d" : "#ff5b6e") : color;
      ctx.shadowBlur = n.flash > 0 ? 30 : 14;
      ctx.fillStyle = n.judged ? (n.hit ? "#1c6b3a" : "#5e2230") : color;
      roundRect(cx - w / 2, y - h / 2, w, h, 10);
      ctx.fill();
      ctx.restore();

      // chord label
      ctx.fillStyle = n.judged && !n.hit ? "#ffb3bd" : "#04121a";
      ctx.font = "700 18px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = n.judged ? (n.hit ? "#caffd9" : "#ffd0d6") : "#04121a";
      ctx.fillText(n.name, cx, y);

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
    ctx.fillText("CHORDS ON SCREEN", px + 16, 28);

    // collect visible chords
    const vis = [];
    for (const n of state.notes) {
      const y = hitY - (n.time - t) * pxPerSec;
      if (y >= 30 && y <= hitY + 22) {
        vis.push({ n, active: Math.abs(t - n.time) <= HIT_WINDOW });
      }
    }
    vis.sort((a, b) => a.n.time - b.n.time); // soonest first
    // collapse consecutive identical chords
    const list = [];
    for (const v of vis) {
      const prev = list[list.length - 1];
      if (prev && prev.n.name === v.n.name) { prev.active = prev.active || v.active; continue; }
      list.push(v);
    }

    const top = 42, bottom = 16, slotH = 172;
    const maxSlots = Math.max(1, Math.floor((H - top - bottom) / slotH));
    const dw = panelW - 40, dh = slotH - 36;
    list.slice(0, maxSlots).forEach((v, idx) => {
      const y0 = H - bottom - (idx + 1) * slotH + 14;   // idx 0 -> bottom
      drawChordDiagram(px + 20, y0, dw, dh, v.n.name, v.active);
    });
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
    loadSong(s.text, s.title, s.bpm, s.beatsPerChord, s.capo);
  }

  // ---- Wire up UI ----
  els.play.addEventListener("click", togglePlay);
  els.restart.addEventListener("click", resetPlayback);
  els.mic.addEventListener("click", toggleMic);
  els.songSelect.addEventListener("change", () => {
    loadSongByIndex(+els.songSelect.value);
    els.hint.classList.add("gone");
  });
  els.bpm.addEventListener("input", () => {
    state.bpm = +els.bpm.value; els.bpmVal.textContent = els.bpm.value;
    if (state.notes.length) { rebuildKeepingChords(); }
  });
  els.bpc.addEventListener("input", () => {
    state.beatsPerChord = +els.bpc.value; els.bpcVal.textContent = els.bpc.value;
    if (state.notes.length) { rebuildKeepingChords(); }
  });
  function rebuildKeepingChords() {
    const chords = state.notes.map((n) => ({ name: n.name, pcs: n.pcs, root: n.root }));
    buildTimeline(chords);
    resetPlayback();
  }

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
