#!/usr/bin/env node
// parse-gp.mjs — LOSSLESS Guitar Pro (.gp/.gp5/.gpx) → playable note track.
// Unlike PDF OCR, a Guitar Pro file is structured data, so every note, string,
// fret, and exact timing is preserved perfectly. Updates the matching song's
// `notes:` array in ../js/songs.js.
//
// Usage: node parse-gp.mjs "/path/song.gpx" [songId]

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const at = require("@coderline/alphatab");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONGS_FILE = path.join(__dirname, "..", "js", "songs.js");
const PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const gpPath = process.argv[2];
const songId = process.argv[3] || "hallelujah";
if (!gpPath) { console.error("Usage: node parse-gp.mjs <file.gpx> [songId]"); process.exit(1); }

const buf = fs.readFileSync(gpPath);
const score = at.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(buf), new at.Settings());

// pick the track with the most notes (the guitar part)
let track = score.tracks[0], best = -1;
for (const t of score.tracks) {
  let c = 0;
  for (const bar of t.staves[0].bars) for (const v of bar.voices) for (const b of v.beats) c += b.notes.length;
  if (c > best) { best = c; track = t; }
}
const staff = track.staves[0];
const tuning = staff.stringTuning.tunings;        // high->low, e.g. [64,59,55,50,45,40]
const TPE = 480;                                   // ticks per eighth note (960/quarter)

const notes = [];
const chordMarks = [];
let cumTicks = 0;
staff.bars.forEach((bar, i) => {
  const mb = score.masterBars[i];
  const barTicks = mb.timeSignatureNumerator * (3840 / mb.timeSignatureDenominator);
  for (const v of bar.voices) {
    for (const beat of v.beats) {
      if (beat.isRest) continue;
      const b = +(((cumTicks + beat.playbackStart) / TPE).toFixed(3));
      // capture the transcriber's chord label (for broken-chord diagrams)
      if (beat.chord && beat.chord.name &&
          (!chordMarks.length || chordMarks[chordMarks.length - 1].name !== beat.chord.name)) {
        chordMarks.push({ b, name: beat.chord.name });
      }
      for (const n of beat.notes) {
        if (n.isDead || n.isTieDestination) continue;   // muted / tied = not re-picked
        const s = n.string - 1;                          // 0 = low E … 5 = high e (verified)
        if (s < 0 || s > 5 || n.fret < 0 || n.fret > 24) continue;
        notes.push({ b, s, f: n.fret });
      }
    }
  }
  cumTicks += barTicks;
});
notes.sort((a, b) => a.b - b.b || a.s - b.s);
// trim leading silence so the song starts immediately (densest track may start late)
if (notes.length) {
  const off = notes[0].b;
  if (off > 0) { for (const n of notes) n.b = +(n.b - off).toFixed(3); for (const c of chordMarks) c.b = +Math.max(0, c.b - off).toFixed(3); }
}
const ts0 = score.masterBars[0];
const barEighths = Math.round(ts0.timeSignatureNumerator * (8 / ts0.timeSignatureDenominator));

// ---- verification ----
const OPEN = [40, 45, 50, 55, 59, 64];
const m1 = notes.filter((n) => n.b < 6).map((n) => PC[(OPEN[n.s] + n.f) % 12] + (n.f));
console.log(`title: ${score.title} — ${score.artist}`);
console.log(`tempo: ${score.tempo} | capo: ${staff.capo} | bars: ${staff.bars.length} | pitched notes: ${notes.length}`);
console.log(`song length: ${(notes[notes.length - 1].b * (60 / score.tempo / 2)).toFixed(0)}s`);
console.log(`bar 1 pitches: ${m1.join(" ")}`);

console.log(`barEighths: ${barEighths} | chord labels: ${chordMarks.length}`);

// ---- emit barEighths + chordMarks + notes literal ----
const lit = notes.map((n) => `{ b: ${n.b}, s: ${n.s}, f: ${n.f} }`);
const lines = [];
for (let i = 0; i < lit.length; i += 8) lines.push("      " + lit.slice(i, i + 8).join(", ") + ",");
const cmLit = chordMarks.map((c) => `{ b: ${c.b}, name: ${JSON.stringify(c.name)} }`).join(", ");
const block =
  `barEighths: ${barEighths},\n    ` +
  (chordMarks.length ? `chordMarks: [${cmLit}],\n    ` : "") +
  "notes: [\n" + lines.join("\n") + "\n    ],\n    ";

// ---- splice into songs.js (replace barEighths/chordMarks/notes for this song) ----
let src = fs.readFileSync(SONGS_FILE, "utf8");
const idIdx = src.indexOf(`id: "${songId}"`);
if (idIdx < 0) { console.error(`Song id "${songId}" not found in songs.js`); process.exit(1); }
// find the existing barEighths?/chordMarks?/notes block belonging to this song
const after = src.slice(idIdx);
const re = /(?:barEighths:[^\n]*\n\s*)?(?:chordMarks: \[[\s\S]*?\],\n\s*)?notes: \[[\s\S]*?\],\n(\s*)(?=text:|capo:|bpm:|id:|\})/;
if (!re.test(after)) {
  console.error("Could not locate this song's notes:[] array to replace. (Add a `notes: [],` placeholder before `text:`.)");
  process.exit(1);
}
const replaced = after.replace(re, block);
src = src.slice(0, idIdx) + replaced;
fs.writeFileSync(SONGS_FILE, src);
console.log(`✓ replaced notes for "${songId}" in js/songs.js (${notes.length} notes)`);
