import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const at = require("@coderline/alphatab");
const buf = fs.readFileSync("/mnt/c/Users/PRIME/Downloads/Guitar/Jeff Buckley - Hallelujah (ver 8 by mandelstamdavid).gpx");
const score = at.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(buf), new at.Settings());
const staff = score.tracks[0].staves[0];
// look for chord objects on beats, and any chord collection on the track/staff
let beatChords = 0, names = new Set();
staff.bars.slice(0,20).forEach((bar,bi)=>{
  for (const v of bar.voices) for (const beat of v.beats) {
    if (beat.chord) { beatChords++; names.add(beat.chord.name); }
    if (beat.chordId) names.add("id:"+beat.chordId);
  }
});
console.log("beats with .chord in first 20 bars:", beatChords);
console.log("chord names seen:", [...names].join(" | ") || "(none)");
// staff.chords map?
try { console.log("staff.chords keys:", staff.chords ? [...staff.chords.keys()].slice(0,10) : "n/a"); } catch(e){ console.log("staff.chords:", typeof staff.chords); }
