export type CategoryId = "ai-ml" | "security" | "engineering" | "tools" | "opinion" | "other";

export type BlockType = "h1" | "h2" | "h3" | "p" | "li" | "quote" | "code";

export interface ContentBlock {
  type: BlockType;
  text: string;
  lang?: string;
}

export interface DigestArticle {
  /** Stable id for routes; SHA-1 hex slice(0,16) of link (matches digest pipeline). */
  slug?: string;
  title: string;
  titleZh: string;
  link: string;
  sourceName: string;
  sourceUrl: string;
  pubDate: string;
  category: CategoryId;
  keywords: string[];
  score: {
    relevance: number;
    quality: number;
    timeliness: number;
    total: number;
  };
  summary: string;
  /** 摘要的英文版（与 `summary` 对应）；无则英文界面回退为 `summary` */
  summaryEn?: string;
  reason: string;
  fullTextStatus: "ok" | "failed" | "skipped";
  fullText: {
    byline?: string;
    siteName?: string;
    partial?: boolean;
    blocks: ContentBlock[];
    translations: string[];
  } | null;
}

export interface Digest {
  date: string;
  generatedAt: string;
  stats: {
    totalFeeds: number;
    successFeeds: number;
    totalArticles: number;
    filteredArticles: number;
    hours: number;
    lang: string;
  };
  highlights: string;
  articles: DigestArticle[];
}

export interface DigestIndexEntry {
  date: string;
  generatedAt: string;
  articleCount: number;
  successFullText: number;
}

export interface DigestIndex {
  dates: DigestIndexEntry[];
}

// ───────────────── Weekly ─────────────────

export interface WeeklyTopPick extends DigestArticle {
  fromDate: string; // YYYY-MM-DD — which daily this article came from
}

export interface WeeklyDigest {
  weekId: string; // ISO week, e.g. "2026-W17"
  rangeStart: string; // YYYY-MM-DD (Monday)
  rangeEnd: string; // YYYY-MM-DD (Sunday)
  generatedAt: string;
  stats: {
    totalDays: number;
    candidateArticles: number;
    uniqueSources: number;
  };
  topPicks: WeeklyTopPick[];
}

export interface WeeklyIndexEntry {
  weekId: string;
  rangeStart: string;
  rangeEnd: string;
  generatedAt: string;
  pickCount: number;
}

export interface WeeklyIndex {
  weeks: WeeklyIndexEntry[];
}

export const CATEGORY_META: Record<CategoryId, { emoji: string; label: string }> = {
  "ai-ml": { emoji: "🤖", label: "AI / ML" },
  security: { emoji: "🔒", label: "安全" },
  engineering: { emoji: "⚙️", label: "工程" },
  tools: { emoji: "🛠", label: "工具 / 开源" },
  opinion: { emoji: "💡", label: "观点 / 杂谈" },
  other: { emoji: "📝", label: "其他" },
};
