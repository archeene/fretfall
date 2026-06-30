#!/usr/bin/env node
// chord-apply.mjs <songId> <transcribe.json> [chords.json]
// Map the transcription's real MIDI pitches to {b,s,f} and attach as `picked`.
// Each onset carries a bass (low) + top (high) voice; map bass to a low string,
// top to a high string, on distinct strings.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
global.window = {};
require(path.join(ROOT, "js/songs.js"));
const { SONGS } = global.window;
const OPEN = [40, 45, 50, 55, 59, 64];                 // low E .. high e

const songId = process.argv[2];
const tr = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const song = SONGS.find((s) => s.id === songId);
if (!song) { console.error("song not found"); process.exit(1); }

const bpm = Math.max(40, Math.min(200, Math.round(tr.tempo) || song.bpm || 100));
const perEighth = bpm / 30;                            // seconds -> eighths

const notes = [];
for (const n of tr.notes) {
  const b = Math.round(n.t * perEighth * 4) / 4;       // quantize to 1/16
  const used = new Set();
  (n.m || []).forEach((midi, i) => {
    while (midi < 40) midi += 12;                      // fold notes below low-E up into guitar range
    while (midi > 88) midi -= 12;                      // and very high notes down
    const preferHigh = i > 0;                          // m[0]=bass(low strings), m[1+]=top(high)
    const cands = [];
    for (let s = 0; s < 6; s++) { const f = midi - OPEN[s]; if (f >= 0 && f <= 15 && !used.has(s)) cands.push({ s, f }); }
    if (!cands.length) return;
    // bass -> low strings, top -> high strings; both prefer low frets (natural position)
    cands.sort((a, c) => ((preferHigh ? 5 - a.s : a.s) + a.f * 0.5) - ((preferHigh ? 5 - c.s : c.s) + c.f * 0.5));
    const { s, f } = cands[0]; used.add(s);
    notes.push({ b, s, f });
  });
}
notes.sort((a, b) => a.b - b.b || a.s - b.s);
const seen = new Set(), out = [];
for (const n of notes) { const k = n.b + "_" + n.s + "_" + n.f; if (!seen.has(k)) { seen.add(k); out.push(n); } }
if (out.length) { const off = out[0].b; if (off > 0) for (const n of out) n.b = +(n.b - off).toFixed(3); }
if (out.length < 16) { console.error(`too few notes (${out.length})`); process.exit(2); }

// attach picked + set bpm to detected tempo
const lit = out.map((n) => `{ b: ${n.b}, s: ${n.s}, f: ${n.f} }`);
const lines = [];
for (let i = 0; i < lit.length; i += 8) lines.push("      " + lit.slice(i, i + 8).join(", ") + ",");
const block = `picked: [\n${lines.join("\n")}\n    ],\n    `;
const F = path.join(ROOT, "js/songs.js");
let src = fs.readFileSync(F, "utf8");
const idIdx = src.indexOf(`id: ${JSON.stringify(songId)}`);
const entryStart = src.lastIndexOf("{", idIdx);
const closeIdx = src.indexOf("\n  },", idIdx);
let entry = src.slice(entryStart, closeIdx);
entry = entry.replace(/bpm: \d+(\.\d+)?/, `bpm: ${bpm}`);
if (/picked: \[/.test(entry)) entry = entry.replace(/picked: \[[\s\S]*?\],\n\s*/, block);
else if (/\n\s*text:/.test(entry)) entry = entry.replace(/(\n\s*)text:/, `$1${block}text:`);
src = src.slice(0, entryStart) + entry + src.slice(closeIdx);
fs.writeFileSync(F, src);
console.log(`${songId}: ${out.length} picked notes (2-voice), bpm ${bpm}, span ${Math.round(out[out.length - 1].b)} eighths`);
