#!/usr/bin/env node
// import-ug-popular.mjs — add UG's most-popular-of-all-time songs (chords OR notes)
// via the logged-in Chrome (CDP :9222). Discovers explore?order=hitstotal_desc
// (50/page), then per song: guitar-pro URL -> parse GP notes; chords/tabs URL ->
// extract the chord chart. GENTLE: one tab at a time, paced, resumable (seen file),
// incremental commit per song, MAX songs per run (a bash wrapper restarts the
// browser between chunks so processes never pile up).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const at = require("@coderline/alphatab");
const { chromium } = require("/home/archeene/.velocity-gads/node_modules/playwright-core");
const { execSync } = await import("child_process");

const PAGES = +(process.env.PAGES || 5);               // 5 * 50 = 250 songs
const MAX = +(process.env.MAX || 12);                  // songs imported per run
const SONGS_FILE = path.join(ROOT, "js/songs.js");
const GP_DIR = "/home/archeene/.fretfall/ugdl";
const SEEN_FILE = "/home/archeene/.fretfall/ug_pop_seen.json";
const DEFAULT_STRUM = ["D", "-", "D", "U", "-", "U", "D", "U"];
fs.mkdirSync(GP_DIR, { recursive: true });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
const baseName = (s) => s.replace(/\s*\(ver \d+\)\s*/i, "").replace(/\s*\(.*?\)\s*/g, " ").trim();
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function cleanChart(raw) {
  return raw
    .replace(/\[tab\]|\[\/tab\]/g, "")
    .replace(/\[ch\]([^\[]*)\[\/ch\]/g, "$1")
    .replace(/\[\/?[a-z0-9]+\]/gi, "")
    .split("\n").map((l) => l.replace(/\|/g, " ").replace(/\s+$/, "")).join("\n")
    .replace(/\n{3,}/g, "\n\n").trim();
}
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
  const staff = track.staves[0], TPE = 480, notes = [], chordMarks = [];
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
  if (notes.length) { const off = notes[0].b; if (off > 0) { for (const n of notes) n.b = +(n.b - off).toFixed(3); for (const c of chordMarks) c.b = +Math.max(0, c.b - off).toFixed(3); } }
  const t0 = score.masterBars[0];
  const barEighths = Math.round(t0.timeSignatureNumerator * (8 / t0.timeSignatureDenominator));
  return { title: score.title, artist: score.artist, tempo: Math.round(score.tempo) || 90, capo: staff.capo || 0, barEighths, chordMarks, notes };
}
function noteEntry(id, d, source) {
  const lit = d.notes.map((n) => `{ b: ${n.b}, s: ${n.s}, f: ${n.f} }`);
  const lines = []; for (let i = 0; i < lit.length; i += 8) lines.push("      " + lit.slice(i, i + 8).join(", ") + ",");
  const cm = d.chordMarks.map((c) => `{ b: ${c.b}, name: ${JSON.stringify(c.name)} }`).join(", ");
  return `  {\n    id: ${JSON.stringify(id)},\n    title: ${JSON.stringify(d.title + " — " + d.artist)},\n    source: ${JSON.stringify(source)},\n    bpm: ${d.tempo},\n    capo: ${d.capo},\n    barEighths: ${d.barEighths},\n${d.chordMarks.length ? `    chordMarks: [${cm}],\n` : ""}    notes: [\n${lines.join("\n")}\n    ],\n  },`;
}
function chordEntry(e) {
  return `  {\n    id: ${JSON.stringify(e.id)},\n    title: ${JSON.stringify(e.title)},\n    source: ${JSON.stringify(e.source)},\n    bpm: ${e.bpm},\n    capo: ${e.capo},\n    strum: ${JSON.stringify(DEFAULT_STRUM)},\n    beatsPerBar: 4,\n    chordBars: 1,\n    text: ${JSON.stringify(e.text)},\n  },`;
}

// ---------- connect ----------
const browser = await chromium.connectOverCDP("http://localhost:9222");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();

// ---------- discovery ----------
const cands = new Map();                               // key -> {href, artist, song, type, hits}
for (let p = 1; p <= PAGES; p++) {
  const u = `https://www.ultimate-guitar.com/explore?order=hitstotal_desc${p > 1 ? `&page=${p}` : ""}`;
  await page.goto(u, { waitUntil: "domcontentloaded", timeout: 40000 });
  await page.waitForTimeout(2200);
  const rows = await page.evaluate(() => {
    const out = [];
    for (const a of document.querySelectorAll("a[href*='/tab/']")) {
      const m = a.href.match(/\/tab\/([^/]+)\/(.+?)-(chords|tabs|guitar-pro|official|bass|power|ukulele|drums)-\d+/);
      if (!m) continue;
      const row = a.closest("tr") || a.parentElement?.parentElement;
      const txt = (row?.innerText || "").split("\n").map((x) => x.trim()).filter(Boolean);
      const nums = txt.filter((x) => /^[\d,]+$/.test(x)).map((x) => +x.replace(/,/g, ""));
      out.push({ href: a.href, artist: m[1].replace(/-/g, " "), song: m[2].replace(/-/g, " "),
                 type: m[3], hits: nums.length ? Math.max(...nums) : 0 });
    }
    return out;
  });
  for (const r of rows) {
    if (!/^(chords|tabs|guitar-pro|official)$/.test(r.type)) continue;   // playable types only
    const key = norm(r.artist) + "::" + norm(baseName(r.song));
    const prev = cands.get(key);
    // prefer guitar-pro (notes) > official > chords > tabs, then by hits
    const rank = { "guitar-pro": 3, official: 2, chords: 1, tabs: 0 };
    if (!prev || rank[r.type] > rank[prev.type] || (rank[r.type] === rank[prev.type] && r.hits > prev.hits)) cands.set(key, r);
  }
  console.log(`page ${p}: pool ${cands.size}`);
}

// exclude what's already in the library + tabs already handled
global.window = {};
require(path.join(ROOT, "js/songs.js"));
const libKeys = new Set(global.window.SONGS.map((s) => norm(baseName(s.title.split(" — ")[0]))));
const seen = new Set(fs.existsSync(SEEN_FILE) ? JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")) : []);
const queue = [...cands.values()]
  .filter((c) => !seen.has(c.href) && !libKeys.has(norm(baseName(c.song))))
  .sort((a, b) => b.hits - a.hits)
  .slice(0, MAX);
console.log(`this run: ${queue.length} songs (of ${cands.size} discovered, MAX=${MAX})\n`);

// ---------- import ----------
let src = fs.readFileSync(SONGS_FILE, "utf8");
const existingIds = new Set([...src.matchAll(/id:\s*"([^"]+)"/g)].map((m) => m[1]));
const markSeen = (href) => { seen.add(href); fs.writeFileSync(SEEN_FILE, JSON.stringify([...seen])); };
const uniqId = (base) => { let id = slug(base), n = 2; while (existingIds.has(id)) id = slug(base) + "-" + n++; existingIds.add(id); return id; };
let ok = 0, fail = 0;
for (const c of queue) {
  const tab = await ctx.newPage();
  try {
    if (c.type === "guitar-pro") {
      // notes path
      let dlUrl = null;
      const grab = (r) => { const u = r.url(); if (/\/download\/public\//.test(u)) dlUrl = u; };
      tab.on("request", grab);
      await tab.goto(c.href, { waitUntil: "domcontentloaded", timeout: 45000 });
      let clicked = false;
      for (let i = 0; i < 22 && !dlUrl; i++) {
        await new Promise((r) => setTimeout(r, 800));
        if (!clicked) clicked = await tab.evaluate(() => {
          const el = [...document.querySelectorAll("button, a, [role=button]")].find((e) => /download/i.test(e.innerText || "") || /download/i.test(e.getAttribute("aria-label") || ""));
          if (el) { el.click(); return true; } return false;
        });
      }
      tab.off("request", grab);
      if (!dlUrl) throw new Error("no download url");
      const res = await tab.evaluate(async (u) => {
        const r = await fetch(u, { credentials: "include" });
        const bytes = new Uint8Array(await r.arrayBuffer());
        let s = ""; for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
        return { status: r.status, b64: btoa(s), size: bytes.length };
      }, dlUrl);
      if (res.status !== 200 || res.size < 100) throw new Error("fetch " + res.status);
      const data = parseGP(Buffer.from(res.b64, "base64"));
      if (data.notes.length < 40) throw new Error(`only ${data.notes.length} notes`);
      if (!data.title) data.title = baseName(c.song);
      if (!data.artist) data.artist = c.artist;
      const id = uniqId(data.title + "-" + data.artist);
      src = fs.readFileSync(SONGS_FILE, "utf8");
      const close = src.lastIndexOf("];");
      src = src.slice(0, close) + noteEntry(id, data, c.href) + "\n" + src.slice(close);
      fs.writeFileSync(SONGS_FILE, src);
      markSeen(c.href); ok++;
      console.log(`♪ ${c.artist} - ${c.song} → ${id} (${data.notes.length} notes)`);
    } else {
      // chords path
      await tab.goto(c.href, { waitUntil: "domcontentloaded", timeout: 45000 });
      await tab.waitForTimeout(1500);
      const d = await tab.evaluate(() => {
        const dd = window.UGAPP?.store?.page?.data || {}, tv = dd.tab_view || {}, tb = dd.tab || {};
        return { song: tb.song_name, artist: tb.artist_name,
                 capo: typeof tb.capo === "number" ? tb.capo : 0,
                 bpm: (tv.strummings && tv.strummings[0] && tv.strummings[0].bpm) || 0,
                 content: (tv.wiki_tab && tv.wiki_tab.content) || "" };
      });
      const text = cleanChart(d.content || "");
      const chordTokens = text.match(/\[?[A-G][#b]?(m|maj|min|dim|aug|sus|add|°)?\d*(\/[A-G][#b]?)?/g) || [];
      if (text.length < 40 || chordTokens.length < 4) throw new Error("chart too sparse");
      const id = uniqId((d.song || c.song) + " " + (d.artist || c.artist));
      const bpm = d.bpm >= 40 && d.bpm <= 220 ? d.bpm : 100;
      const e = { id, title: (d.song || baseName(c.song)) + " — " + (d.artist || c.artist), source: c.href, bpm, capo: d.capo || 0, text };
      src = fs.readFileSync(SONGS_FILE, "utf8");
      const close = src.lastIndexOf("];");
      src = src.slice(0, close) + chordEntry(e) + "\n" + src.slice(close);
      fs.writeFileSync(SONGS_FILE, src);
      markSeen(c.href); ok++;
      console.log(`▦ ${c.artist} - ${c.song} → ${id} (${chordTokens.length} chords)`);
    }
  } catch (e) {
    if (!/timeout|closed|navigation/i.test(e.message)) markSeen(c.href);   // content failures = don't retry
    fail++; console.log(`✗ ${c.artist} - ${c.song} — ${String(e.message).slice(0, 50)}`);
  } finally { await tab.close().catch(() => {}); }
  await new Promise((r) => setTimeout(r, 3500));        // gentle pause
}
await page.close().catch(() => {});
console.log(`\nDONE: ${ok} ok, ${fail} failed`);

if (ok > 0) {
  try {
    const v = Date.now();
    const gitEnv = { ...process.env }; delete gitEnv.GIT_WORK_TREE; delete gitEnv.GIT_DIR;
    execSync(`sed -i 's/?v=[0-9]*/?v=${v}/g' "${ROOT}/index.html"`);
    execSync(`node -c "${ROOT}/js/songs.js"`);
    execSync(`git -C "${ROOT}" add js/songs.js index.html`, { env: gitEnv });
    execSync(`git -C "${ROOT}" commit -q -m "Add ${ok} popular UG songs (chords/notes)"`, { env: gitEnv });
    execSync(`git -C "${ROOT}" push -q ghpages master`, { env: gitEnv });
    console.log("DEPLOYED");
  } catch (e) { console.log("deploy skipped:", String(e.message).slice(0, 80)); }
}
process.exit(0);
