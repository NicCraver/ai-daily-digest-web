#!/usr/bin/env bun
/**
 * One-off / maintenance: set `stats.hours` to 24 on daily JSON files.
 * New digests from `bun apps/digest/src/digest.ts --date …` already write 24.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data");

for (const f of await readdir(dataDir)) {
  if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
  const path = join(dataDir, f);
  const raw = await readFile(path, "utf-8");
  const j = JSON.parse(raw) as { stats?: { hours?: number } };
  if (!j.stats) continue;
  if (j.stats.hours === 24) continue;
  j.stats.hours = 24;
  await writeFile(path, `${JSON.stringify(j, null, 2)}\n`);
  console.log(`patched hours → 24: ${f}`);
}
