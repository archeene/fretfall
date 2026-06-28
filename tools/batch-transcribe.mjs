#!/usr/bin/env node
// batch-transcribe.mjs — regenerate every chord song's `picked` track with the
// song-long chord-constrained transcription (chord-prep -> audio-transcribe ->
// chord-apply on the FULL recording). Replaces the old single-template tracks.
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
  (s) => !(s.notes && s.notes.length) && s.text && s.id !== "gravity-vienna-teng"   // gravity already redone
);
console.log(`${chordSongs.length} chord songs to (re)transcribe\n`);

let ok = 0, fail = 0;
for (const s of chordSongs) {
  const [title, artist = ""] = s.title.split(" — ");
  const id = s.id;
  const wav = `${AUD}/${id}.wav`, ch = `${SCR}/ch_${id}.json`, tr = `${SCR}/tr_${id}.json`;
  const rm = () => { for (const f of [wav]) try { fs.rmSync(f, { force: true }); } catch {} };
  try {
    execSync(`"${BIN}/yt-dlp" --ffmpeg-location "${BIN}" -x --audio-format wav --no-playlist --no-warnings -o "${AUD}/${id}.%(ext)s" "ytsearch1:${artist} ${title} official audio"`,
      { stdio: "ignore", timeout: 200000 });
    if (!fs.existsSync(wav)) throw new Error("no audio");
    execSync(`node "${__dirname}/chord-prep.mjs" "${id}" "${ch}"`, { stdio: "ignore", timeout: 30000 });
    execSync(`"${PY}" "${__dirname}/audio-transcribe.py" "${wav}" "${ch}" "${tr}"`, { stdio: "ignore", timeout: 300000 });
    execSync(`node "${__dirname}/chord-apply.mjs" "${id}" "${tr}" "${ch}"`, { stdio: "ignore", timeout: 60000 });
    rm();
    ok++; console.log(`✓ ${s.title}`);
  } catch (e) {
    rm();
    fail++; console.log(`✗ ${s.title} — ${String(e.message).split("\n")[0].slice(0, 60)}`);
  }
}
console.log(`\nDONE: ${ok} transcribed, ${fail} failed`);
