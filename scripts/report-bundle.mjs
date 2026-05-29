#!/usr/bin/env node
/**
 * Build artifact reporter.
 * Run after `vite build` to print a per-file bundle size summary
 * (raw + gzip) and totals by type. Helps track FCP/LCP cost over time.
 */
import { readdirSync, statSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, extname, relative } from "node:path";

const DIST = "dist";
if (!existsSync(DIST)) {
  console.error(`[bundle-report] '${DIST}' not found. Run \`vite build\` first.`);
  process.exit(0); // don't fail builds
}

const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push({ path: p, size: st.size });
  }
  return out;
};

const files = walk(DIST);
const buckets = { js: [], css: [], img: [], font: [], html: [], other: [] };
const IMG = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif", ".ico", ".avif"]);
const FONT = new Set([".woff", ".woff2", ".ttf", ".otf"]);

const fileRows = [];
for (const f of files) {
  const ext = extname(f.path).toLowerCase();
  let bucket = "other";
  if (ext === ".js" || ext === ".mjs") bucket = "js";
  else if (ext === ".css") bucket = "css";
  else if (ext === ".html") bucket = "html";
  else if (IMG.has(ext)) bucket = "img";
  else if (FONT.has(ext)) bucket = "font";

  let gzip = 0;
  if (bucket === "js" || bucket === "css" || bucket === "html") {
    try { gzip = gzipSync(readFileSync(f.path)).length; } catch { gzip = 0; }
  }
  const row = { path: relative(DIST, f.path), size: f.size, gzip, bucket };
  buckets[bucket].push(row);
  fileRows.push(row);
}

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
const sum = (arr, key) => arr.reduce((a, b) => a + b[key], 0);

console.log("\n=== Bundle Report ===");
console.log("Per-bucket totals:");
const summary = {};
for (const [k, list] of Object.entries(buckets)) {
  if (!list.length) continue;
  summary[k] = {
    files: list.length,
    raw: kb(sum(list, "size")),
    gzip: list.some((r) => r.gzip) ? kb(sum(list, "gzip")) : "-",
  };
}
console.table(summary);

const topJs = [...buckets.js].sort((a, b) => b.size - a.size).slice(0, 15);
if (topJs.length) {
  console.log("\nTop JS chunks:");
  console.table(
    Object.fromEntries(topJs.map((r) => [r.path, { raw: kb(r.size), gzip: kb(r.gzip) }])),
  );
}
const topImg = [...buckets.img].sort((a, b) => b.size - a.size).slice(0, 10);
if (topImg.length) {
  console.log("\nTop images:");
  console.table(Object.fromEntries(topImg.map((r) => [r.path, { raw: kb(r.size) }])));
}

const totalRaw = sum(fileRows, "size");
const totalGz = sum(fileRows, "gzip");
console.log(`\nTotal output: ${kb(totalRaw)}  (gzip text: ${kb(totalGz)})  across ${fileRows.length} files\n`);

// Persist a JSON snapshot for diffing across builds.
try {
  mkdirSync(".perf", { recursive: true });
  const snapshot = {
    timestamp: new Date().toISOString(),
    totals: { raw: totalRaw, gzipText: totalGz, files: fileRows.length },
    buckets: Object.fromEntries(
      Object.entries(buckets).map(([k, v]) => [k, { files: v.length, raw: sum(v, "size"), gzip: sum(v, "gzip") }]),
    ),
    topJs: topJs.map((r) => ({ path: r.path, size: r.size, gzip: r.gzip })),
  };

  const histPath = ".perf/bundle-history.json";
  let history = [];
  if (existsSync(histPath)) {
    try { history = JSON.parse(readFileSync(histPath, "utf8")); } catch { history = []; }
  }
  history.unshift(snapshot);
  history = history.slice(0, 20); // keep last 20 builds
  writeFileSync(histPath, JSON.stringify(history, null, 2));
  writeFileSync(".perf/bundle-latest.json", JSON.stringify(snapshot, null, 2));

  // Diff vs previous build
  if (history[1]) {
    const prev = history[1].totals;
    const diff = totalRaw - prev.raw;
    const pct = prev.raw ? ((diff / prev.raw) * 100).toFixed(1) : "0.0";
    const arrow = diff > 0 ? "▲" : diff < 0 ? "▼" : "·";
    console.log(`Diff vs previous build: ${arrow} ${kb(Math.abs(diff))} (${pct}%)\n`);
  }
} catch (e) {
  console.warn("[bundle-report] could not write snapshot:", e.message);
}
