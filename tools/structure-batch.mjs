#!/usr/bin/env node
// structure-batch.mjs [idFilter] — Step 3 structure-aware synthesis, LAST RESORT.
// ONLY for chord songs with NO real note source: skips note songs (GP/GPX imports),
// and skips songs with a real picked track (sngstr_/midi_ markers). Uses the cached
// Demucs stems. Resumable via stk_<id> markers; rejects low-fidelity output.
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FT = "/home/archeene/.fretfall";
const PY = `${FT}/venv-lib/bin/python`;

const filter = process.argv[2] || "";
global.window = {};
require(path.join(ROOT, "js/songs.js"));
const songs = global.window.SONGS.filter((s) =>
  s.text && !(s.notes && s.notes.length) && s.id.includes(filter) &&
  !fs.existsSync(`${FT}/sngstr_${s.id}`) && !fs.existsSync(`${FT}/midi_${s.id}`));
console.log(`${songs.length} songs WITHOUT a real note source -> structure-aware synthesis\n`);

let ok = 0, fail = 0;
for (const s of songs) {
  const id = s.id, marker = `${FT}/stk_${id}`;
  if (fs.existsSync(marker)) { console.log(`· skip (done): ${s.title}`); ok++; continue; }
  const stem = `${FT}/stems/${id}.wav`, ch = `${FT}/ch_${id}.json`, tr = `${FT}/str_${id}.json`;
  try {
    if (!fs.existsSync(stem)) throw new Error("no cached stem");
    execSync(`node "${__dirname}/chord-prep.mjs" "${id}" "${ch}"`, { stdio: "ignore", timeout: 30000 });
    execSync(`"${PY}" "${__dirname}/structure-transcribe.py" "${stem}" "${ch}" "${tr}" ${s.beatsPerBar || 4} ${s.bpm || 120}`, { stdio: "ignore", timeout: 300000 });
    const t = JSON.parse(fs.readFileSync(tr, "utf8"));
    if (t.fidelity < 0.75) throw new Error(`low fidelity ${t.fidelity}`);
    const types = new Set(t.sections).size;
    if (types < 2) throw new Error("no structure found");
    execSync(`node "${__dirname}/chord-apply.mjs" "${id}" "${tr}"`, { stdio: "ignore", timeout: 60000 });
    fs.writeFileSync(marker, JSON.stringify({ fidelity: t.fidelity, sections: t.sections }));
    console.log(`✓ ${s.title}  (${types} themes, fidelity ${t.fidelity}, form ${t.sections.slice(0, 24)}…)`);
    ok++;
  } catch (e) { console.log(`✗ ${s.title} — ${String(e.message).split("\n")[0].slice(0, 60)}`); fail++; }
}
console.log(`\nDONE: ${ok} ok, ${fail} failed`);

if (ok > 0) {                                          // auto-deploy
  try {
    const v = Date.now();
    const gitEnv = { ...process.env }; delete gitEnv.GIT_WORK_TREE; delete gitEnv.GIT_DIR;
    execSync(`sed -i 's/?v=[0-9]*/?v=${v}/g' "${ROOT}/index.html"`);
    execSync(`node -c "${ROOT}/js/songs.js"`);
    execSync(`git -C "${ROOT}" add js/songs.js index.html`, { env: gitEnv });
    execSync(`git -C "${ROOT}" commit -q -m "Structure-aware synthesized picked tracks (repeating section themes)"`, { env: gitEnv });
    execSync(`git -C "${ROOT}" push -q ghpages master`, { env: gitEnv });
    console.log("DEPLOYED");
  } catch (e) { console.log("deploy skipped:", String(e.message).split("\n")[0].slice(0, 80)); }
}
