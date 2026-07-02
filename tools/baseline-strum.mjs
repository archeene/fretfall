#!/usr/bin/env node
// baseline-strum.mjs <songId> <out.json>
// The chords-only floor: emit chord tones on the song's strum slots, one chord per
// chordBars bars. Any chord-breaking method must beat this F1 to be worth having.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
global.window = {};
require(path.join(ROOT, "js/songs.js"));
require(path.join(ROOT, "js/tabParser.js"));
const { SONGS, TabParser } = global.window;
const s = SONGS.find((x) => x.id === process.argv[2]);
const chords = TabParser.parseTab(s.text).chords;
const strum = s.strum || ["D", "-", "D", "-", "D", "-", "D", "-"];
const bars = s.chordBars || 1;
const notes = [];
chords.forEach((c, ci) => {
  for (let bar = 0; bar < bars; bar++) {
    strum.forEach((st, i) => {
      if (st === "-") return;
      const b = (ci * bars + bar) * (s.beatsPerBar || 4) + i / 2;
      const root = 40 + ((c.pcs[0] - 40) % 12 + 12) % 12;
      const m = [root, ...c.pcs.slice(1, 3).map((pc) => 52 + (((pc - 52) % 12) + 12) % 12)];
      notes.push({ b, m: [...new Set(m)] });
    });
  }
});
fs.writeFileSync(process.argv[3], JSON.stringify({ tempo: s.bpm, notes }));
console.log(`${s.id}: baseline ${notes.length} onsets over ${chords.length * bars} bars`);
