import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const at = require("@coderline/alphatab");
const buf = fs.readFileSync("/mnt/c/Users/PRIME/Downloads/Guitar/Jeff Buckley - Hallelujah (ver 8 by mandelstamdavid).gpx");
const score = at.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(buf), new at.Settings());
const PC=["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const tuning = score.tracks[0].staves[0].stringTuning.tunings; // [64,59,55,50,45,40] high->low
console.log("tuning:", tuning.join(","));
const bars = score.tracks[0].staves[0].bars;
let dumped=0;
for (let bi=0; bi<2; bi++){
  console.log(`--- bar ${bi+1} ---`);
  for (const v of bars[bi].voices) for (const beat of v.beats){
    if (beat.isRest) continue;
    const ns = beat.notes.map(n=>{
      const midi = tuning[n.string-1] + n.fret; // string 1-based into high->low tuning
      return `str${n.string}/fr${n.fret}=${PC[midi%12]}${n.isDead?"(x)":""}${n.isTieDestination?"(tie)":""}`;
    });
    console.log(`  start=${beat.playbackStart} dur=${beat.playbackDuration}: ${ns.join("  ")}`);
  }
}
