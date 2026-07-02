#!/usr/bin/env node
// eval-breakdown.mjs <songId> <candidate.json> [scale] [offset]
// Decompose the F1 gap: matched | timing-miss (pc within ±3 eighths) | absent.
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
const gt = song.picked.map((n) => ({ b: n.b, pc: (OPEN[n.s] + n.f) % 12 }));
const cand = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const perEighth = (cand.tempo || song.bpm) / 30;

// find best scale/offset like eval-picked
const cnRaw = [];
for (const n of cand.notes) for (const m of n.m || []) cnRaw.push({ b: n.b != null ? n.b * 2 : n.t * perEighth, pc: m % 12 });
function match(scale, off, tol = 0.5) {
  const cn = cnRaw.map((n) => ({ b: n.b * scale + off, pc: n.pc }));
  const bins = new Map();
  cn.forEach((n, i) => { const k = Math.round(n.b * 2); (bins.get(k) || bins.set(k, []).get(k)).push(i); });
  const used = new Set();
  let hit = 0;
  for (const g of gt) {
    const k0 = Math.round(g.b * 2);
    let f = -1;
    outer: for (const k of [k0, k0 - 1, k0 + 1]) for (const i of bins.get(k) || [])
      if (!used.has(i) && cn[i].pc === g.pc && Math.abs(cn[i].b - g.b) <= tol) { f = i; break outer; }
    if (f >= 0) { used.add(f); hit++; }
  }
  return { hit, cn, bins, used };
}
let best = { hit: -1 };
for (const scale of [0.5, 1, 2]) for (let off = -8; off <= 8; off += 0.5) {
  const r = match(scale, off);
  if (r.hit > best.hit) best = { ...r, scale, off };
}
const { cn, bins, used } = best;
let timing = 0, absent = 0;
for (const g of gt) {
  const k0 = Math.round(g.b * 2);
  let m = false;
  outer: for (const k of [k0, k0 - 1, k0 + 1]) for (const i of bins.get(k) || [])
    if (used.has(i) && cn[i].pc === g.pc && Math.abs(cn[i].b - g.b) <= 0.5) { m = true; break outer; }
  if (m) continue;                                     // approximation: counted in hit
}
// recount properly
const used2 = new Set();
let matched = 0;
const misses = [];
for (const g of gt) {
  const k0 = Math.round(g.b * 2);
  let f = -1;
  outer: for (const k of [k0, k0 - 1, k0 + 1]) for (const i of bins.get(k) || [])
    if (!used2.has(i) && cn[i].pc === g.pc && Math.abs(cn[i].b - g.b) <= 0.5) { f = i; break outer; }
  if (f >= 0) { used2.add(f); matched++; } else misses.push(g);
}
for (const g of misses) {
  const k0 = Math.round(g.b * 2);
  let near = false;
  outer: for (let k = k0 - 6; k <= k0 + 6; k++) for (const i of bins.get(k) || [])
    if (cn[i].pc === g.pc && Math.abs(cn[i].b - g.b) <= 3) { near = true; break outer; }
  if (near) timing++; else absent++;
}
const gbins = new Map();
gt.forEach((g) => { const k = Math.round(g.b * 2); (gbins.get(k) || gbins.set(k, []).get(k)).push(g); });
let junk = 0;
for (const n of cn) {
  const k0 = Math.round(n.b * 2);
  let ok = false;
  outer: for (let k = k0 - 6; k <= k0 + 6; k++) for (const g of gbins.get(k) || []) if (g.pc === n.pc) { ok = true; break outer; }
  if (!ok) junk++;
}
const P = matched / cn.length, R = matched / gt.length;
console.log(`GT ${gt.length} | matched ${(100 * R).toFixed(0)}% | timing ${(100 * timing / gt.length).toFixed(0)}% | absent ${(100 * absent / gt.length).toFixed(0)}% || gen ${cn.length} P ${(100 * P).toFixed(0)}% junk ${(100 * junk / cn.length).toFixed(0)}% | scale x${best.scale}`);
