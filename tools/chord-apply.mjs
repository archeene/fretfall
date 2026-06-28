#!/usr/bin/env node
// chord-apply.mjs <songId> <transcribe.json> <chords.json>
// Map the song-long chord-constrained transcription to {b,s,f} and attach as the
// `picked` track. Each note: the active chord's shape, the string that sounds the
// detected pitch class nearest the detected register.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
global.window = {};
require(path.join(ROOT, "js/songs.js"));
require(path.join(ROOT, "js/chordShapes.js"));
const { SONGS, ChordShapes } = global.window;
const OPEN = [40, 45, 50, 55, 59, 64];

const songId = process.argv[2];
const tr = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
const uniq = JSON.parse(fs.readFileSync(process.argv[4], "utf8")).unique;
const song = SONGS.find((s) => s.id === songId);
if (!song) { console.error("song not found"); process.exit(1); }

const bpm = Math.max(40, Math.min(200, Math.round(tr.tempo) || song.bpm || 100));
const perEighth = bpm / 30;                              // seconds -> eighths

const shapeCache = {};
function shapeOf(name) { return shapeCache[name] !== undefined ? shapeCache[name] : (shapeCache[name] = ChordShapes.getChordShape(name)); }

const notes = [];
for (const n of tr.notes) {
  const chord = uniq[n.c]; if (!chord) continue;
  const shape = shapeOf(chord.name); if (!shape) continue;
  const snd = []; for (let s = 0; s < 6; s++) if (shape.frets[s] >= 0) snd.push(s);
  if (!snd.length) continue;
  // strings that sound the detected pitch class
  const match = snd.filter((s) => ((OPEN[s] + shape.frets[s]) % 12) === n.pc);
  const pool = match.length ? match : snd;
  // among them, the one whose register is closest to the detected height
  const target = n.h * (snd.length - 1);
  let bestS = pool[0], bestD = 1e9;
  for (const s of pool) { const d = Math.abs(snd.indexOf(s) - target); if (d < bestD) { bestD = d; bestS = s; } }
  const b = Math.round(n.t * perEighth * 2) / 2;          // quantize to 16th grid
  notes.push({ b, s: bestS, f: shape.frets[bestS] });
}
// de-dupe identical (b,s,f) and sort
notes.sort((a, b) => a.b - b.b || a.s - b.s);
const seen = new Set(), out = [];
for (const n of notes) { const k = n.b + "_" + n.s + "_" + n.f; if (!seen.has(k)) { seen.add(k); out.push(n); } }
// normalize to start at 0
if (out.length) { const off = out[0].b; if (off > 0) for (const n of out) n.b = +(n.b - off).toFixed(3); }
if (out.length < 16) { console.error(`too few notes (${out.length})`); process.exit(2); }

// attach picked + update bpm to the detected tempo (more accurate for both modes)
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
entry = entry.replace(/bpm: \d+(\.\d+)?/, `bpm: ${bpm}`);   // real tempo from the recording
if (/picked: \[/.test(entry)) entry = entry.replace(/picked: \[[\s\S]*?\],\n\s*/, block);
else if (/\n\s*text:/.test(entry)) entry = entry.replace(/(\n\s*)text:/, `$1${block}text:`);
src = src.slice(0, entryStart) + entry + src.slice(closeIdx);
fs.writeFileSync(F, src);
console.log(`${songId}: ${out.length} picked notes, ${tr.chords_used} chords used, bpm ${bpm}, span ${Math.round(out[out.length - 1].b)} eighths`);
