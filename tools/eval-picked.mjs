#!/usr/bin/env node
// eval-picked.mjs <songId> <candidate.json>
// Score a generated arrangement against the song's REAL picked track (ground truth).
// candidate.json: transcribe format {tempo, notes:[{b (beats), m:[midi..]}]}.
// Match = same pitch class within ±0.5 eighths (octave-free, per user rule).
// Auto-aligns tempo scale (0.5/1/2) and offset; reports precision/recall/F1.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const OPEN = [40, 45, 50, 55, 59, 64];

global.window = {};
require(path.join(ROOT, "js/songs.js"));
const song = global.window.SONGS.find((s) => s.id === process.argv[2]);
if (!song || !song.picked) { console.error("song has no ground-truth picked"); process.exit(1); }

// ground truth: [{b (eighths), pc}]
const gt = song.picked.map((n) => ({ b: n.b, pc: (OPEN[n.s] + n.f) % 12 }));

// candidate: beats -> eighths
const cand = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const perEighth = (cand.tempo || song.bpm || 100) / 30;   // sec -> eighths fallback
const cnotes = [];
for (const n of cand.notes) for (const m of n.m || []) cnotes.push({ b: n.b != null ? n.b * 2 : n.t * perEighth, pc: m % 12 });

function score(scale, offset) {
  const c = cnotes.map((n) => ({ b: n.b * scale + offset, pc: n.pc }));
  // greedy 1:1 matching within ±0.5 eighths
  const used = new Set();
  let hit = 0;
  const bins = new Map();
  c.forEach((n, i) => { const k = Math.round(n.b * 2); if (!bins.has(k)) bins.set(k, []); bins.get(k).push(i); });
  for (const g of gt) {
    const k0 = Math.round(g.b * 2);
    let found = -1;
    for (const k of [k0, k0 - 1, k0 + 1]) {
      for (const i of bins.get(k) || []) {
        if (!used.has(i) && c[i].pc === g.pc && Math.abs(c[i].b - g.b) <= 0.5) { found = i; break; }
      }
      if (found >= 0) break;
    }
    if (found >= 0) { used.add(found); hit++; }
  }
  const prec = cnotes.length ? hit / cnotes.length : 0;
  const rec = gt.length ? hit / gt.length : 0;
  return { f1: prec + rec ? (2 * prec * rec) / (prec + rec) : 0, prec, rec, hit };
}

let best = { f1: -1 };
for (const scale of [0.5, 1, 2]) {
  const gtSpan = gt[gt.length - 1].b, cSpan = cnotes.length ? Math.max(...cnotes.map((n) => n.b)) * scale : 1;
  for (let off = -8; off <= 8; off += 0.5) {
    const s = score(scale, off);
    if (s.f1 > best.f1) best = { ...s, scale, off, spanRatio: (cSpan / gtSpan).toFixed(2) };
  }
}
console.log(`${process.argv[2]} vs ${path.basename(process.argv[3])}: ` +
  `F1 ${(best.f1 * 100).toFixed(1)}% (P ${(best.prec * 100).toFixed(0)}% R ${(best.rec * 100).toFixed(0)}%) ` +
  `| ${best.hit}/${gt.length} GT notes matched | ${cnotes.length} generated | scale x${best.scale} off ${best.off} | span ratio ${best.spanRatio}`);
