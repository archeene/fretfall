#!/usr/bin/env node
// audio-batch.mjs [idFilter] — production picked tracks via the BENCHMARKED pipeline
// (75.3% F1 clean / 58.5% band vs human tabs): yt-dlp -> Demucs 4-stem (drums/bass
// removed) -> instrument-matched transcriber (Riley piano_wrapped for piano songs,
// Basic Pitch 0.4/0.3 for guitar) -> piano-arrange v4 (madmom grid, KEEP=0.6,
// SHIFTCLUST=0) -> chord-apply. ONLY songs with no real note source (skips note
// songs and sngstr_/midi_ markers). Resumable via aud_<id> markers. Sequential
// (RAM-bound); auto-deploys at the end.
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FT = "/home/archeene/.fretfall";
const BIN = `${FT}/bin`;
const PY_D = `${FT}/venv-demucs/bin/python`, PY_L = `${FT}/venv-lib/bin/python`;
const ENV = { ...process.env, OMP_NUM_THREADS: "16", MKL_NUM_THREADS: "16", PATH: `${BIN}:${process.env.PATH}` };
const ARR = { ...ENV, MADMOM: "1", KEEP: "0.6", SHIFTCLUST: "0" };

const filter = process.argv[2] || "";
global.window = {};
require(path.join(ROOT, "js/songs.js"));
const songs = global.window.SONGS.filter((s) =>
  s.text && !(s.notes && s.notes.length) && s.id.includes(filter) &&
  !fs.existsSync(`${FT}/sngstr_${s.id}`) && !fs.existsSync(`${FT}/midi_${s.id}`));
console.log(`${songs.length} songs without a real note source -> benchmarked audio pipeline\n`);

fs.mkdirSync(`${FT}/stems4`, { recursive: true });
let ok = 0, fail = 0;
for (const s of songs) {
  const id = s.id, marker = `${FT}/aud_${id}`;
  if (fs.existsSync(marker)) { console.log(`· skip (done): ${s.title}`); ok++; continue; }
  const [title, artist = ""] = s.title.split(" — ");
  const wav = `${FT}/audio/${id}.wav`, sep = `${FT}/sep4_${id}`, stem = `${FT}/stems4/${id}.wav`;
  const mid = `${FT}/am_${id}.mid`, tr = `${FT}/atr_${id}.json`;
  const isGuitar = /villagers/.test(id);               // Villagers = guitar; VT = piano
  const clean = () => { try { fs.rmSync(wav, { force: true }); fs.rmSync(sep, { recursive: true, force: true }); } catch {} };
  try {
    if (!fs.existsSync(stem)) {                        // separate once, cache the OTHER stem
      execSync(`"${BIN}/yt-dlp" --ffmpeg-location "${BIN}" -x --audio-format wav --no-playlist --no-warnings -o "${FT}/audio/${id}.%(ext)s" "ytsearch1:${artist} ${title} official audio"`, { stdio: "ignore", timeout: 240000, env: ENV });
      if (!fs.existsSync(wav)) throw new Error("no audio");
      execSync(`nice -n 5 "${PY_D}" -m demucs -n htdemucs -j 1 --mp3 --segment 7 -o "${sep}" "${wav}"`, { stdio: "ignore", timeout: 1200000, env: ENV });
      const mp3 = execSync(`find "${sep}" -name other.mp3`).toString().trim().split("\n")[0];
      if (!mp3) throw new Error("no stem");
      execSync(`"${BIN}/ffmpeg" -nostdin -v error -y -i "${mp3}" -ac 1 -ar 22050 "${stem}"`, { timeout: 60000, env: ENV });
      clean();
    }
    if (!fs.existsSync(mid)) {                         // instrument-matched transcription
      if (isGuitar) {
        execSync(`"${PY_L}" -c "
from basic_pitch.inference import predict
_, m, _ = predict('${stem}', onset_threshold=0.4, frame_threshold=0.3)
m.write('${mid}')"`, { stdio: "ignore", timeout: 300000, env: ENV });
      } else {
        execSync(`"${PY_D}" -c "
import librosa
from piano_transcription_inference import PianoTranscription, sample_rate
a, _ = librosa.load('${stem}', sr=sample_rate, mono=True)
PianoTranscription(device='cpu', checkpoint_path='${FT}/models/piano_wrapped.pth').transcribe(a, '${mid}')"`, { stdio: "ignore", timeout: 900000, env: ENV });
      }
    }
    execSync(`"${PY_L}" "${__dirname}/piano-arrange.py" "${mid}" "${stem}" "${tr}" ${s.bpm || 100} ${s.beatsPerBar || 4}`, { stdio: "ignore", timeout: 600000, env: ARR });
    const t = JSON.parse(fs.readFileSync(tr, "utf8"));
    const span = t.notes.length ? (t.notes[t.notes.length - 1].b - t.notes[0].b) * 2 : 0;
    if (t.notes.length < 150 || span < 240) throw new Error(`too small (${t.notes.length} onsets, ${Math.round(span)} eighths)`);
    execSync(`node "${__dirname}/chord-apply.mjs" "${id}" "${tr}"`, { stdio: "ignore", timeout: 60000 });
    fs.writeFileSync(marker, JSON.stringify({ onsets: t.notes.length, span: Math.round(span), tempo: t.tempo, model: isGuitar ? "basic-pitch" : "riley-piano" }));
    ok++; console.log(`✓ ${s.title}  (${t.notes.length} onsets, ${Math.round(span)} eighths, bpm ${t.tempo}, ${isGuitar ? "BP" : "riley"})`);
  } catch (e) { clean(); fail++; console.log(`✗ ${s.title} — ${String(e.message).split("\n")[0].slice(0, 60)}`); }
}
console.log(`\nDONE: ${ok} ok, ${fail} failed`);

if (ok > 0) {                                          // auto-deploy
  try {
    const v = Date.now();
    const gitEnv = { ...process.env }; delete gitEnv.GIT_WORK_TREE; delete gitEnv.GIT_DIR;
    execSync(`sed -i 's/?v=[0-9]*/?v=${v}/g' "${ROOT}/index.html"`);
    execSync(`node -c "${ROOT}/js/songs.js"`);
    execSync(`git -C "${ROOT}" add js/songs.js index.html`, { env: gitEnv });
    execSync(`git -C "${ROOT}" commit -q -m "Picked tracks via benchmarked audio pipeline (4-stem + instrument-matched AMT + v4 repair)"`, { env: gitEnv });
    execSync(`git -C "${ROOT}" push -q ghpages master`, { env: gitEnv });
    console.log("DEPLOYED");
  } catch (e) { console.log("deploy skipped:", String(e.message).split("\n")[0].slice(0, 80)); }
}
