#!/usr/bin/env node
// import-ug-top.mjs [count] — import the top beginner/easy Guitar Pro tabs from
// Ultimate Guitar via the logged-in Chrome (CDP :9222). Fully automated:
// explore(difficulty 1+2, type Pro) -> rank by hits -> open tab page -> click
// "Download (gpX)" -> parse GP with alphatab -> append note songs to songs.js.
// Resumable: songs already in the library are skipped.
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const at = require("@coderline/alphatab");
const { chromium } = require("/home/archeene/.velocity-gads/node_modules/playwright-core");
const { execSync } = await import("child_process");

const WANT = +(process.argv[2] || 50);
const DL_DIR = path.join(os.homedir(), "Downloads");
const GP_DIR = "/home/archeene/.fretfall/ugdl";
const SONGS_FILE = path.join(ROOT, "js/songs.js");
fs.mkdirSync(GP_DIR, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const baseName = (s) => s.replace(/\s*\(ver \d+\)\s*/i, "").trim();
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// ---------- GP parsing (from import-songs.mjs, + percussion guard) ----------
function parseGP(buf) {
  const score = at.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(buf), new at.Settings());
  let track = null, best = -1;
  for (const t of score.tracks) {
    if (t.staves[0]?.isPercussion) continue;
    let c = 0;
    for (const bar of t.staves[0].bars) for (const v of bar.voices) for (const b of v.beats) c += b.notes.length;
    if (c > best) { best = c; track = t; }
  }
  if (!track) throw new Error("no melodic track");
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
  if (notes.length) {
    const off = notes[0].b;
    if (off > 0) { for (const n of notes) n.b = +(n.b - off).toFixed(3); for (const c of chordMarks) c.b = +Math.max(0, c.b - off).toFixed(3); }
  }
  const t0 = score.masterBars[0];
  const barEighths = Math.round(t0.timeSignatureNumerator * (8 / t0.timeSignatureDenominator));
  return { title: score.title, artist: score.artist, tempo: Math.round(score.tempo) || 90, capo: staff.capo || 0, barEighths, chordMarks, notes };
}
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

// ---------- discovery ----------
const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
const cands = new Map();                               // base key -> {artist, song, href, hits}
for (const diff of [1, 2]) {
  await page.goto(`https://www.ultimate-guitar.com/explore?type[]=Pro&difficulty[]=${diff}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(2500);
  const rows = await page.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll("a[href*='guitar-pro-']")) {
      const m = a.href.match(/\/tab\/([^/]+)\/(.+)-guitar-pro-\d+/);
      if (!m) continue;
      const row = a.closest("tr") || a.parentElement?.parentElement;
      const txt = (row?.innerText || "").split("\n").map((x) => x.trim()).filter(Boolean);
      const nums = txt.filter((x) => /^[\d,]+$/.test(x)).map((x) => +x.replace(/,/g, ""));
      out.push({ href: a.href,
                 song: (a.innerText || "").trim() || m[2].replace(/-/g, " "),
                 artist: m[1].replace(/-/g, " "),
                 hits: nums.length ? nums[nums.length - 1] : 0 });
    }
    return out;
  });
  for (const r of rows) {
    if (!r.song) continue;
    const key = norm(r.artist) + "::" + norm(baseName(r.song));
    const prev = cands.get(key);
    if (!prev || r.hits > prev.hits) cands.set(key, r);
  }
  console.log(`difficulty ${diff}: ${rows.length} rows (pool ${cands.size})`);
}

// exclude songs already in the library
global.window = {};
require(path.join(ROOT, "js/songs.js"));
const libNorm = new Set(global.window.SONGS.map((s) => norm(baseName(s.title.split(" — ")[0]))));
let list = [...cands.values()]
  .filter((c) => !libNorm.has(norm(baseName(c.song))))
  .sort((a, b) => b.hits - a.hits)
  .slice(0, WANT);
console.log(`importing ${list.length} songs\n`);

// ---------- download + parse ----------
let src = fs.readFileSync(SONGS_FILE, "utf8");
const existingIds = new Set([...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]));
const entries = [];
let ok = 0, fail = 0;
for (const c of list) {
  try {
    // click "Download" and capture the single-use /download/public/ URL the page
    // requests, then re-fetch it IN-PAGE (browser cookies + CF-passing TLS)
    let dlUrl = null;
    const grab = (r) => { const u = r.url(); if (/\/download\/public\//.test(u)) dlUrl = u; };
    page.on("request", grab);
    await page.goto(c.href, { waitUntil: "domcontentloaded", timeout: 30000 });
    let clicked = false;
    for (let i = 0; i < 20 && !dlUrl; i++) {
      await new Promise((r) => setTimeout(r, 700));
      if (!clicked) clicked = await page.evaluate(() => {
        const el = [...document.querySelectorAll("button, a, [role=button]")]
          .find((e) => /download/i.test(e.innerText || "") || /download/i.test(e.getAttribute("aria-label") || ""));
        if (el) { el.click(); return true; }
        return false;
      });
    }
    page.off("request", grab);
    if (!dlUrl) throw new Error(clicked ? "no download url" : "no download button");
    const res = await page.evaluate(async (u) => {
      const r = await fetch(u, { credentials: "include" });
      const bytes = new Uint8Array(await r.arrayBuffer());
      let s = "";
      for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
      return { status: r.status, b64: btoa(s), size: bytes.length };
    }, dlUrl);
    if (res.status !== 200 || res.size < 100) throw new Error("fetch " + res.status + " size " + res.size);
    const buf = Buffer.from(res.b64, "base64");
    const data = parseGP(buf);
    if (data.notes.length < 50) throw new Error(`only ${data.notes.length} notes`);
    if (!data.title) data.title = baseName(c.song);
    if (!data.artist) data.artist = c.artist;
    let id = slug(data.title + "-" + data.artist);
    let n = 2; while (existingIds.has(id)) id = slug(data.title + "-" + data.artist) + "-" + n++;
    existingIds.add(id);
    fs.writeFileSync(path.join(GP_DIR, id + ".gp"), buf);
    entries.push(entryLiteral(id, data, c.href));
    ok++; console.log(`✓ ${c.artist} - ${c.song} → ${id} (${data.notes.length} notes, bpm ${data.tempo})`);
  } catch (e) { fail++; console.log(`✗ ${c.artist} - ${c.song} — ${String(e.message).slice(0, 60)}`); }
  await new Promise((r) => setTimeout(r, 1500));
}
await page.close();
console.log(`\nDONE: ${ok} ok, ${fail} failed`);

if (ok > 0) {
  const close = src.lastIndexOf("];");
  src = src.slice(0, close) + entries.join("\n") + "\n" + src.slice(close);
  fs.writeFileSync(SONGS_FILE, src);
  try {
    const v = Date.now();
    const gitEnv = { ...process.env }; delete gitEnv.GIT_WORK_TREE; delete gitEnv.GIT_DIR;
    execSync(`sed -i 's/?v=[0-9]*/?v=${v}/g' "${ROOT}/index.html"`);
    execSync(`node -c "${ROOT}/js/songs.js"`);
    execSync(`git -C "${ROOT}" add js/songs.js index.html`, { env: gitEnv });
    execSync(`git -C "${ROOT}" commit -q -m "Add ${ok} beginner/easy songs from UG Guitar Pro tabs (real note transcriptions)"`, { env: gitEnv });
    execSync(`git -C "${ROOT}" push -q ghpages master`, { env: gitEnv });
    console.log("DEPLOYED");
  } catch (e) { console.log("deploy skipped:", String(e.message).slice(0, 80)); }
}
process.exit(0);
