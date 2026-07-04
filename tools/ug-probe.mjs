#!/usr/bin/env node
// ug-probe.mjs "<query>" — investigate automated UG Pro (Guitar Pro) downloads.
// Connects to the logged-in Chrome (CDP :9222), searches UG, opens the top
// guitar-pro result, and tries an IN-PAGE fetch of the download endpoint
// (real browser TLS + cookies + origin — unlike Node fetches that CF blocked).
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = require("/home/archeene/.velocity-gads/node_modules/playwright-core");

const q = process.argv[2] || "beatles blackbird";
const b = await chromium.connectOverCDP("http://localhost:9222");
const ctx = b.contexts()[0];
const page = await ctx.newPage();
try {
  // 1. search
  await page.goto(`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(q)}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const results = await page.evaluate(() => {
    const d = window.UGAPP?.store?.page?.data;
    return (d?.results || []).map((r) => ({ type: r.type, url: r.tab_url, artist: r.artist_name, song: r.song_name, votes: r.votes }));
  });
  console.log("login status:", await page.evaluate(() => (window.UGAPP?.store?.user?.id ? "LOGGED IN uid=" + window.UGAPP.store.user.id : JSON.stringify(Object.keys(window.UGAPP?.store || {})))));
  const pro = results.filter((r) => r.type === "Pro");
  console.log(`results: ${results.length}, Pro: ${pro.length}`);
  if (!pro.length) { console.log("no Pro results"); process.exit(0); }
  console.log("top pro:", JSON.stringify(pro[0]));

  // 2. open the Pro tab page, inspect its store for the download id
  await page.goto(pro[0].url, { waitUntil: "domcontentloaded", timeout: 30000 });
  const info = await page.evaluate(() => {
    const d = window.UGAPP?.store?.page?.data;
    const t = d?.tab || d?.tab_view?.meta || {};
    return { keys: Object.keys(d || {}), tabKeys: Object.keys(d?.tab || {}), id: t.id, viewKeys: Object.keys(d?.tab_view || {}) };
  });
  console.log("page data:", JSON.stringify(info));

  // 3. in-page fetch of the download endpoint
  const dl = await page.evaluate(async (id) => {
    const url = `https://tabs.ultimate-guitar.com/tab/download?id=${id}&session_id=`;
    try {
      const r = await fetch(url, { credentials: "include" });
      const buf = await r.arrayBuffer();
      const bytes = new Uint8Array(buf.slice(0, 16));
      return { status: r.status, ct: r.headers.get("content-type"), size: buf.byteLength,
               head: [...bytes].map((x) => x.toString(16).padStart(2, "0")).join(" ") };
    } catch (e) { return { error: String(e) }; }
  }, info.id);
  console.log("in-page download fetch:", JSON.stringify(dl));
} finally {
  await page.close();
}
process.exit(0);
