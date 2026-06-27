#!/usr/bin/env node
// import-songs.mjs — BULK song importer for FretFall.
// Takes a list of "Artist - Title" songs, finds each on gtptabs.com (free, no
// Cloudflare), downloads the Guitar Pro file, parses it losslessly with alphatab
// (exact rhythm/strings/meter + chord labels), and appends a ready-to-play entry
// to ../js/songs.js. Fully automated — no browser, no human clicks.
//
// Usage:
//   node import-songs.mjs songs.txt          # one "Artist - Title" per line
//   node import-songs.mjs "Beatles - Yesterday" "Oasis - Wonderwall"
//   node import-songs.mjs --dry songs.txt    # preview matches, don't write
//
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const at = require("@coderline/alphatab");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONGS_FILE = path.join(__dirname, "..", "js", "songs.js");
const GP_DIR = path.join(__dirname, "gp");                 // cache downloaded files
const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const PC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// ---------- CLI ----------
const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const rest = argv.filter((a) => a !== "--dry");
let songList = [];
if (rest.length === 1 && fs.existsSync(rest[0])) {
  songList = fs.readFileSync(rest[0], "utf8").split("\n").map((l) => l.trim()).filter(Boolean).filter((l) => !l.startsWith("#"));
} else {
  songList = rest;
}
if (!songList.length) { console.error("Provide a songs.txt file or \"Artist - Title\" args."); process.exit(1); }

// ---------- helpers ----------
const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
  .replace(/&/g, "and").replace(/[^a-z0-9 ]/g, " ").replace(/\b(the|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => new Set(norm(s).split(" ").filter(Boolean));
const overlap = (a, b) => { const A = words(a), B = words(b); if (!A.size || !B.size) return 0; let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(A.size, B.size); };
const slug = (s) => norm(s).replace(/ /g, "-");

async function fetchText(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  return r.ok ? r.text() : "";
}
async function fetchBuf(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://gtptabs.com/" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

// search gtptabs once for a query → candidate song pages
async function searchOnce(query) {
  const url = "https://gtptabs.com/search/go.html?SearchForm[searchString]=" + encodeURIComponent(query);
  const html = await fetchText(url);
  const set = new Set();
  for (const m of html.matchAll(/\/tabs\/\d+\/([a-z0-9.-]+)\/([a-z0-9.-]+)\.html/g)) set.add(m[0] + "|" + m[1] + "|" + m[2]);
  return [...set].map((s) => { const [u, a, t] = s.split("|"); return { url: "https://gtptabs.com" + u, artistSlug: a, titleSlug: t }; });
}
// search title+artist AND title alone, merge unique candidates
async function search(title, artist) {
  const seen = new Set(), out = [];
  for (const q of [title + " " + artist, title].filter(Boolean)) {
    for (const c of await searchOnce(q)) if (!seen.has(c.url)) { seen.add(c.url); out.push(c); }
  }
  return out;
}

// candidate title slug → comparable words, with trailing version suffix removed
const baseTitle = (slugStr) => slugStr.replace(/\.\w+$/, "").replace(/-(\d+)$/, "").replace(/-/g, " ");

// rank candidates for an artist+title (best first); only title/artist-plausible ones
function rankCands(cands, artist, title) {
  const tN = norm(title), aN = norm(artist);
  const scored = [];
  for (const c of cands) {
    const tRaw = c.titleSlug.replace(/\.\w+$/, "").replace(/-/g, " ");
    const tScore = Math.max(overlap(tRaw, tN), overlap(baseTitle(c.titleSlug), tN));   // version-agnostic
    const aScore = artist ? overlap(c.artistSlug.replace(/-/g, " "), aN) : 0.5;
    if (tScore < 0.6 || (artist && aScore < 0.34)) continue;     // title must match; artist sanity-check
    const verNum = +(c.titleSlug.match(/-(\d+)\.?\w*$/) || [])[1] || 0;
    const variantPenalty = /-(live|acoustic|solo|intro|full|cover|remix|demo)\b/.test(c.titleSlug) ? 0.3 : 0;
    const score = tScore * 2 + aScore - variantPenalty - Math.min(verNum, 30) * 0.002;
    scored.push({ ...c, tScore, aScore, score });
  }
  return scored.sort((a, b) => b.score - a.score);
}

// from a song page, get the download id + a display title/artist
async function songPageInfo(url) {
  const html = await fetchText(url);
  const dl = (html.match(/\/tabs\/download\/(\d+)\.html/) || [])[1];
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]?.replace(/<[^>]+>/g, "").trim();
  return { dlId: dl, heading: h1 };
}

// parse a Guitar Pro buffer → song data
function parseGP(buf) {
  const score = at.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(buf), new at.Settings());
  let track = score.tracks[0], best = -1;
  for (const t of score.tracks) {
    let c = 0;
    for (const bar of t.staves[0].bars) for (const v of bar.voices) for (const b of v.beats) c += b.notes.length;
    if (c > best) { best = c; track = t; }
  }
  const staff = track.staves[0];
  const TPE = 480;
  const notes = [], chordMarks = [];
  let cum = 0;
  staff.bars.forEach((bar, i) => {
    const mb = score.masterBars[i];
    const bt = mb.timeSignatureNumerator * (3840 / mb.timeSignatureDenominator);
    for (const v of bar.voices) for (const beat of v.beats) {
      if (beat.isRest) continue;
      const b = +(((cum + beat.playbackStart) / TPE).toFixed(3));
      if (beat.chord && beat.chord.name && (!chordMarks.length || chordMarks[chordMarks.length - 1].name !== beat.chord.name))
        chordMarks.push({ b, name: beat.chord.name });
      for (const n of beat.notes) {
        if (n.isDead || n.isTieDestination) continue;
        const s = n.string - 1;
        if (s < 0 || s > 5 || n.fret < 0 || n.fret > 24) continue;
        notes.push({ b, s, f: n.fret });
      }
    }
    cum += bt;
  });
  notes.sort((a, b) => a.b - b.b || a.s - b.s);
  const t0 = score.masterBars[0];
  const barEighths = Math.round(t0.timeSignatureNumerator * (8 / t0.timeSignatureDenominator));
  return { title: score.title, artist: score.artist, tempo: Math.round(score.tempo) || 90, capo: staff.capo || 0, barEighths, chordMarks, notes };
}

// build the JS entry literal
function entryLiteral(id, data, source) {
  const lit = data.notes.map((n) => `{ b: ${n.b}, s: ${n.s}, f: ${n.f} }`);
  const lines = [];
  for (let i = 0; i < lit.length; i += 8) lines.push("      " + lit.slice(i, i + 8).join(", ") + ",");
  const cm = data.chordMarks.map((c) => `{ b: ${c.b}, name: ${JSON.stringify(c.name)} }`).join(", ");
  return `  {
    id: ${JSON.stringify(id)},
    title: ${JSON.stringify(data.title + " — " + data.artist)},
    source: ${JSON.stringify(source)},
    bpm: ${data.tempo},
    capo: ${data.capo},
    barEighths: ${data.barEighths},
${data.chordMarks.length ? `    chordMarks: [${cm}],\n` : ""}    notes: [
${lines.join("\n")}
    ],
  },`;
}

// ---------- main ----------
fs.mkdirSync(GP_DIR, { recursive: true });
let src = fs.readFileSync(SONGS_FILE, "utf8");
const existingIds = new Set([...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]));
const results = [];

for (const line of songList) {
  const [artist, title] = line.includes(" - ") ? line.split(/\s+-\s+/) : line.includes("|") ? line.split("|") : ["", line];
  const label = (artist ? artist + " - " : "") + title;
  try {
    const cands = await search(title.trim(), artist.trim());
    const ranked = rankCands(cands, artist.trim(), title.trim());
    if (!ranked.length) { results.push({ label, ok: false, why: "no match" }); console.log(`✗ ${label} — no match`); continue; }
    // try the top candidates, keep the RICHEST arrangement (most notes) — avoids fragment/empty tabs
    const MIN_NOTES = 50, GOOD_NOTES = 250, MAX_TRY = 6;
    let bestData = null, bestBuf = null, bestSrc = null, tried = 0;
    for (const c of ranked.slice(0, MAX_TRY)) {
      try {
        const { dlId } = await songPageInfo(c.url);
        if (!dlId) continue;
        const buf = await fetchBuf("https://gtptabs.com/tabs/download/" + dlId + ".html");
        if (!/FICHIER GUITAR PRO|^PK|GP2[12]/.test(buf.slice(0, 24).toString("latin1"))) continue;
        tried++;
        const data = parseGP(buf);
        if (!bestData || data.notes.length > bestData.notes.length) { bestData = data; bestBuf = buf; bestSrc = c.url; }
        if (bestData.notes.length >= GOOD_NOTES) break;          // rich enough, stop early
      } catch { /* try next candidate */ }
    }
    if (!bestData || bestData.notes.length < MIN_NOTES) {
      results.push({ label, ok: false, why: bestData ? `only ${bestData.notes.length} notes (fragment)` : "no usable version" });
      console.log(`✗ ${label} — ${bestData ? `best version only ${bestData.notes.length} notes` : "no usable version"}`); continue;
    }
    if (!bestData.title) bestData.title = title.trim();
    if (!bestData.artist) bestData.artist = artist.trim();
    let id = slug(bestData.title);
    let n = 2; while (existingIds.has(id)) id = slug(bestData.title) + "-" + n++;
    fs.writeFileSync(path.join(GP_DIR, id + ".gp"), bestBuf);
    results.push({ label, ok: true, id, notes: bestData.notes.length, bpm: bestData.tempo, capo: bestData.capo, chords: bestData.chordMarks.length, source: bestSrc, data: bestData });
    existingIds.add(id);
    console.log(`✓ ${label} → ${id}  (${bestData.notes.length} notes, ${bestData.chordMarks.length} chords, bpm ${bestData.tempo}, capo ${bestData.capo})  [tried ${tried}]`);
  } catch (e) {
    results.push({ label, ok: false, why: e.message });
    console.log(`✗ ${label} — ${e.message}`);
  }
}

const good = results.filter((r) => r.ok);
console.log(`\n${good.length}/${results.length} imported.`);

if (DRY) { console.log("(dry run — songs.js not modified)"); process.exit(0); }
if (!good.length) process.exit(0);

// splice all new entries before the final "];"
const entries = good.map((r) => entryLiteral(r.id, r.data, r.source)).join("\n");
const close = src.lastIndexOf("];");
src = src.slice(0, close) + entries + "\n" + src.slice(close);
fs.writeFileSync(SONGS_FILE, src);
console.log(`Added ${good.length} song(s) to js/songs.js:`);
good.forEach((r) => console.log(`  - ${r.id}`));
