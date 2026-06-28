#!/usr/bin/env node
// demucs-batch.mjs [filter] — premium picked tracks via stem isolation.
// For each chord song matching `filter` (default: vienna-teng): isolate the
// instrumental (Demucs, 16 threads), transcribe the clean stem, attach `picked`.
// Sequential (RAM-bound), resumable via per-song markers.
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SCR = "/tmp/claude-1000/-home-archeene-Boss/85d984b5-2c3b-4998-88a9-73c8c348f885/scratchpad";
const BIN = `${SCR}/bin`, AUD = `${SCR}/audio`;
const PY_D = `${SCR}/venv-demucs/bin/python`, PY_L = `${SCR}/venv-lib/bin/python`;
const ENV = { ...process.env, OMP_NUM_THREADS: "16", MKL_NUM_THREADS: "16", PATH: `${BIN}:${process.env.PATH}` };

const filter = process.argv[2] || "vienna-teng";
global.window = {};
require(path.join(ROOT, "js/songs.js"));
const songs = global.window.SONGS.filter(
  (s) => s.id.includes(filter) && s.text && !(s.notes && s.notes.length) && s.id !== "gravity-vienna-teng"
);
console.log(`${songs.length} "${filter}" chord songs for Demucs treatment\n`);

let ok = 0, fail = 0;
for (const s of songs) {
  const id = s.id, marker = `${SCR}/dmk_${id}`;
  if (fs.existsSync(marker)) { console.log(`· skip (done): ${s.title}`); ok++; continue; }
  const [title, artist = ""] = s.title.split(" — ");
  const wav = `${AUD}/${id}.wav`, sep = `${SCR}/sep_${id}`;
  const ch = `${SCR}/ch_${id}.json`, tr = `${SCR}/tr_${id}.json`;
  const clean = () => { try { fs.rmSync(wav, { force: true }); fs.rmSync(sep, { recursive: true, force: true }); } catch {} };
  try {
    execSync(`"${BIN}/yt-dlp" --ffmpeg-location "${BIN}" -x --audio-format wav --no-playlist --no-warnings -o "${AUD}/${id}.%(ext)s" "ytsearch1:${artist} ${title} official audio"`, { stdio: "ignore", timeout: 200000 });
    if (!fs.existsSync(wav)) throw new Error("no audio");
    fs.rmSync(sep, { recursive: true, force: true });
    // memory-frugal: small segment (low activation RAM) + single worker (one model in RAM)
    execSync(`nice -n 10 "${PY_D}" -m demucs -n htdemucs -j 1 --two-stems=vocals --mp3 --segment 3 -o "${sep}" "${wav}"`, { stdio: "ignore", timeout: 900000, env: ENV });
    const mp3 = execSync(`find "${sep}" -name no_vocals.mp3`).toString().trim().split("\n")[0];
    if (!mp3) throw new Error("no stem");
    const stem = `${sep}/no_vocals.wav`;
    execSync(`"${BIN}/ffmpeg" -nostdin -v error -y -i "${mp3}" -ac 1 -ar 22050 "${stem}"`, { timeout: 60000 });
    execSync(`node "${__dirname}/chord-prep.mjs" "${id}" "${ch}"`, { stdio: "ignore", timeout: 30000 });
    execSync(`"${PY_L}" "${__dirname}/audio-transcribe.py" "${stem}" "${ch}" "${tr}"`, { stdio: "ignore", timeout: 180000 });
    execSync(`node "${__dirname}/chord-apply.mjs" "${id}" "${tr}" "${ch}"`, { stdio: "ignore", timeout: 60000 });
    clean(); fs.writeFileSync(marker, "");
    ok++; console.log(`✓ ${s.title}`);
  } catch (e) { clean(); fail++; console.log(`✗ ${s.title} — ${String(e.message).split("\n")[0].slice(0, 55)}`); }
}
console.log(`\nDONE: ${ok} ok, ${fail} failed`);
