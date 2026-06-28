#!/usr/bin/env node
// batch-pick.mjs — generate a `picked` track for EVERY chord song that lacks one.
// For each: pull the real recording (YouTube), learn its breakup pattern, stamp it
// onto the known chords. Memory-safe (librosa only, no Demucs). Resumable: skips
// songs that already have a picked track.
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SCR = "/tmp/claude-1000/-home-archeene-Boss/85d984b5-2c3b-4998-88a9-73c8c348f885/scratchpad";
const BIN = `${SCR}/bin`, PY = `${SCR}/venv-lib/bin/python`, AUD = `${SCR}/audio`;
fs.mkdirSync(AUD, { recursive: true });

global.window = {};
require(path.join(ROOT, "js/songs.js"));
const chordSongs = global.window.SONGS.filter(
  (s) => !(s.notes && s.notes.length) && s.text && !(s.picked && s.picked.length)
);
console.log(`${chordSongs.length} chord songs need a picked track\n`);

let ok = 0, fail = 0;
for (const s of chordSongs) {
  const [title, artist = ""] = s.title.split(" — ");
  const id = s.id;
  const wav = `${AUD}/${id}.wav`, clip = `${AUD}/${id}_clip.wav`, pat = `${SCR}/pat_${id}.json`;
  const cleanup = () => { for (const f of [wav, clip]) try { fs.rmSync(f, { force: true }); } catch {} };
  try {
    execSync(`"${BIN}/yt-dlp" --ffmpeg-location "${BIN}" -x --audio-format wav --no-playlist --no-warnings -o "${AUD}/${id}.%(ext)s" "ytsearch1:${artist} ${title} official audio"`,
      { stdio: "ignore", timeout: 180000 });
    if (!fs.existsSync(wav)) throw new Error("no audio downloaded");
    execSync(`"${BIN}/ffmpeg" -nostdin -v error -y -ss 40 -t 30 -i "${wav}" -ac 1 -ar 22050 "${clip}"`, { timeout: 60000 });
    execSync(`"${PY}" "${__dirname}/audio-pattern.py" "${clip}" "${pat}" 4 8 0.35`, { stdio: "ignore", timeout: 180000 });
    execSync(`node "${__dirname}/chord-arpeggiate.mjs" "${id}" "${pat}"`, { stdio: "ignore", timeout: 60000 });
    cleanup();
    ok++; console.log(`✓ ${s.title}`);
  } catch (e) {
    cleanup();
    fail++; console.log(`✗ ${s.title} — ${String(e.message).split("\n")[0].slice(0, 70)}`);
  }
}
console.log(`\nDONE: ${ok} picked, ${fail} failed`);
