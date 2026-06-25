// app.js — FretFall main application & game loop.
(function () {
  const $ = (id) => document.getElementById(id);

  // ---- DOM ----
  const canvas = $("highway");
  const ctx = canvas.getContext("2d");
  const els = {
    play: $("btnPlay"), restart: $("btnRestart"), mic: $("btnMic"),
    load: $("btnLoad"), bpm: $("bpm"), bpmVal: $("bpmVal"),
    bpc: $("bpc"), bpcVal: $("bpcVal"),
    score: $("score"), combo: $("combo"), detected: $("detected"),
    hint: $("hint"), modal: $("modal"), tabInput: $("tabInput"),
    songTitle: $("songTitle"), sample: $("btnSample"),
    cancel: $("btnCancel"), import: $("btnImport"),
  };

  // ---- State ----
  const state = {
    notes: [],          // {time, name, pcs, root, lane, judged, hit}
    bpm: 90,
    beatsPerChord: 2,
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

  function loadSong(text, title, bpm, bpc) {
    const parsed = window.TabParser.parseTab(text);
    if (!parsed.chords.length) {
      alert("No chords detected in that text. Make sure chord lines like 'G  D  Em  C' are present.");
      return false;
    }
    if (bpm) { state.bpm = bpm; els.bpm.value = bpm; els.bpmVal.textContent = bpm; }
    if (bpc) { state.beatsPerChord = bpc; els.bpc.value = bpc; els.bpcVal.textContent = bpc; }
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
    if (!state.notes.length) { openModal(); return; }
    if (state.playing) {
      state.pausedAt = songTime();
      state.playing = false;
      els.play.textContent = "▶ Play";
    } else {
      state.startClock = performance.now() - state.pausedAt * 1000;
      state.playing = true;
      els.play.textContent = "⏸ Pause";
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
        if (n.pcs.includes(state.detectedPC)) {
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
    const hitY = H - 120;
    const pxPerSec = (hitY - 40) / LEAD_SECONDS;
    const laneW = W / LANES;
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
    ctx.beginPath(); ctx.moveTo(0, hitY); ctx.lineTo(W, hitY); ctx.stroke();
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
      ctx.fillText(state.title, 16, 24);
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

  // ---- Modal ----
  function openModal() { els.modal.classList.remove("hidden"); els.tabInput.focus(); }
  function closeModal() { els.modal.classList.add("hidden"); }

  // ---- Wire up UI ----
  els.play.addEventListener("click", togglePlay);
  els.restart.addEventListener("click", resetPlayback);
  els.mic.addEventListener("click", toggleMic);
  els.load.addEventListener("click", openModal);
  els.cancel.addEventListener("click", closeModal);
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

  els.sample.addEventListener("click", () => {
    const s = window.SAMPLE_SONGS["dancing-in-the-dark"];
    els.tabInput.value = s.text;
    els.songTitle.value = s.title;
    els.tabInput.dataset.bpm = s.bpm;
    els.tabInput.dataset.bpc = s.beatsPerChord;
  });

  els.import.addEventListener("click", () => {
    const text = els.tabInput.value.trim();
    if (!text) { alert("Paste some chords first, or click 'Load bundled sample'."); return; }
    const bpm = +els.tabInput.dataset.bpm || 0;
    const bpc = +els.tabInput.dataset.bpc || 0;
    if (loadSong(text, els.songTitle.value, bpm, bpc)) closeModal();
  });

  // Spacebar = play/pause
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && els.modal.classList.contains("hidden")) {
      e.preventDefault(); togglePlay();
    }
  });

  // ---- Boot ----
  resize();
  // Pre-load the sample so first-time users can just hit Play.
  (function preload() {
    const s = window.SAMPLE_SONGS["dancing-in-the-dark"];
    loadSong(s.text, s.title, s.bpm, s.beatsPerChord);
    els.hint.classList.remove("gone"); // keep hint until they interact
  })();
  requestAnimationFrame(frame);
})();
