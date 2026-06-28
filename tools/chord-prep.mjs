#!/usr/bin/env node
// chord-prep.mjs <songId> <out.json>
// Dump a chord song's UNIQUE chords with their pitch-class sets (for audio chord
// recognition) — the song's own chords constrain recognition so it's robust.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
global.window = {};
require(path.join(ROOT, "js/songs.js"));
require(path.join(ROOT, "js/tabParser.js"));
const { SONGS, TabParser } = global.window;
const s = SONGS.find((x) => x.id === process.argv[2]);
if (!s || !s.text) { console.error("chord song not found"); process.exit(1); }
const chords = TabParser.parseTab(s.text).chords;
const seen = new Map();
for (const c of chords) if (!seen.has(c.name)) seen.set(c.name, { name: c.name, pcs: c.pcs });
fs.writeFileSync(process.argv[3], JSON.stringify({ unique: [...seen.values()] }));
console.log(`${process.argv[2]}: ${seen.size} unique chords`);
