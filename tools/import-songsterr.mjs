#!/usr/bin/env node
// import-songsterr.mjs [idFilter] — Step 1 real-source import via Songsterr.
// Songsterr tabs are EXACT human transcriptions: string, fret, duration fractions,
// tempo, capo, section markers. For each chord song: search, match artist+title,
// fetch the tab JSON per track (CDN), convert main guitar + lead + bass to `picked`
// in exact beat space (no seconds round-trip). Resumable via sngstr_<id> markers;
// skips songs that already got a real MIDI (midi_<id>).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const FT = "/home/archeene/.fretfall";
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const OPEN = [40, 45, 50, 55, 59, 64]; // low E .. high e
const STD = "[64,59,55,50,45,40]";     // Songsterr tuning arrays are high->low
const { execSync } = await import("child_process");

const norm = (s) => (s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9 ]/g, " ").replace(/\b(the|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => new Set(norm(s).split(" ").filter(Boolean));
const overlap = (a, b) => { const A = words(a), B = words(b); if (!A.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / A.size; };
const get = async (url) => { const r = await fetch(url, { headers: { "User-Agent": UA } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r; };
const getJson = async (url) => (await get(url)).json();

// --- convert one Songsterr track to events [{b, s?, f?, pitch?}] in eighth space ---
function trackEvents(trk, songCapo) {
  const verbatim = JSON.stringify(trk.tuning) === STD && (trk.capo || 0) === (songCapo || 0);
  const ms = trk.measures || [];
  // expand repeats (repeatStart .. measure with repeat:N plays N times)
  const seq = []; let repStart = 0;
  for (let i = 0; i < ms.length; i++) {
    if (ms[i].repeatStart) repStart = i;
    seq.push(i);
    if (ms[i].repeat > 1) for (let r = 1; r < ms[i].repeat; r++) for (let j = repStart; j <= i; j++) seq.push(j);
  }
  let sig = [4, 4], pos = 0; const evs = [];
  for (const mi of seq) {
    const m = ms[mi];
    if (m.signature) sig = m.signature;
    const mLen = (sig[0] * 8) / sig[1];              // eighths per measure
    for (const v of m.voices || []) {
      let p = pos;
      for (const bt of v.beats || []) {
        const dur = ((bt.duration?.[0] ?? 1) / (bt.duration?.[1] ?? 4)) * 8;
        if (!bt.rest) for (const n of bt.notes || []) {
          if (n.rest || n.tie || n.grace || n.fret == null || n.string == null) continue;
          const b = Math.round(p * 4) / 4;
          if (verbatim) evs.push({ b, s: 5 - n.string, f: n.fret });
          else evs.push({ b, pitch: (trk.tuning[n.string] ?? 40) + n.fret + (trk.capo || 0) });
        }
        p += dur;
      }
    }
    pos += mLen;
  }
  return evs;
}

// pitch -> {s,f} on standard tuning honoring the song's capo (fingered fret)
function mapPitch(pitch, songCapo, used) {
  let p = pitch;
  while (p < OPEN[0] + songCapo) p += 12;
  while (p > 88 + songCapo) p -= 12;
  const preferHigh = p >= 57 + songCapo;
  const cands = [];
  for (let s = 0; s < 6; s++) { const f = p - songCapo - OPEN[s]; if (f >= 0 && f <= 15 && !used.has(s)) cands.push({ s, f }); }
  if (!cands.length) return null;
  cands.sort((a, c) => ((preferHigh ? 5 - a.s : a.s) + a.f * 0.5) - ((preferHigh ? 5 - c.s : c.s) + c.f * 0.5));
  return cands[0];
}

const countNotes = (trk) => { let n = 0; for (const m of trk.measures || []) for (const v of m.voices || []) for (const bt of v.beats || []) if (!bt.rest) for (const x of bt.notes || []) if (!x.rest && !x.tie && x.fret != null) n++; return n; };

// --- splice picked into songs.js (same mechanism as chord-apply) ---
function splice(songId, out, bpm) {
  const lit = out.map((n) => `{ b: ${n.b}, s: ${n.s}, f: ${n.f} }`);
  const lines = [];
  for (let i = 0; i < lit.length; i += 8) lines.push("      " + lit.slice(i, i + 8).join(", ") + ",");
  const block = `picked: [\n${lines.join("\n")}\n    ],\n    `;
  const F = path.join(ROOT, "js/songs.js");
  let src = fs.readFileSync(F, "utf8");
  const idIdx = src.indexOf(`id: ${JSON.stringify(songId)}`);
  const entryStart = src.lastIndexOf("{", idIdx);
  const closeIdx = src.indexOf("\n  },", idIdx);
  let entry = src.slice(entryStart, closeIdx);
  if (bpm) entry = entry.replace(/bpm: \d+(\.\d+)?/, `bpm: ${bpm}`);
  if (/picked: \[/.test(entry)) entry = entry.replace(/picked: \[[\s\S]*?\],\n\s*/, block);
  else if (/\n\s*text:/.test(entry)) entry = entry.replace(/(\n\s*)text:/, `$1${block}text:`);
  src = src.slice(0, entryStart) + entry + src.slice(closeIdx);
  fs.writeFileSync(F, src);
}

const filter = process.argv[2] || "";
global.window = {};
require(path.join(ROOT, "js/songs.js"));
const songs = global.window.SONGS.filter((s) => !(s.notes && s.notes.length) && s.text && s.id.includes(filter));
console.log(`${songs.length} chord songs for Songsterr import${filter ? ` (filter: ${filter})` : ""}\n`);

let ok = 0, fail = 0;
for (const s of songs) {
  const id = s.id, marker = `${FT}/sngstr_${id}`;
  if (fs.existsSync(marker)) { console.log(`· skip (done): ${s.title}`); ok++; continue; }
  if (fs.existsSync(`${FT}/midi_${id}`)) { console.log(`· skip (has real MIDI): ${s.title}`); ok++; continue; }
  const [title, artist = ""] = s.title.split(" — ");
  try {
    // 1. search (artist+title, fall back to title only)
    let res = await getJson(`https://www.songsterr.com/api/songs?pattern=${encodeURIComponent(`${artist} ${title}`)}&size=20`);
    if (!res.length) res = await getJson(`https://www.songsterr.com/api/songs?pattern=${encodeURIComponent(title)}&size=20`);
    const cand = res
      .map((c) => ({ ...c, score: overlap(title, c.title) + overlap(artist, c.artist) }))
      .filter((c) => c.hasPlayer && overlap(title, c.title) >= 0.7 && (!artist || overlap(artist, c.artist) >= 0.5))
      .sort((a, b) => b.score - a.score)[0];
    if (!cand) { console.log(`✗ ${s.title} — no Songsterr match`); fail++; continue; }

    // 2. page -> revision image id for CDN urls
    const html = await (await get(`https://www.songsterr.com/a/wsa/x-tab-s${cand.songId}`)).text();
    const image = html.match(/"image":"([^"]+)"/)?.[1];
    const revisionId = [...html.matchAll(/"revisionId":(\d+)/g)].map((m) => m[1]).find((r) => r !== "0");
    if (!image || !revisionId) { console.log(`✗ ${s.title} — no revision image`); fail++; continue; }

    // 3. fetch candidate tracks (skip drums/vocals), count notes
    const cands = [];
    for (let i = 0; i < (cand.tracks || []).length; i++) {
      const t = cand.tracks[i];
      if (/^(drums|vocals)_/.test(t.hash || "") || t.instrumentId === 1024) continue;
      try {
        const trk = await getJson(`https://dqsljvtekg760.cloudfront.net/${cand.songId}/${revisionId}/${image}/${i}.json`);
        const n = countNotes(trk);
        if (n >= 8) cands.push({ i, t, trk, n, isBass: /^bass_/.test(t.hash || "") });
      } catch {}
    }
    if (!cands.length) { console.log(`✗ ${s.title} — no note tracks`); fail++; continue; }

    // 4. pick main (most notes, non-bass) + lead/riff/melody + bass
    const melodic = cands.filter((c) => !c.isBass).sort((a, b) => b.n - a.n);
    const main = melodic[0];
    const lead = melodic.find((c) => c !== main && /lead|riff|melody|solo|intro|pick/i.test(c.t.name || "") && c.n >= 20);
    const bass = cands.filter((c) => c.isBass).sort((a, b) => b.n - a.n)[0];
    const chosen = [main, lead, bass].filter(Boolean);

    // 5. convert to eighth-space events, map pitches, merge
    const capo = s.capo || 0;
    const byB = new Map();
    const notes = [];
    for (const c of chosen) {
      for (const ev of trackEvents(c.trk, capo)) {
        if (!byB.has(ev.b)) byB.set(ev.b, new Set());
        const used = byB.get(ev.b);
        if (ev.s != null) {
          if (used.has(ev.s)) continue;
          used.add(ev.s); notes.push({ b: ev.b, s: ev.s, f: ev.f });
        } else {
          const m = mapPitch(ev.pitch, capo, used);
          if (m) { used.add(m.s); notes.push({ b: ev.b, s: m.s, f: m.f }); }
        }
      }
    }
    notes.sort((a, b) => a.b - b.b || a.s - b.s);
    const seen = new Set(), out = [];
    for (const n of notes) { const k = n.b + "_" + n.s + "_" + n.f; if (!seen.has(k)) { seen.add(k); out.push(n); } }
    if (out.length) { const off = out[0].b; if (off > 0) for (const n of out) n.b = +(n.b - off).toFixed(3); }
    const span = out.length ? out[out.length - 1].b : 0;
    if (out.length < 60 || span < 240) { console.log(`✗ ${s.title} — too small (${out.length} notes, ${Math.round(span)} eighths)`); fail++; continue; }

    // 6. bpm + splice + marker
    const ta = main.trk.automations?.tempo?.[0];
    const bpm = ta ? Math.max(40, Math.min(220, Math.round(ta.bpm * (ta.type ? 4 / ta.type : 1)))) : 0;
    splice(id, out, bpm);
    fs.writeFileSync(marker, JSON.stringify({ songId: cand.songId, revisionId, tracks: chosen.map((c) => `${c.i}:${c.t.name || c.t.instrument} (${c.n})`) }));
    console.log(`✓ ${s.title}  ← s${cand.songId} [${chosen.map((c) => `${c.t.name || c.t.instrument}(${c.n})`).join(" + ")}] ${out.length} notes, ${Math.round(span)} eighths, bpm ${bpm}`);
    ok++;
  } catch (e) { console.log(`✗ ${s.title} — ${String(e.message).split("\n")[0].slice(0, 60)}`); fail++; }
  await new Promise((r) => setTimeout(r, 400));          // be polite to the API
}
console.log(`\nDONE: ${ok} ok, ${fail} failed`);

if (ok > 0) {                                            // auto-deploy
  try {
    const v = Date.now();
    const gitEnv = { ...process.env }; delete gitEnv.GIT_WORK_TREE; delete gitEnv.GIT_DIR;
    execSync(`sed -i 's/?v=[0-9]*/?v=${v}/g' "${ROOT}/index.html"`);
    execSync(`node -c "${ROOT}/js/songs.js"`);
    execSync(`git -C "${ROOT}" add js/songs.js index.html`, { env: gitEnv });
    execSync(`git -C "${ROOT}" commit -q -m "Real Songsterr tab picked tracks (exact human transcriptions)"`, { env: gitEnv });
    execSync(`git -C "${ROOT}" push -q ghpages master`, { env: gitEnv });
    console.log("DEPLOYED");
  } catch (e) { console.log("deploy skipped:", String(e.message).split("\n")[0].slice(0, 80)); }
}
