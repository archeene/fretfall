import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const at = require("@coderline/alphatab");
const score = at.importer.ScoreLoader.loadScoreFromBytes(
  new Uint8Array(fs.readFileSync("/mnt/c/Users/PRIME/Downloads/Guitar/Jeff Buckley - Hallelujah (ver 8 by mandelstamdavid).gpx")),
  new at.Settings());
const staff = score.tracks[0].staves[0];
const TPE = 480;
let cum = 0;
const marks = [];
staff.bars.forEach((bar, i) => {
  const mb = score.masterBars[i];
  const barTicks = mb.timeSignatureNumerator * (3840 / mb.timeSignatureDenominator);
  for (const v of bar.voices) for (const beat of v.beats) {
    if (beat.chord && beat.chord.name) {
      const b = +(((cum + beat.playbackStart) / TPE).toFixed(3));
      const name = beat.chord.name;
      if (!marks.length || marks[marks.length-1].name !== name) marks.push({ b, name });
    }
  }
  cum += barTicks;
});
const ts = score.masterBars[0];
console.log("barEighths:", ts.timeSignatureNumerator * (8 / ts.timeSignatureDenominator));
console.log("count:", marks.length, "distinct:", [...new Set(marks.map(m=>m.name))].join(" "));
console.log("chordMarks: [" + marks.map(m=>`{ b: ${m.b}, name: "${m.name}" }`).join(", ") + "],");
