#!/usr/bin/env node
// import-midi.mjs [idFilter] — Step 1 real-source import via bitmidi.
// For each chord song (id contains idFilter; "" = all): search bitmidi, download the
// best-matching COMPLETE MIDI, parse melody+guitar+bass, attach as the `picked` track.
// Resumable via midi_<id> markers. Verifies completeness (rejects ~35s demos).
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
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

const norm = (s) => (s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9 ]/g, " ").replace(/\b(the|a|an)\b/g, " ").replace(/\.mid$/, "").replace(/\s+/g, " ").trim();
const words = (s) => new Set(norm(s).split(" ").filter(Boolean));
const overlap = (a, b) => { const A = words(a), B = words(b); if (!A.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / A.size; };

const filter = process.argv[2] || "";
global.window = {};
require(path.join(ROOT, "js/songs.js"));
const songs = global.window.SONGS.filter((s) => !(s.notes && s.notes.length) && s.text && s.id.includes(filter));
console.log(`${songs.length} chord songs to MIDI-import${filter ? ` (filter: ${filter})` : ""}\n`);

let ok = 0, fail = 0;
for (const s of songs) {
  const id = s.id, marker = `${FT}/midi_${id}`;
  if (fs.existsSync(marker)) { console.log(`· skip (done): ${s.title}`); ok++; continue; }
  const [title, artist = ""] = s.title.split(" — ");
  try {
    const q = encodeURIComponent(`${artist} ${title}`);
    const res = await fetch(`https://bitmidi.com/api/midi/search?q=${q}`, { headers: { "User-Agent": UA } }).then((r) => r.json());
    const want = `${artist} ${title}`;
    const cands = (res.result?.results || [])
      .map((c) => ({ ...c, score: overlap(want, c.name) + overlap(title, c.name) }))
      .filter((c) => overlap(title, c.name) >= 0.6 && (!artist || overlap(artist, c.name) >= 0.4))
      .sort((a, b) => b.score - a.score || (b.plays || 0) - (a.plays || 0))
      .slice(0, 5);
    let applied = false;
    for (const c of cands) {
      const mid = `${FT}/m_${id}.mid`, tr = `${FT}/mt_${id}.json`;
      const buf = Buffer.from(await fetch(`https://bitmidi.com/uploads/${c.id}.mid`, { headers: { "User-Agent": UA } }).then((r) => r.arrayBuffer()));
      if (buf.slice(0, 4).toString() !== "MThd") continue;
      fs.writeFileSync(mid, buf);
      execSync(`"${PY}" "${__dirname}/parse-midi.py" "${mid}" "${tr}" "melody|guitar|bas|piano|vocal|lead"`, { stdio: "ignore" });
      const t = JSON.parse(fs.readFileSync(tr, "utf8"));
      const span = t.notes.length ? t.notes[t.notes.length - 1].t - t.notes[0].t : 0;
      if (span < 75 || t.notes.length < 60) { fs.rmSync(mid, { force: true }); continue; } // reject demo/sparse
      execSync(`node "${__dirname}/chord-apply.mjs" "${id}" "${tr}"`, { stdio: "ignore" });
      fs.writeFileSync(marker, c.name);
      fs.rmSync(mid, { force: true });
      console.log(`✓ ${s.title}  ← "${c.name}" (${t.notes.length} onsets, ${Math.round(span)}s)`);
      applied = true; ok++; break;
    }
    if (!applied) { console.log(`✗ ${s.title} — no complete MIDI matched`); fail++; }
  } catch (e) { console.log(`✗ ${s.title} — ${String(e.message).split("\n")[0].slice(0, 50)}`); fail++; }
}
console.log(`\nDONE: ${ok} ok, ${fail} failed`);

if (ok > 0) {                                          // auto-deploy
  try {
    const v = Date.now();
    const gitEnv = { ...process.env }; delete gitEnv.GIT_WORK_TREE; delete gitEnv.GIT_DIR;
    execSync(`sed -i 's/?v=[0-9]*/?v=${v}/g' "${ROOT}/index.html"`);
    execSync(`node -c "${ROOT}/js/songs.js"`);
    execSync(`git -C "${ROOT}" add js/songs.js index.html`, { env: gitEnv });
    execSync(`git -C "${ROOT}" commit -q -m "Real-MIDI picked tracks via bitmidi (melody+guitar+bass)"`, { env: gitEnv });
    execSync(`git -C "${ROOT}" push -q ghpages master`, { env: gitEnv });
    console.log("DEPLOYED");
  } catch (e) { console.log("deploy skipped:", String(e.message).split("\n")[0].slice(0, 80)); }
}
