// Generates public/version.json at build time so the running PWA can
// poll for new deployments and prompt the user to refresh.
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const version = `${Date.now()}`;
const outPath = resolve(process.cwd(), "public/version.json");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ version, builtAt: new Date().toISOString() }, null, 2));
console.log(`[generate-version] wrote ${outPath} (version=${version})`);
