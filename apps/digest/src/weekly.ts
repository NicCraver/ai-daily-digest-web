import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

// Repo root = three levels up (src → digest → apps → root)
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_DATA_DIR = join(REPO_ROOT, "data");
const TOP_N_DEFAULT = 10;

// ============================================================================
// Types (mirrors apps/digest/src/digest.ts and apps/website/src/types.ts)
// ============================================================================

interface DigestArticle {
  title: string;
  titleZh: string;
  link: string;
  sourceName: string;
  sourceUrl: string;
  pubDate: string;
  category: string;
  keywords: string[];
  score: { relevance: number; quality: number; timeliness: number; total: number };
  summary: string;
  summaryEn?: string;
  reason: string;
  fullTextStatus: "ok" | "failed" | "skipped";
  fullText: unknown;
}

interface DailyDigest {
  date: string;
  generatedAt: string;
  articles: DigestArticle[];
}

interface WeeklyTopPick extends DigestArticle {
  fromDate: string; // which daily this came from
}

interface WeeklyDigest {
  weekId: string; // ISO week, e.g. "2026-W17"
  rangeStart: string; // YYYY-MM-DD (Monday)
  rangeEnd: string; // YYYY-MM-DD (Sunday)
  generatedAt: string;
  stats: {
    totalDays: number; // how many daily files we found
    candidateArticles: number; // sum of articles across the daily files
    uniqueSources: number;
  };
  topPicks: WeeklyTopPick[];
}

interface WeeklyIndex {
  weeks: Array<{
    weekId: string;
    rangeStart: string;
    rangeEnd: string;
    generatedAt: string;
    pickCount: number;
  }>;
}

// ============================================================================
// ISO Week helpers (UTC, Monday-start, ISO 8601)
// ============================================================================

/** Returns the Monday (00:00 UTC) of the ISO week containing `d`. */
function isoMondayUTC(d: Date): Date {
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  // Convert so Monday=0..Sunday=6
  const offset = (day + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - offset);
  return monday;
}

/** ISO 8601 week number for `d`. */
function isoWeek(d: Date): { year: number; week: number } {
  // Copy and move to nearest Thursday: current date + 4 - current day number
  // (Make Sunday's day number 7)
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // shift to Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekDiff = Math.round(
    (target.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  return { year: target.getUTCFullYear(), week: weekDiff + 1 };
}

function weekId(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Returns the 7 dates (YYYY-MM-DD) for the ISO week containing `anchor`. */
function isoWeekDates(anchor: Date): {
  weekId: string;
  dates: string[];
  start: string;
  end: string;
} {
  const monday = isoMondayUTC(anchor);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(ymd(d));
  }
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const { year, week } = isoWeek(monday);
  return { weekId: weekId(year, week), dates, start: ymd(monday), end: ymd(sunday) };
}

/** Returns the previous ISO week relative to `anchor`. */
function previousIsoWeek(anchor: Date): ReturnType<typeof isoWeekDates> {
  const minus7 = new Date(anchor);
  minus7.setUTCDate(anchor.getUTCDate() - 7);
  return isoWeekDates(minus7);
}

// ============================================================================
// Build
// ============================================================================

async function loadDaily(dataDir: string, dates: string[]): Promise<DailyDigest[]> {
  const out: DailyDigest[] = [];
  for (const date of dates) {
    const path = join(dataDir, `${date}.json`);
    try {
      const buf = await readFile(path, "utf-8");
      out.push(JSON.parse(buf) as DailyDigest);
    } catch {
      // missing day — silently skip
    }
  }
  return out;
}

function buildWeekly(
  dailies: DailyDigest[],
  spec: { weekId: string; start: string; end: string },
  topN: number,
): WeeklyDigest {
  const allPicks: WeeklyTopPick[] = [];
  const sources = new Set<string>();

  for (const day of dailies) {
    for (const art of day.articles) {
      sources.add(art.sourceName);
      allPicks.push({ ...art, fromDate: day.date });
    }
  }

  // Sort by total score desc, tie-break by relevance, then quality, then pubDate (newer first)
  allPicks.sort((a, b) => {
    if (b.score.total !== a.score.total) return b.score.total - a.score.total;
    if (b.score.relevance !== a.score.relevance) return b.score.relevance - a.score.relevance;
    if (b.score.quality !== a.score.quality) return b.score.quality - a.score.quality;
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });

  // Deduplicate by link (in case the same article was selected on multiple days)
  const seen = new Set<string>();
  const deduped: WeeklyTopPick[] = [];
  for (const p of allPicks) {
    if (seen.has(p.link)) continue;
    seen.add(p.link);
    deduped.push(p);
  }

  return {
    weekId: spec.weekId,
    rangeStart: spec.start,
    rangeEnd: spec.end,
    generatedAt: new Date().toISOString(),
    stats: {
      totalDays: dailies.length,
      candidateArticles: allPicks.length,
      uniqueSources: sources.size,
    },
    topPicks: deduped.slice(0, topN),
  };
}

async function writeWeekly(
  weeklyDir: string,
  weekly: WeeklyDigest,
): Promise<{ jsonPath: string; indexPath: string }> {
  await mkdir(weeklyDir, { recursive: true });
  const jsonPath = join(weeklyDir, `${weekly.weekId}.json`);
  await writeFile(jsonPath, JSON.stringify(weekly, null, 2));

  // Update weekly/index.json
  const indexPath = join(weeklyDir, "index.json");
  let idx: WeeklyIndex = { weeks: [] };
  try {
    idx = JSON.parse(await readFile(indexPath, "utf-8")) as WeeklyIndex;
  } catch {
    /* first run */
  }

  const entry = {
    weekId: weekly.weekId,
    rangeStart: weekly.rangeStart,
    rangeEnd: weekly.rangeEnd,
    generatedAt: weekly.generatedAt,
    pickCount: weekly.topPicks.length,
  };
  idx.weeks = idx.weeks.filter((w) => w.weekId !== weekly.weekId);
  idx.weeks.unshift(entry);
  idx.weeks.sort((a, b) => (a.weekId < b.weekId ? 1 : -1));
  await writeFile(indexPath, JSON.stringify(idx, null, 2));

  return { jsonPath, indexPath };
}

// ============================================================================
// CLI
// ============================================================================

function printUsage(): never {
  console.log(`AI Weekly Digest - aggregates daily picks into a weekly Top N

Usage:
  bun src/weekly.ts [options]

Options:
  --week <YYYY-Www>    Build for a specific ISO week (e.g. 2026-W16). Default: previous week (relative to now, UTC).
  --current            Build for the current ISO week instead of the previous one.
  --top-n <n>          Number of top picks (default: ${TOP_N_DEFAULT})
  --data-dir <path>    Directory containing daily JSON files (default: <repo>/data)
  --weekly-dir <path>  Output directory (default: <data-dir>/weekly)
  --help               Show this help

Examples:
  bun src/weekly.ts                       # Build last week's Top 10
  bun src/weekly.ts --current             # Build this week's Top 10 (partial if mid-week)
  bun src/weekly.ts --week 2026-W15       # Backfill specific week
`);
  process.exit(0);
}

function parseWeekArg(weekArg: string): ReturnType<typeof isoWeekDates> {
  const m = weekArg.match(/^(\d{4})-W(\d{1,2})$/);
  if (!m) {
    console.error(`[weekly] Invalid --week "${weekArg}". Expected YYYY-Www (e.g. 2026-W16).`);
    process.exit(1);
  }
  const year = parseInt(m[1]!, 10);
  const week = parseInt(m[2]!, 10);
  // Anchor: Jan 4 is always in ISO week 1, then add (week-1) weeks
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Mon = isoMondayUTC(jan4);
  const target = new Date(week1Mon);
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7);
  return isoWeekDates(target);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) printUsage();

  let weekArg = "";
  let useCurrent = false;
  let topN = TOP_N_DEFAULT;
  let dataDir = DEFAULT_DATA_DIR;
  let weeklyDir = "";

  for (let i = 0; i < args.length; i++) {
    const a = args[i]!;
    if (a === "--week" && args[i + 1]) weekArg = args[++i]!;
    else if (a === "--current") useCurrent = true;
    else if (a === "--top-n" && args[i + 1]) topN = parseInt(args[++i]!, 10);
    else if (a === "--data-dir" && args[i + 1]) dataDir = args[++i]!;
    else if (a === "--weekly-dir" && args[i + 1]) weeklyDir = args[++i]!;
  }

  if (!weeklyDir) weeklyDir = join(dataDir, "weekly");

  let spec: ReturnType<typeof isoWeekDates>;
  if (weekArg) {
    spec = parseWeekArg(weekArg);
  } else if (useCurrent) {
    spec = isoWeekDates(new Date());
  } else {
    spec = previousIsoWeek(new Date());
  }

  console.log(`[weekly] === AI Weekly Digest ===`);
  console.log(`[weekly] Week:      ${spec.weekId} (${spec.start} ~ ${spec.end})`);
  console.log(`[weekly] Top N:     ${topN}`);
  console.log(`[weekly] Data dir:  ${dataDir}`);
  console.log(`[weekly] Out dir:   ${weeklyDir}`);
  console.log("");

  // Validate against existing daily files (skip silently if missing)
  let availableDates: Set<string>;
  try {
    const files = await readdir(dataDir);
    availableDates = new Set(
      files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.replace(/\.json$/, "")),
    );
  } catch {
    availableDates = new Set();
  }
  const present = spec.dates.filter((d) => availableDates.has(d));
  const missing = spec.dates.filter((d) => !availableDates.has(d));
  console.log(
    `[weekly] Daily files present: ${present.length}/7  ${present.join(", ") || "(none)"}`,
  );
  if (missing.length) console.log(`[weekly] Missing days: ${missing.join(", ")}`);

  if (present.length === 0) {
    console.error(`[weekly] No daily files for ${spec.weekId}. Nothing to do.`);
    process.exit(1);
  }

  const dailies = await loadDaily(dataDir, present);
  const weekly = buildWeekly(dailies, spec, topN);
  console.log(
    `[weekly] Aggregated ${weekly.stats.candidateArticles} articles → kept Top ${weekly.topPicks.length}`,
  );

  const { jsonPath, indexPath } = await writeWeekly(weeklyDir, weekly);
  console.log("");
  console.log(`[weekly] ✅ Done!`);
  console.log(`[weekly] 📦 JSON:   ${jsonPath}`);
  console.log(`[weekly] 📦 Index:  ${indexPath}`);

  if (weekly.topPicks.length > 0) {
    console.log("");
    console.log(`[weekly] 🏆 Top 5 preview:`);
    for (let i = 0; i < Math.min(5, weekly.topPicks.length); i++) {
      const p = weekly.topPicks[i]!;
      console.log(`  ${i + 1}. [${p.fromDate}] ⭐${p.score.total}/30  ${p.titleZh || p.title}`);
    }
  }
}

await main().catch((err) => {
  console.error(`[weekly] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
