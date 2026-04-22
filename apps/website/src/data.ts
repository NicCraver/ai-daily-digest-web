import type {
  Digest,
  DigestIndex,
  DigestIndexEntry,
  WeeklyDigest,
  WeeklyIndex,
  WeeklyIndexEntry,
} from "./types";
import { articleSlug, articleSlugFromLink } from "./articleSlug";
import { fullTextLooksPartial } from "./fulltextMeta";

// ───────────────── Daily ─────────────────
// Path is relative to this file: src/data.ts → ../../../data/*.json
// (src → website → apps → monorepo root)
const dayModules = import.meta.glob<Digest>("../../../data/*.json", {
  eager: true,
  import: "default",
});

const dailyIndexModule = import.meta.glob<DigestIndex>("../../../data/index.json", {
  eager: true,
  import: "default",
});

const digestsByDate: Record<string, Digest> = {};
for (const [path, mod] of Object.entries(dayModules)) {
  const match = path.match(/(\d{4}-\d{2}-\d{2})\.json$/);
  if (match) {
    for (const a of mod.articles) {
      if (!a.slug?.trim()) a.slug = articleSlugFromLink(a.link);
      if (
        a.fullTextStatus === "ok" &&
        a.fullText?.blocks?.length &&
        a.fullText.partial === undefined
      ) {
        a.fullText.partial = fullTextLooksPartial(a.fullText.blocks);
      }
    }
    digestsByDate[match[1]] = mod;
  }
}

function countCompleteFullText(articles: Digest["articles"]): number {
  return articles.filter((a) => a.fullTextStatus === "ok" && !a.fullText?.partial).length;
}

const dailyFallback: DigestIndex = {
  dates: Object.values(digestsByDate)
    .map<DigestIndexEntry>((d) => ({
      date: d.date,
      generatedAt: d.generatedAt,
      articleCount: d.articles.length,
      successFullText: countCompleteFullText(d.articles),
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1)),
};

const dailyIndexEntry = Object.values(dailyIndexModule)[0];

function mergeIndexWithDigests(index: DigestIndex): DigestIndex {
  return {
    dates: index.dates.map((entry) => {
      const d = digestsByDate[entry.date];
      if (!d) return entry;
      return {
        ...entry,
        articleCount: d.articles.length,
        successFullText: countCompleteFullText(d.articles),
      };
    }),
  };
}

export const digestIndex: DigestIndex = dailyIndexEntry
  ? mergeIndexWithDigests(dailyIndexEntry)
  : dailyFallback;

export function getDigest(date: string): Digest | undefined {
  return digestsByDate[date];
}

export function getAllDates(): string[] {
  return digestIndex.dates.map((d) => d.date);
}

export function getLatestDate(): string | undefined {
  return digestIndex.dates[0]?.date;
}

/** Routes for SSG: one per article in each daily digest. */
export function getAllArticleRoutes(): string[] {
  const routes: string[] = [];
  for (const date of Object.keys(digestsByDate)) {
    const d = digestsByDate[date];
    if (!d) continue;
    for (const a of d.articles) {
      routes.push(`/d/${date}/a/${articleSlug(a)}`);
    }
  }
  return routes;
}

// ───────────────── Weekly ─────────────────

const weeklyModules = import.meta.glob<WeeklyDigest>("../../../data/weekly/*.json", {
  eager: true,
  import: "default",
});

// Filter out the index.json so it doesn't pollute the weeklyByWeekId map
const weeklyIndexModule = import.meta.glob<WeeklyIndex>("../../../data/weekly/index.json", {
  eager: true,
  import: "default",
});

const weeklyByWeekId: Record<string, WeeklyDigest> = {};
for (const [path, mod] of Object.entries(weeklyModules)) {
  if (path.endsWith("/index.json")) continue;
  const match = path.match(/(\d{4}-W\d{2})\.json$/);
  if (match) {
    for (const a of mod.topPicks) {
      if (!a.slug?.trim()) a.slug = articleSlugFromLink(a.link);
      if (
        a.fullTextStatus === "ok" &&
        a.fullText?.blocks?.length &&
        a.fullText.partial === undefined
      ) {
        a.fullText.partial = fullTextLooksPartial(a.fullText.blocks);
      }
    }
    weeklyByWeekId[match[1]] = mod;
  }
}

const weeklyFallback: WeeklyIndex = {
  weeks: Object.values(weeklyByWeekId)
    .map<WeeklyIndexEntry>((w) => ({
      weekId: w.weekId,
      rangeStart: w.rangeStart,
      rangeEnd: w.rangeEnd,
      generatedAt: w.generatedAt,
      pickCount: w.topPicks.length,
    }))
    .sort((a, b) => (a.weekId < b.weekId ? 1 : -1)),
};

const weeklyIndexEntry = Object.values(weeklyIndexModule)[0];
export const weeklyIndex: WeeklyIndex = weeklyIndexEntry ?? weeklyFallback;

export function getWeekly(weekId: string): WeeklyDigest | undefined {
  return weeklyByWeekId[weekId];
}

export function getAllWeekIds(): string[] {
  return weeklyIndex.weeks.map((w) => w.weekId);
}

export function getLatestWeekId(): string | undefined {
  return weeklyIndex.weeks[0]?.weekId;
}
