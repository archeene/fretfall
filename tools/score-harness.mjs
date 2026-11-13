// Usage: serve the app (python3 -m http.server 8765 in the repo root), then
// node tools/score-harness.mjs <songId> <seconds> [scenario,list]
// Scenarios: correct jitter hold wrong late single noise mute1 offfret. DUMP=<dir> writes raw peaks.
// Headless strict-scoring harness: synthesizes Karplus-Strong guitar strums for
// a scenario, feeds them as the "mic", plays the song and reports accuracy.
import { createRequire } from "module";
const require = createRequire("/home/archeene/.velocity-gads/node_modules/");
const { chromium } = require("playwright-core");
const SONG = process.argv[2] || "im-yours-jason-mraz";
const SECS = +(process.argv[3] || 30);
const scenarios = (process.argv[4] || "correct,jitter,hold,wrong,late,single,noise").split(",");

const init = () => {
  const ctx = new AudioContext({ sampleRate: 48000 });
  const dest = ctx.createMediaStreamDestination();
  navigator.mediaDevices.getUserMedia = async () => dest.stream;
  const OPEN = [40, 45, 50, 55, 59, 64];
  // Karplus-Strong pluck into buf at sample offset, cutting that string's previous ring.
  function pluck(buf, start, midi, amp, sr, stringEnd) {
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const N = Math.round(sr / f);
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * amp;
    const len = Math.min(buf.length - start, stringEnd - start, sr * 3);
    let p = 0;
    for (let i = 0; i < len; i++) {
      const v = ring[p];
      const nx = ring[(p + 1) % N];
      ring[p] = 0.996 * 0.5 * (v + nx);
      buf[start + i] += v;
      p = (p + 1) % N;
    }
  }
  window.__fake = {
    ctx,
    async run(events, opts) {
      const sr = 48000;
      const total = Math.ceil((opts.secs + 1) * sr);
      const buf = new Float32Array(total);
      // per string pluck list to compute cut points
      const plucks = [[], [], [], [], [], []];
      for (const e of events) {
        if (e.t < 0 || e.t > opts.secs) continue;
        const shape = window.ChordShapes.getChordShape(e.name);
        if (!shape) continue;
        const frets = shape.frets.map((f) => (f < 0 ? -1 : f + (shape.base > 1 ? shape.base - 1 : 0)));
        let strings = [0, 1, 2, 3, 4, 5].filter((s) => frets[s] >= 0);
        if (e.single) strings = [3].filter((s) => frets[s] >= 0).concat(frets[3] < 0 ? [4] : []);
        if (e.up && !e.single) strings = strings.slice(-4).reverse();
        // sloppy-chord scenarios: one string muted, or one string a fret off
        if (e.mute != null && strings.length > 2) strings = strings.filter((_, k) => k !== e.mute % strings.length);
        if (e.off != null) { const s = strings[e.off % strings.length]; frets[s] = frets[s] + 1; }
        // Lifting a fretting finger for a new chord stops that string (open strings ring on).
        if (window.__prevFrets && e.name !== window.__prevName) {
          for (let s = 0; s < 6; s++) if (window.__prevFrets[s] > 0 && frets[s] < 0) plucks[s].push({ st: Math.round(e.t * sr), midi: 0, amp: 0, stop: true });
        }
        window.__prevFrets = frets; window.__prevName = e.name;
        strings.forEach((s, k) => {
          const st = Math.round((e.t + k * 0.008) * sr);
          plucks[s].push({ st, midi: OPEN[s] + frets[s], amp: e.up ? 0.12 : 0.2 });
        });
      }
      for (let s = 0; s < 6; s++) {
        const L = plucks[s].sort((a, b) => a.st - b.st);
        L.forEach((p, i) => !p.stop && pluck(buf, p.st, p.midi, p.amp, sr, i + 1 < L.length ? L[i + 1].st : total));
      }
      if (opts.noise) for (let i = 0; i < total; i++) buf[i] += (Math.random() * 2 - 1) * opts.noise;
      const ab = ctx.createBuffer(1, total, sr);
      ab.copyToChannel(buf, 0);
      await ctx.resume();
      const src = ctx.createBufferSource();
      src.buffer = ab;
      src.connect(dest);
      src.start();
      window.FretFallDebug.togglePlay();
    },
  };
};

const exe = "/home/archeene/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--autoplay-policy=no-user-gesture-required"] });
for (const sc of scenarios) {
  const page = await browser.newPage();
  await page.addInitScript(init);
  if (process.env.DUMP) await page.addInitScript(() => { window.__ffPeaks = true; });
  if (process.env.DBG) await page.addInitScript((n) => { window.__dbgN = n; }, +process.env.DBG);
  await page.goto("http://localhost:8765/index.html");
  await page.waitForFunction(() => window.FretFallDebug);
  const evs = await page.evaluate(async (songId) => {
    const D = window.FretFallDebug;
    D.loadSongByIndex(window.SONGS.findIndex((s) => s.id === songId), { campaign: true });
    await D.enableMic(true);
    const st = D.state();
    return st.notes.filter((n) => n.isStrum).map((n) => ({ t: n.time, name: n.name }));
  }, SONG);
  // Build the played events per scenario
  const names = [...new Set(evs.map((e) => e.name))];
  const r = () => (Math.random() * 2 - 1);
  let play = evs.map((e, i) => ({ ...e, up: i % 2 === 1 }));
  if (sc === "jitter") play = play.map((e) => ({ ...e, t: e.t + r() * 0.03 }));
  if (sc === "hold") play = play.filter((e, i, a) => i === 0 || a[i - 1].name !== e.name || (e.t - a[i-1].t) > 1.5);
  if (sc === "wrong") play = play.map((e) => ({ ...e, name: names[(names.indexOf(e.name) + 1) % names.length] }));
  if (sc === "late") play = play.map((e) => ({ ...e, t: e.t + 0.2 }));
  if (sc === "mute1") play = play.map((e, i) => ({ ...e, mute: (i * 7 + 3) }));
  if (sc === "offfret") play = play.map((e, i) => ({ ...e, off: (i * 5 + 1) }));
  if (sc === "single") play = play.map((e) => ({ ...e, single: true }));
  const noise = sc === "noise" ? 0.01 : 0;
  if (sc === "noise") play = play.map((e) => ({ ...e, t: e.t + r() * 0.02 }));
  await page.evaluate(([p, secs, noise]) => window.__fake.run(p, { secs, noise }), [play, SECS, noise]);
  await page.waitForTimeout(SECS * 1000);
  const res = await page.evaluate(() => {
    const s = window.FretFallDebug.state();
    return { hits: s.hits, played: s.played, perfects: s.perfects, onsets: s.onsets.length,
      floaters: [...new Set(s.floaters.map((f) => f.text))].join("|"),
      miss: s.notes.filter((n) => n.judged && !n.hit).map((n) => s.notes.filter((m) => m.isStrum).indexOf(n) + n.name).join(" "),
      dbg: s.notes.filter((n) => n.dbg).slice(0, +(window.__dbgN || 0)).map((n) => {
        const c = n.dbg.chroma, tot = c.reduce((a, b) => a + b, 0) || 1;
        const PC = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
        return n.name + " f" + n.dbg.frames + " dt" + n.dbg.dt.toFixed(3) + " exp[" + n.pcs.map((p) => PC[p]).join(",") + "] " +
          c.map((v, i) => [PC[i], v / tot]).filter((x) => x[1] > 0.04).sort((a, b) => b[1] - a[1]).map((x) => x[0] + ":" + x[1].toFixed(2)).join(" ");
      }) };
  });
  const dbg = res.dbg; delete res.dbg;
  if (process.env.DUMP) {
    const raw = await page.evaluate(() => { const s = window.FretFallDebug.state();
      return { sets: s.chordSets, strums: s.notes.filter((n) => n.isStrum && n.judged).map((n) => ({ name: n.name, pcs: n.pcs, time: n.time, peaks: n.dbg ? n.dbg.peaks : null })) }; });
    raw.play = play;
    require("fs").writeFileSync(process.env.DUMP + "/" + SONG + "." + sc + ".json", JSON.stringify(raw));
  }
  console.log(sc.padEnd(8), `acc ${res.played ? Math.round(100 * res.hits / res.played) : 0}%`, JSON.stringify(res));
  if (process.env.DBG) console.log(dbg.join("\n"));
  await page.close();
}
await browser.close();
