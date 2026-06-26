import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const alphaTab = require("@coderline/alphatab");
const buf = fs.readFileSync("/mnt/c/Users/PRIME/Downloads/Guitar/Jeff Buckley - Hallelujah (ver 8 by mandelstamdavid).gpx");
const data = new Uint8Array(buf);
const settings = new alphaTab.Settings();
const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(data, settings);
console.log("title:", score.title, "| artist:", score.artist);
console.log("tempo:", score.tempo);
console.log("tracks:", score.tracks.length, "->", score.tracks.map(t=>t.name).join(" | "));
const t = score.tracks[0];
const staff = t.staves[0];
console.log("track0 strings (tuning, high->low):", staff.stringTuning?.tunings || staff.tuning);
console.log("track0 capo:", staff.capo);
let bars=0, notes=0;
for (const mg of t.staves[0].bars) { bars++; for (const v of mg.voices) for (const beat of v.beats) for (const n of beat.notes) notes++; }
console.log("track0 bars:", bars, "| notes:", notes);
console.log("masterbars:", score.masterBars.length, "| timesig of bar0:", score.masterBars[0].timeSignatureNumerator+"/"+score.masterBars[0].timeSignatureDenominator);
