#!/usr/bin/env node
// chord-arpeggiate.mjs <songId> <pattern.json> [newId]
// Stamp an audio-learned breakup template (from audio-pattern.py) onto a chord
// song's KNOWN chords + shapes, producing a note-by-note version. We don't detect
// notes — we apply the recurring pattern over the chords we already have.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
global.window = {};
require(path.join(ROOT, "js/songs.js"));
require(path.join(ROOT, "js/tabParser.js"));
require(path.join(ROOT, "js/chordShapes.js"));
const { SONGS, TabParser, ChordShapes } = global.window;

const songId = process.argv[2];
const patternFile = process.argv[3];
const song = SONGS.find((s) => s.id === songId);
if (!song || !song.text) { console.error("chord song not found:", songId); process.exit(1); }
const pat = JSON.parse(fs.readFileSync(patternFile, "utf8"));
const SLOTS = pat.slots_per_bar || 8;
const newId = process.argv[4] || (songId.replace(/-/g, "-").replace(/(-vienna-teng)?$/, "") + "-picked");

const chords = TabParser.parseTab(song.text).chords;       // ordered known chords
if (chords.length < 2) { console.error("no chord progression parsed"); process.exit(1); }

// for a shape, the sounding string indices low->high (0=lowE..5=high e)
function sounding(shape) {
  const out = [];
  for (let s = 0; s < 6; s++) if (shape.frets[s] >= 0) out.push(s);
  return out;
}

// stretch the learned contour to span the full register, so the arpeggio is melodic
const hs = pat.template.map((t) => t.height);
const hmin = Math.min(...hs), hmax = Math.max(...hs), hrange = (hmax - hmin) || 1;

const notes = [];
chords.forEach((c, ci) => {
  const shape = ChordShapes.getChordShape(c.name);
  if (!shape) return;                                      // unknown chord -> skip its bar
  const snd = sounding(shape);                             // sounding strings low->high
  if (!snd.length) return;
  const barB = ci * SLOTS;                                  // 8 eighths per chord bar
  for (const t of pat.template) {
    // map the audio-learned pitch height (0=low..1=high) to a string in THIS chord,
    // so the arpeggio follows the real recording's up/down contour
    const norm = (t.height - hmin) / hrange;            // stretched 0..1 across the song's range
    const idx = Math.max(0, Math.min(snd.length - 1, Math.round(norm * (snd.length - 1))));
    const s = snd[idx];
    const f = shape.frets[s];
    if (f < 0) continue;
    notes.push({ b: barB + t.slot, s, f });
  }
});
notes.sort((a, b) => a.b - b.b || a.s - b.s);
if (notes.length < 16) { console.error(`too few notes (${notes.length}) — chords likely unrecognized; skipping`); process.exit(2); }

// attach a `picked: [...]` track to the EXISTING chord-song entry (toggle in-app)
const lit = notes.map((n) => `{ b: ${n.b}, s: ${n.s}, f: ${n.f} }`);
const lines = [];
for (let i = 0; i < lit.length; i += 8) lines.push("      " + lit.slice(i, i + 8).join(", ") + ",");
const pickedBlock = `picked: [\n${lines.join("\n")}\n    ],\n    `;

const SONGS_FILE = path.join(ROOT, "js/songs.js");
let src = fs.readFileSync(SONGS_FILE, "utf8");
const idIdx = src.indexOf(`id: ${JSON.stringify(songId)}`);
if (idIdx < 0) { console.error("song entry not found:", songId); process.exit(1); }
const entryStart = src.lastIndexOf("{", idIdx);
const closeIdx = src.indexOf("\n  },", idIdx);          // entry closes with "\n  },"
let entry = src.slice(entryStart, closeIdx);
if (/picked: \[/.test(entry)) entry = entry.replace(/picked: \[[\s\S]*?\],\n\s*/, pickedBlock);
else if (/\n\s*text:/.test(entry)) entry = entry.replace(/(\n\s*)text:/, `$1${pickedBlock}text:`);
else entry = entry.replace(/\n\s*$/, `\n    ${pickedBlock.trimEnd()}\n`);
src = src.slice(0, entryStart) + entry + src.slice(closeIdx);
fs.writeFileSync(SONGS_FILE, src);
console.log(`${songId}: attached picked track — ${notes.length} notes over ${chords.length} chords (${pat.template.length} slots)`);
