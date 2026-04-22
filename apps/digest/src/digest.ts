import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import process from "node:process";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

import {
  createAIClient,
  inferOpenAIModel,
  type AIClient,
  OPENAI_DEFAULT_API_BASE,
  resolveGeminiGenerateUrl,
} from "./ai-provider";

// Monorepo root = three levels up from this file (src/ → digest/ → apps/ → root)
const MONOREPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DEFAULT_DATA_DIR = join(MONOREPO_ROOT, "data");
const DEFAULT_CACHE_DIR = join(MONOREPO_ROOT, "output/cache");

// ============================================================================
// Constants
// ============================================================================

const FEED_FETCH_TIMEOUT_MS = 15_000;
const ARTICLE_FETCH_TIMEOUT_MS = 20_000;
const FEED_CONCURRENCY = 10;
const ARTICLE_CONCURRENCY = 4;
const GEMINI_BATCH_SIZE = 10;
const MAX_CONCURRENT_GEMINI = 2;
const TRANSLATE_BLOCK_CHARS = 3500;
const CACHE_DIR = DEFAULT_CACHE_DIR;

// 90 RSS feeds from Hacker News Popularity Contest 2025 (curated by Karpathy)
const RSS_FEEDS: Array<{ name: string; xmlUrl: string; htmlUrl: string }> = [
  {
    name: "simonwillison.net",
    xmlUrl: "https://simonwillison.net/atom/everything/",
    htmlUrl: "https://simonwillison.net",
  },
  {
    name: "jeffgeerling.com",
    xmlUrl: "https://www.jeffgeerling.com/blog.xml",
    htmlUrl: "https://jeffgeerling.com",
  },
  {
    name: "seangoedecke.com",
    xmlUrl: "https://www.seangoedecke.com/rss.xml",
    htmlUrl: "https://seangoedecke.com",
  },
  {
    name: "krebsonsecurity.com",
    xmlUrl: "https://krebsonsecurity.com/feed/",
    htmlUrl: "https://krebsonsecurity.com",
  },
  {
    name: "daringfireball.net",
    xmlUrl: "https://daringfireball.net/feeds/main",
    htmlUrl: "https://daringfireball.net",
  },
  { name: "ericmigi.com", xmlUrl: "https://ericmigi.com/rss.xml", htmlUrl: "https://ericmigi.com" },
  { name: "antirez.com", xmlUrl: "http://antirez.com/rss", htmlUrl: "http://antirez.com" },
  { name: "idiallo.com", xmlUrl: "https://idiallo.com/feed.rss", htmlUrl: "https://idiallo.com" },
  {
    name: "maurycyz.com",
    xmlUrl: "https://maurycyz.com/index.xml",
    htmlUrl: "https://maurycyz.com",
  },
  {
    name: "pluralistic.net",
    xmlUrl: "https://pluralistic.net/feed/",
    htmlUrl: "https://pluralistic.net",
  },
  { name: "shkspr.mobi", xmlUrl: "https://shkspr.mobi/blog/feed/", htmlUrl: "https://shkspr.mobi" },
  {
    name: "lcamtuf.substack.com",
    xmlUrl: "https://lcamtuf.substack.com/feed",
    htmlUrl: "https://lcamtuf.substack.com",
  },
  {
    name: "mitchellh.com",
    xmlUrl: "https://mitchellh.com/feed.xml",
    htmlUrl: "https://mitchellh.com",
  },
  {
    name: "dynomight.net",
    xmlUrl: "https://dynomight.net/feed.xml",
    htmlUrl: "https://dynomight.net",
  },
  {
    name: "utcc.utoronto.ca/~cks",
    xmlUrl: "https://utcc.utoronto.ca/~cks/space/blog/?atom",
    htmlUrl: "https://utcc.utoronto.ca/~cks",
  },
  { name: "xeiaso.net", xmlUrl: "https://xeiaso.net/blog.rss", htmlUrl: "https://xeiaso.net" },
  {
    name: "devblogs.microsoft.com/oldnewthing",
    xmlUrl: "https://devblogs.microsoft.com/oldnewthing/feed",
    htmlUrl: "https://devblogs.microsoft.com/oldnewthing",
  },
  {
    name: "righto.com",
    xmlUrl: "https://www.righto.com/feeds/posts/default",
    htmlUrl: "https://righto.com",
  },
  {
    name: "lucumr.pocoo.org",
    xmlUrl: "https://lucumr.pocoo.org/feed.atom",
    htmlUrl: "https://lucumr.pocoo.org",
  },
  { name: "skyfall.dev", xmlUrl: "https://skyfall.dev/rss.xml", htmlUrl: "https://skyfall.dev" },
  {
    name: "garymarcus.substack.com",
    xmlUrl: "https://garymarcus.substack.com/feed",
    htmlUrl: "https://garymarcus.substack.com",
  },
  {
    name: "rachelbythebay.com",
    xmlUrl: "https://rachelbythebay.com/w/atom.xml",
    htmlUrl: "https://rachelbythebay.com",
  },
  {
    name: "overreacted.io",
    xmlUrl: "https://overreacted.io/rss.xml",
    htmlUrl: "https://overreacted.io",
  },
  { name: "timsh.org", xmlUrl: "https://timsh.org/rss/", htmlUrl: "https://timsh.org" },
  {
    name: "johndcook.com",
    xmlUrl: "https://www.johndcook.com/blog/feed/",
    htmlUrl: "https://johndcook.com",
  },
  {
    name: "gilesthomas.com",
    xmlUrl: "https://gilesthomas.com/feed/rss.xml",
    htmlUrl: "https://gilesthomas.com",
  },
  {
    name: "matklad.github.io",
    xmlUrl: "https://matklad.github.io/feed.xml",
    htmlUrl: "https://matklad.github.io",
  },
  {
    name: "derekthompson.org",
    xmlUrl: "https://www.theatlantic.com/feed/author/derek-thompson/",
    htmlUrl: "https://derekthompson.org",
  },
  {
    name: "evanhahn.com",
    xmlUrl: "https://evanhahn.com/feed.xml",
    htmlUrl: "https://evanhahn.com",
  },
  {
    name: "terriblesoftware.org",
    xmlUrl: "https://terriblesoftware.org/feed/",
    htmlUrl: "https://terriblesoftware.org",
  },
  {
    name: "rakhim.exotext.com",
    xmlUrl: "https://rakhim.exotext.com/rss.xml",
    htmlUrl: "https://rakhim.exotext.com",
  },
  {
    name: "joanwestenberg.com",
    xmlUrl: "https://joanwestenberg.com/rss",
    htmlUrl: "https://joanwestenberg.com",
  },
  { name: "xania.org", xmlUrl: "https://xania.org/feed", htmlUrl: "https://xania.org" },
  {
    name: "micahflee.com",
    xmlUrl: "https://micahflee.com/feed/",
    htmlUrl: "https://micahflee.com",
  },
  { name: "nesbitt.io", xmlUrl: "https://nesbitt.io/feed.xml", htmlUrl: "https://nesbitt.io" },
  {
    name: "construction-physics.com",
    xmlUrl: "https://www.construction-physics.com/feed",
    htmlUrl: "https://construction-physics.com",
  },
  { name: "tedium.co", xmlUrl: "https://feed.tedium.co/", htmlUrl: "https://tedium.co" },
  { name: "susam.net", xmlUrl: "https://susam.net/feed.xml", htmlUrl: "https://susam.net" },
  {
    name: "entropicthoughts.com",
    xmlUrl: "https://entropicthoughts.com/feed.xml",
    htmlUrl: "https://entropicthoughts.com",
  },
  {
    name: "buttondown.com/hillelwayne",
    xmlUrl: "https://buttondown.com/hillelwayne/rss",
    htmlUrl: "https://buttondown.com/hillelwayne",
  },
  {
    name: "dwarkesh.com",
    xmlUrl: "https://www.dwarkeshpatel.com/feed",
    htmlUrl: "https://dwarkesh.com",
  },
  { name: "borretti.me", xmlUrl: "https://borretti.me/feed.xml", htmlUrl: "https://borretti.me" },
  {
    name: "wheresyoured.at",
    xmlUrl: "https://www.wheresyoured.at/rss/",
    htmlUrl: "https://wheresyoured.at",
  },
  { name: "jayd.ml", xmlUrl: "https://jayd.ml/feed.xml", htmlUrl: "https://jayd.ml" },
  {
    name: "minimaxir.com",
    xmlUrl: "https://minimaxir.com/index.xml",
    htmlUrl: "https://minimaxir.com",
  },
  {
    name: "geohot.github.io",
    xmlUrl: "https://geohot.github.io/blog/feed.xml",
    htmlUrl: "https://geohot.github.io",
  },
  {
    name: "paulgraham.com",
    xmlUrl: "http://www.aaronsw.com/2002/feeds/pgessays.rss",
    htmlUrl: "https://paulgraham.com",
  },
  { name: "filfre.net", xmlUrl: "https://www.filfre.net/feed/", htmlUrl: "https://filfre.net" },
  {
    name: "blog.jim-nielsen.com",
    xmlUrl: "https://blog.jim-nielsen.com/feed.xml",
    htmlUrl: "https://blog.jim-nielsen.com",
  },
  {
    name: "dfarq.homeip.net",
    xmlUrl: "https://dfarq.homeip.net/feed/",
    htmlUrl: "https://dfarq.homeip.net",
  },
  { name: "jyn.dev", xmlUrl: "https://jyn.dev/atom.xml", htmlUrl: "https://jyn.dev" },
  {
    name: "geoffreylitt.com",
    xmlUrl: "https://www.geoffreylitt.com/feed.xml",
    htmlUrl: "https://geoffreylitt.com",
  },
  {
    name: "downtowndougbrown.com",
    xmlUrl: "https://www.downtowndougbrown.com/feed/",
    htmlUrl: "https://downtowndougbrown.com",
  },
  { name: "brutecat.com", xmlUrl: "https://brutecat.com/rss.xml", htmlUrl: "https://brutecat.com" },
  {
    name: "eli.thegreenplace.net",
    xmlUrl: "https://eli.thegreenplace.net/feeds/all.atom.xml",
    htmlUrl: "https://eli.thegreenplace.net",
  },
  {
    name: "abortretry.fail",
    xmlUrl: "https://www.abortretry.fail/feed",
    htmlUrl: "https://abortretry.fail",
  },
  {
    name: "fabiensanglard.net",
    xmlUrl: "https://fabiensanglard.net/rss.xml",
    htmlUrl: "https://fabiensanglard.net",
  },
  {
    name: "oldvcr.blogspot.com",
    xmlUrl: "https://oldvcr.blogspot.com/feeds/posts/default",
    htmlUrl: "https://oldvcr.blogspot.com",
  },
  {
    name: "bogdanthegeek.github.io",
    xmlUrl: "https://bogdanthegeek.github.io/blog/index.xml",
    htmlUrl: "https://bogdanthegeek.github.io",
  },
  {
    name: "hugotunius.se",
    xmlUrl: "https://hugotunius.se/feed.xml",
    htmlUrl: "https://hugotunius.se",
  },
  { name: "gwern.net", xmlUrl: "https://gwern.substack.com/feed", htmlUrl: "https://gwern.net" },
  {
    name: "berthub.eu",
    xmlUrl: "https://berthub.eu/articles/index.xml",
    htmlUrl: "https://berthub.eu",
  },
  {
    name: "chadnauseam.com",
    xmlUrl: "https://chadnauseam.com/rss.xml",
    htmlUrl: "https://chadnauseam.com",
  },
  { name: "simone.org", xmlUrl: "https://simone.org/feed/", htmlUrl: "https://simone.org" },
  {
    name: "it-notes.dragas.net",
    xmlUrl: "https://it-notes.dragas.net/feed/",
    htmlUrl: "https://it-notes.dragas.net",
  },
  { name: "beej.us", xmlUrl: "https://beej.us/blog/rss.xml", htmlUrl: "https://beej.us" },
  { name: "hey.paris", xmlUrl: "https://hey.paris/index.xml", htmlUrl: "https://hey.paris" },
  {
    name: "danielwirtz.com",
    xmlUrl: "https://danielwirtz.com/rss.xml",
    htmlUrl: "https://danielwirtz.com",
  },
  { name: "matduggan.com", xmlUrl: "https://matduggan.com/rss/", htmlUrl: "https://matduggan.com" },
  {
    name: "refactoringenglish.com",
    xmlUrl: "https://refactoringenglish.com/index.xml",
    htmlUrl: "https://refactoringenglish.com",
  },
  {
    name: "worksonmymachine.substack.com",
    xmlUrl: "https://worksonmymachine.substack.com/feed",
    htmlUrl: "https://worksonmymachine.substack.com",
  },
  {
    name: "philiplaine.com",
    xmlUrl: "https://philiplaine.com/index.xml",
    htmlUrl: "https://philiplaine.com",
  },
  {
    name: "steveblank.com",
    xmlUrl: "https://steveblank.com/feed/",
    htmlUrl: "https://steveblank.com",
  },
  {
    name: "bernsteinbear.com",
    xmlUrl: "https://bernsteinbear.com/feed.xml",
    htmlUrl: "https://bernsteinbear.com",
  },
  {
    name: "danieldelaney.net",
    xmlUrl: "https://danieldelaney.net/feed",
    htmlUrl: "https://danieldelaney.net",
  },
  {
    name: "troyhunt.com",
    xmlUrl: "https://www.troyhunt.com/rss/",
    htmlUrl: "https://troyhunt.com",
  },
  {
    name: "herman.bearblog.dev",
    xmlUrl: "https://herman.bearblog.dev/feed/",
    htmlUrl: "https://herman.bearblog.dev",
  },
  {
    name: "tomrenner.com",
    xmlUrl: "https://tomrenner.com/index.xml",
    htmlUrl: "https://tomrenner.com",
  },
  {
    name: "blog.pixelmelt.dev",
    xmlUrl: "https://blog.pixelmelt.dev/rss/",
    htmlUrl: "https://blog.pixelmelt.dev",
  },
  {
    name: "martinalderson.com",
    xmlUrl: "https://martinalderson.com/feed.xml",
    htmlUrl: "https://martinalderson.com",
  },
  {
    name: "danielchasehooper.com",
    xmlUrl: "https://danielchasehooper.com/feed.xml",
    htmlUrl: "https://danielchasehooper.com",
  },
  {
    name: "chiark.greenend.org.uk/~sgtatham",
    xmlUrl: "https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/feed.xml",
    htmlUrl: "https://chiark.greenend.org.uk/~sgtatham",
  },
  {
    name: "grantslatton.com",
    xmlUrl: "https://grantslatton.com/rss.xml",
    htmlUrl: "https://grantslatton.com",
  },
  {
    name: "experimental-history.com",
    xmlUrl: "https://www.experimental-history.com/feed",
    htmlUrl: "https://experimental-history.com",
  },
  {
    name: "anildash.com",
    xmlUrl: "https://anildash.com/feed.xml",
    htmlUrl: "https://anildash.com",
  },
  {
    name: "aresluna.org",
    xmlUrl: "https://aresluna.org/main.rss",
    htmlUrl: "https://aresluna.org",
  },
  {
    name: "michael.stapelberg.ch",
    xmlUrl: "https://michael.stapelberg.ch/feed.xml",
    htmlUrl: "https://michael.stapelberg.ch",
  },
  {
    name: "miguelgrinberg.com",
    xmlUrl: "https://blog.miguelgrinberg.com/feed",
    htmlUrl: "https://miguelgrinberg.com",
  },
  { name: "keygen.sh", xmlUrl: "https://keygen.sh/blog/feed.xml", htmlUrl: "https://keygen.sh" },
  {
    name: "mjg59.dreamwidth.org",
    xmlUrl: "https://mjg59.dreamwidth.org/data/rss",
    htmlUrl: "https://mjg59.dreamwidth.org",
  },
  { name: "computer.rip", xmlUrl: "https://computer.rip/rss.xml", htmlUrl: "https://computer.rip" },
  {
    name: "tedunangst.com",
    xmlUrl: "https://www.tedunangst.com/flak/rss",
    htmlUrl: "https://tedunangst.com",
  },
];

// ============================================================================
// Types
// ============================================================================

type CategoryId = "ai-ml" | "security" | "engineering" | "tools" | "opinion" | "other";

const CATEGORY_META: Record<CategoryId, { emoji: string; label: string }> = {
  "ai-ml": { emoji: "🤖", label: "AI / ML" },
  security: { emoji: "🔒", label: "安全" },
  engineering: { emoji: "⚙️", label: "工程" },
  tools: { emoji: "🛠", label: "工具 / 开源" },
  opinion: { emoji: "💡", label: "观点 / 杂谈" },
  other: { emoji: "📝", label: "其他" },
};

interface Article {
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  sourceName: string;
  sourceUrl: string;
}

type BlockType = "h1" | "h2" | "h3" | "p" | "li" | "quote" | "code";

interface ContentBlock {
  type: BlockType;
  text: string;
  lang?: string; // for code blocks
}

interface FullTextResult {
  blocks: ContentBlock[];
  byline?: string;
  siteName?: string;
  /** True when extraction looks like bullets/summary only (heuristic). */
  partial?: boolean;
}

interface ScoredArticle extends Article {
  score: number;
  scoreBreakdown: {
    relevance: number;
    quality: number;
    timeliness: number;
  };
  category: CategoryId;
  keywords: string[];
  titleZh: string;
  summary: string;
  summaryEn: string;
  reason: string;
  // Full-text + translation (optional; absent on fetch failure)
  fullText?: FullTextResult;
  translatedBlocks?: string[]; // index-aligned with fullText.blocks
  fullTextStatus: "ok" | "failed" | "skipped";
}

interface GeminiScoringResult {
  results: Array<{
    index: number;
    relevance: number;
    quality: number;
    timeliness: number;
    category: string;
    keywords: string[];
  }>;
}

interface GeminiSummaryResult {
  results: Array<{
    index: number;
    titleZh: string;
    summary: string;
    summaryEn?: string;
    reason: string;
  }>;
}

// ============================================================================
// RSS/Atom Parsing (using Bun's built-in HTMLRewriter or manual XML parsing)
// ============================================================================

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .trim();
}

function extractCDATA(text: string): string {
  const cdataMatch = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return cdataMatch ? cdataMatch[1] : text;
}

function getTagContent(xml: string, tagName: string): string {
  // Handle namespaced and non-namespaced tags
  const patterns = [
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, "i"),
    new RegExp(`<${tagName}[^>]*/>`, "i"), // self-closing
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) {
      return extractCDATA(match[1]).trim();
    }
  }
  return "";
}

function getAttrValue(xml: string, tagName: string, attrName: string): string {
  const pattern = new RegExp(`<${tagName}[^>]*\\s${attrName}=["']([^"']*)["'][^>]*/?>`, "i");
  const match = xml.match(pattern);
  return match?.[1] || "";
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  // Try common RSS date formats
  // RFC 822: "Mon, 01 Jan 2024 00:00:00 GMT"
  const rfc822 = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (rfc822) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function parseRSSItems(
  xml: string,
): Array<{ title: string; link: string; pubDate: string; description: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; description: string }> = [];

  // Detect format: Atom vs RSS
  const isAtom =
    (xml.includes("<feed") && xml.includes('xmlns="http://www.w3.org/2005/Atom"')) ||
    xml.includes("<feed ");

  if (isAtom) {
    // Atom format: <entry>
    const entryPattern = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    let entryMatch;
    while ((entryMatch = entryPattern.exec(xml)) !== null) {
      const entryXml = entryMatch[1];
      const title = stripHtml(getTagContent(entryXml, "title"));

      // Atom link: <link href="..." rel="alternate"/>
      let link = getAttrValue(entryXml, 'link[^>]*rel="alternate"', "href");
      if (!link) {
        link = getAttrValue(entryXml, "link", "href");
      }

      const pubDate = getTagContent(entryXml, "published") || getTagContent(entryXml, "updated");

      const description = stripHtml(
        getTagContent(entryXml, "summary") || getTagContent(entryXml, "content"),
      );

      if (title || link) {
        items.push({ title, link, pubDate, description: description.slice(0, 500) });
      }
    }
  } else {
    // RSS format: <item>
    const itemPattern = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let itemMatch;
    while ((itemMatch = itemPattern.exec(xml)) !== null) {
      const itemXml = itemMatch[1];
      const title = stripHtml(getTagContent(itemXml, "title"));
      const link = getTagContent(itemXml, "link") || getTagContent(itemXml, "guid");
      const pubDate =
        getTagContent(itemXml, "pubDate") ||
        getTagContent(itemXml, "dc:date") ||
        getTagContent(itemXml, "date");
      const description = stripHtml(
        getTagContent(itemXml, "description") || getTagContent(itemXml, "content:encoded"),
      );

      if (title || link) {
        items.push({ title, link, pubDate, description: description.slice(0, 500) });
      }
    }
  }

  return items;
}

// ============================================================================
// Feed Fetching
// ============================================================================

async function fetchFeed(feed: {
  name: string;
  xmlUrl: string;
  htmlUrl: string;
}): Promise<Article[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);

    const response = await fetch(feed.xmlUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AI-Daily-Digest/1.0 (RSS Reader)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    const items = parseRSSItems(xml);

    return items.map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: parseDate(item.pubDate) || new Date(0),
      description: item.description,
      sourceName: feed.name,
      sourceUrl: feed.htmlUrl,
    }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Only log non-abort errors to reduce noise
    if (!msg.includes("abort")) {
      console.warn(`[digest] ✗ ${feed.name}: ${msg}`);
    } else {
      console.warn(`[digest] ✗ ${feed.name}: timeout`);
    }
    return [];
  }
}

async function fetchAllFeeds(feeds: typeof RSS_FEEDS): Promise<Article[]> {
  const allArticles: Article[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < feeds.length; i += FEED_CONCURRENCY) {
    const batch = feeds.slice(i, i + FEED_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(fetchFeed));

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.length > 0) {
        allArticles.push(...result.value);
        successCount++;
      } else {
        failCount++;
      }
    }

    const progress = Math.min(i + FEED_CONCURRENCY, feeds.length);
    console.log(
      `[digest] Progress: ${progress}/${feeds.length} feeds processed (${successCount} ok, ${failCount} failed)`,
    );
  }

  console.log(
    `[digest] Fetched ${allArticles.length} articles from ${successCount} feeds (${failCount} failed)`,
  );
  return allArticles;
}

function parseJsonResponse<T>(text: string): T {
  let jsonText = text.trim();
  // Strip markdown code blocks if present
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  return JSON.parse(jsonText) as T;
}

// ============================================================================
// AI Scoring
// ============================================================================

function buildScoringPrompt(
  articles: Array<{ index: number; title: string; description: string; sourceName: string }>,
): string {
  const articlesList = articles
    .map((a) => `Index ${a.index}: [${a.sourceName}] ${a.title}\n${a.description.slice(0, 300)}`)
    .join("\n\n---\n\n");

  return `你是一个技术内容策展人，正在为一份面向技术爱好者的每日精选摘要筛选文章。

请对以下文章进行三个维度的评分（1-10 整数，10 分最高），并为每篇文章分配一个分类标签和提取 2-4 个关键词。

## 评分维度

### 1. 相关性 (relevance) - 对技术/编程/AI/互联网从业者的价值
- 10: 所有技术人都应该知道的重大事件/突破
- 7-9: 对大部分技术从业者有价值
- 4-6: 对特定技术领域有价值
- 1-3: 与技术行业关联不大

### 2. 质量 (quality) - 文章本身的深度和写作质量
- 10: 深度分析，原创洞见，引用丰富
- 7-9: 有深度，观点独到
- 4-6: 信息准确，表达清晰
- 1-3: 浅尝辄止或纯转述

### 3. 时效性 (timeliness) - 当前是否值得阅读
- 10: 正在发生的重大事件/刚发布的重要工具
- 7-9: 近期热点相关
- 4-6: 常青内容，不过时
- 1-3: 过时或无时效价值

## 分类标签（必须从以下选一个）
- ai-ml: AI、机器学习、LLM、深度学习相关
- security: 安全、隐私、漏洞、加密相关
- engineering: 软件工程、架构、编程语言、系统设计
- tools: 开发工具、开源项目、新发布的库/框架
- opinion: 行业观点、个人思考、职业发展、文化评论
- other: 以上都不太适合的

## 关键词提取
提取 2-4 个最能代表文章主题的关键词（用英文，简短，如 "Rust", "LLM", "database", "performance"）

## 待评分文章

${articlesList}

请严格按 JSON 格式返回，不要包含 markdown 代码块或其他文字：
{
  "results": [
    {
      "index": 0,
      "relevance": 8,
      "quality": 7,
      "timeliness": 9,
      "category": "engineering",
      "keywords": ["Rust", "compiler", "performance"]
    }
  ]
}`;
}

async function scoreArticlesWithAI(
  articles: Article[],
  aiClient: AIClient,
): Promise<
  Map<
    number,
    {
      relevance: number;
      quality: number;
      timeliness: number;
      category: CategoryId;
      keywords: string[];
    }
  >
> {
  const allScores = new Map<
    number,
    {
      relevance: number;
      quality: number;
      timeliness: number;
      category: CategoryId;
      keywords: string[];
    }
  >();

  const indexed = articles.map((article, index) => ({
    index,
    title: article.title,
    description: article.description,
    sourceName: article.sourceName,
  }));

  const batches: (typeof indexed)[] = [];
  for (let i = 0; i < indexed.length; i += GEMINI_BATCH_SIZE) {
    batches.push(indexed.slice(i, i + GEMINI_BATCH_SIZE));
  }

  console.log(`[digest] AI scoring: ${articles.length} articles in ${batches.length} batches`);

  const validCategories = new Set<string>([
    "ai-ml",
    "security",
    "engineering",
    "tools",
    "opinion",
    "other",
  ]);

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_GEMINI) {
    const batchGroup = batches.slice(i, i + MAX_CONCURRENT_GEMINI);
    const promises = batchGroup.map(async (batch) => {
      try {
        const prompt = buildScoringPrompt(batch);
        const responseText = await aiClient.call(prompt);
        const parsed = parseJsonResponse<GeminiScoringResult>(responseText);

        if (parsed.results && Array.isArray(parsed.results)) {
          for (const result of parsed.results) {
            const clamp = (v: number) => Math.min(10, Math.max(1, Math.round(v)));
            const cat = (
              validCategories.has(result.category) ? result.category : "other"
            ) as CategoryId;
            allScores.set(result.index, {
              relevance: clamp(result.relevance),
              quality: clamp(result.quality),
              timeliness: clamp(result.timeliness),
              category: cat,
              keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 4) : [],
            });
          }
        }
      } catch (error) {
        console.warn(
          `[digest] Scoring batch failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        for (const item of batch) {
          allScores.set(item.index, {
            relevance: 5,
            quality: 5,
            timeliness: 5,
            category: "other",
            keywords: [],
          });
        }
      }
    });

    await Promise.all(promises);
    console.log(
      `[digest] Scoring progress: ${Math.min(i + MAX_CONCURRENT_GEMINI, batches.length)}/${batches.length} batches`,
    );
  }

  return allScores;
}

// ============================================================================
// AI Summarization
// ============================================================================

function buildSummaryPrompt(
  articles: Array<{
    index: number;
    title: string;
    description: string;
    sourceName: string;
    link: string;
  }>,
  lang: "zh" | "en",
): string {
  const articlesList = articles
    .map(
      (a) =>
        `Index ${a.index}: [${a.sourceName}] ${a.title}\nURL: ${a.link}\n${a.description.slice(0, 800)}`,
    )
    .join("\n\n---\n\n");

  const langInstruction =
    lang === "zh"
      ? "请用中文撰写 summary 与 reason；summaryEn 必须用自然、流畅的英文，与中文摘要信息对应。titleZh 为中文译名。若原文标题已是中文，titleZh 可保持不变。"
      : "Write summaries, reasons, and title translations in English. The summary field is the main English blurb; summaryEn may be omitted in JSON (server duplicates summary as summaryEn).";

  const needSummaryEn = lang === "zh";

  return `你是一个技术内容摘要专家。请为以下文章完成这些字段：

1. **中文标题** (titleZh): 将英文标题翻译成自然的中文。如果原标题已经是中文则保持不变。
2. **摘要** (summary): 4-6 句话的结构化摘要，让读者不点进原文也能了解核心内容。包含：
   - 文章讨论的核心问题或主题（1 句）
   - 关键论点、技术方案或发现（2-3 句）
   - 结论或作者的核心观点（1 句）
${needSummaryEn ? `3. **英文摘要** (summaryEn): 与上述 summary 信息等价、面向英文读者的版本（4-6 句，自然英语），供英文界面使用。\n4.` : `3.`} **推荐理由** (reason): 1 句话说明"为什么值得读"，区别于摘要（摘要说"是什么"，推荐理由说"为什么"）。

${langInstruction}

摘要要求：
- 直接说重点，不要用"本文讨论了..."、"这篇文章介绍了..."这种开头
- 包含具体的技术名词、数据、方案名称或观点
- 保留关键数字和指标（如性能提升百分比、用户数、版本号等）
- 如果文章涉及对比或选型，要点出比较对象和结论
- 目标：读者花 30 秒读完摘要，就能决定是否值得花 10 分钟读原文

## 待摘要文章

${articlesList}

【顺序与对应 — 必须遵守】本批共 ${articles.length} 篇。返回的 \`results\` 数组必须恰好 ${articles.length} 条，且**从上到下的顺序与上面文章列表完全一致**：\`results[0]\` 只概括列表中的第 1 篇（Index ${articles[0]?.index ?? 0}），\`results[1]\` 只概括第 2 篇，以此类推。每条里的 \`index\` 数字必须等于该条所概括那篇的 Index。**禁止**把一篇的标题翻译或摘要写到另一篇上（例如不能把「CLI 工具」类摘要套到定价/Claude 类标题上）。

请严格按 JSON 格式返回${needSummaryEn ? "（其中 summary 为中文、summaryEn 为对应英文，二者缺一不可）" : "（各字段为英文；无需单独 summaryEn，程序会将 summary 作为英文稿）"}：
{
  "results": [
    {
      "index": 0,
      "titleZh": "中文翻译的标题",
      "summary": "摘要内容...",
${needSummaryEn ? '      "summaryEn": "English summary matching the same facts...",\n' : ""}      "reason": "推荐理由..."
    }
  ]
}`;
}

async function summarizeArticles(
  articles: Array<Article & { index: number }>,
  aiClient: AIClient,
  lang: "zh" | "en",
): Promise<Map<number, { titleZh: string; summary: string; summaryEn: string; reason: string }>> {
  const summaries = new Map<
    number,
    { titleZh: string; summary: string; summaryEn: string; reason: string }
  >();

  const indexed = articles.map((a) => ({
    index: a.index,
    title: a.title,
    description: a.description,
    sourceName: a.sourceName,
    link: a.link,
  }));

  const batches: (typeof indexed)[] = [];
  for (let i = 0; i < indexed.length; i += GEMINI_BATCH_SIZE) {
    batches.push(indexed.slice(i, i + GEMINI_BATCH_SIZE));
  }

  console.log(
    `[digest] Generating summaries for ${articles.length} articles in ${batches.length} batches`,
  );

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_GEMINI) {
    const batchGroup = batches.slice(i, i + MAX_CONCURRENT_GEMINI);
    const promises = batchGroup.map(async (batch) => {
      try {
        const prompt = buildSummaryPrompt(batch, lang);
        const responseText = await aiClient.call(prompt);
        const parsed = parseJsonResponse<GeminiSummaryResult>(responseText);

        if (parsed.results && Array.isArray(parsed.results)) {
          const results = parsed.results;
          const apply = (
            item: (typeof batch)[number],
            result: GeminiSummaryResult["results"][number],
          ) => {
            const summary = result.summary || "";
            const se = result.summaryEn?.trim() || "";
            const summaryEn = lang === "en" ? se || summary : se;
            summaries.set(item.index, {
              titleZh: result.titleZh || "",
              summary,
              summaryEn,
              reason: result.reason || "",
            });
          };
          // Prefer positional alignment: models often return wrong `index` but preserve order.
          if (results.length === batch.length) {
            for (let j = 0; j < batch.length; j++) apply(batch[j], results[j]);
          } else {
            console.warn(
              `[digest] Summary batch length mismatch (${results.length} vs ${batch.length}), falling back to index field`,
            );
            for (const result of results) {
              const summary = result.summary || "";
              const se = result.summaryEn?.trim() || "";
              const summaryEn = lang === "en" ? se || summary : se;
              summaries.set(result.index, {
                titleZh: result.titleZh || "",
                summary,
                summaryEn,
                reason: result.reason || "",
              });
            }
          }
        }
      } catch (error) {
        console.warn(
          `[digest] Summary batch failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        for (const item of batch) {
          summaries.set(item.index, {
            titleZh: item.title,
            summary: item.title,
            summaryEn: lang === "en" ? item.title : "",
            reason: "",
          });
        }
      }
    });

    await Promise.all(promises);
    console.log(
      `[digest] Summary progress: ${Math.min(i + MAX_CONCURRENT_GEMINI, batches.length)}/${batches.length} batches`,
    );
  }

  return summaries;
}

// ============================================================================
// AI Highlights (Today's Trends)
// ============================================================================

async function generateHighlights(
  articles: ScoredArticle[],
  aiClient: AIClient,
  lang: "zh" | "en",
): Promise<string> {
  const articleList = articles
    .slice(0, 10)
    .map((a, i) => `${i + 1}. [${a.category}] ${a.titleZh || a.title} — ${a.summary.slice(0, 100)}`)
    .join("\n");

  const langNote = lang === "zh" ? "用中文回答。" : "Write in English.";

  const prompt = `根据以下今日精选技术文章列表，写一段 3-5 句话的"今日看点"总结。
要求：
- 提炼出今天技术圈的 2-3 个主要趋势或话题
- 不要逐篇列举，要做宏观归纳
- 风格简洁有力，像新闻导语
${langNote}

文章列表：
${articleList}

直接返回纯文本总结，不要 JSON，不要 markdown 格式。`;

  try {
    const text = await aiClient.call(prompt);
    return text.trim();
  } catch (error) {
    console.warn(
      `[digest] Highlights generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return "";
  }
}

// ============================================================================
// Full-Text Fetching (readability + jsdom, with disk cache)
// ============================================================================

function urlHash(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 16);
}

/** Short extracted body → treat as partial (not a full article). */
const FULLTEXT_MIN_CHARS = 1800;
const FULLTEXT_MIN_BODY_BLOCKS = 3;

function fullTextLooksPartial(blocks: ContentBlock[]): boolean {
  const bodyTypes = new Set<BlockType>(["p", "quote", "li"]);
  let bodyBlocks = 0;
  let chars = 0;
  for (const b of blocks) {
    chars += b.text.trim().length;
    if (bodyTypes.has(b.type)) bodyBlocks++;
  }
  return chars < FULLTEXT_MIN_CHARS || bodyBlocks < FULLTEXT_MIN_BODY_BLOCKS;
}

function articleHasCompleteFullText(a: ScoredArticle): boolean {
  return a.fullTextStatus === "ok" && !a.fullText?.partial;
}

async function readCache<T>(key: string): Promise<T | null> {
  const path = join(CACHE_DIR, `${key}.json`);
  try {
    const buf = await readFile(path, "utf-8");
    return JSON.parse(buf) as T;
  } catch {
    return null;
  }
}

async function writeCache(key: string, value: unknown): Promise<void> {
  const path = join(CACHE_DIR, `${key}.json`);
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(value));
}

function htmlToBlocks(html: string): ContentBlock[] {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);
  const body = dom.window.document.body;
  const blocks: ContentBlock[] = [];

  const walk = (node: Element): void => {
    const tag = node.tagName.toLowerCase();

    if (tag === "pre") {
      const codeEl = node.querySelector("code");
      const text = (codeEl?.textContent || node.textContent || "").replace(/\n+$/, "");
      const cls = codeEl?.className || "";
      const langMatch = cls.match(/language-(\S+)/);
      if (text.trim()) {
        blocks.push({ type: "code", text, lang: langMatch?.[1] });
      }
      return;
    }

    if (
      tag === "h1" ||
      tag === "h2" ||
      tag === "h3" ||
      tag === "h4" ||
      tag === "h5" ||
      tag === "h6"
    ) {
      const text = (node.textContent || "").trim();
      if (text) {
        const level = tag === "h1" || tag === "h2" || tag === "h3" ? tag : "h3";
        blocks.push({ type: level as BlockType, text });
      }
      return;
    }

    if (tag === "p") {
      const text = (node.textContent || "").trim();
      if (text) blocks.push({ type: "p", text });
      return;
    }

    if (tag === "blockquote") {
      const text = (node.textContent || "").trim();
      if (text) blocks.push({ type: "quote", text });
      return;
    }

    if (tag === "ul" || tag === "ol") {
      for (const li of Array.from(node.children)) {
        if (li.tagName.toLowerCase() === "li") {
          const text = (li.textContent || "").trim();
          if (text) blocks.push({ type: "li", text });
        }
      }
      return;
    }

    // Recurse for container elements
    for (const child of Array.from(node.children)) {
      walk(child as Element);
    }
  };

  for (const child of Array.from(body.children)) {
    walk(child as Element);
  }

  return blocks;
}

async function fetchFullText(url: string): Promise<FullTextResult | null> {
  const key = urlHash(url);
  const cached = await readCache<FullTextResult>(`fulltext-${key}`);
  if (cached) return cached;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ARTICLE_FETCH_TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AI-Daily-Digest/1.0; +https://github.com/anthropics/claude-code)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();

    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article || !article.content) return null;

    const blocks = htmlToBlocks(article.content);
    if (blocks.length === 0) return null;

    const result: FullTextResult = {
      blocks,
      byline: article.byline || undefined,
      siteName: article.siteName || undefined,
    };
    await writeCache(`fulltext-${key}`, result);
    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[digest] full-text fetch failed for ${url}: ${msg.includes("abort") ? "timeout" : msg}`,
    );
    return null;
  }
}

async function fetchAllFullText(
  articles: Array<{ link: string; title: string }>,
): Promise<Map<string, FullTextResult | null>> {
  const results = new Map<string, FullTextResult | null>();
  let done = 0;
  for (let i = 0; i < articles.length; i += ARTICLE_CONCURRENCY) {
    const batch = articles.slice(i, i + ARTICLE_CONCURRENCY);
    const settled = await Promise.allSettled(batch.map((a) => fetchFullText(a.link)));
    settled.forEach((res, idx) => {
      const link = batch[idx].link;
      results.set(link, res.status === "fulfilled" ? res.value : null);
    });
    done += batch.length;
    console.log(`[digest] full-text progress: ${done}/${articles.length}`);
  }
  return results;
}

// ============================================================================
// Paragraph Translation (block-level, cached)
// ============================================================================

/** Strip LLM habit of prefixing each block with 「译文」/「译文：」/「译文⏎」. */
function stripTranslationPrefix(text: string): string {
  let s = text.trimStart();
  if (!s.startsWith("译文")) return text.trim();
  s = s.slice(2);
  s = s.replace(/^[：:\s\u3000\u00a0]+/, "");
  return s.trim();
}

interface TranslationCache {
  url: string;
  count: number;
  translations: string[];
}

async function translateBlocks(
  url: string,
  blocks: ContentBlock[],
  aiClient: AIClient,
): Promise<string[]> {
  const key = `translate-${urlHash(url)}`;
  const cached = await readCache<TranslationCache>(key);
  if (cached && cached.count === blocks.length) {
    return cached.translations.map(stripTranslationPrefix);
  }

  // Build batches: keep code blocks as identity (no translation needed),
  // group consecutive translatable blocks into chunks under TRANSLATE_BLOCK_CHARS.
  const translatable: Array<{ index: number; text: string; type: BlockType }> = [];
  blocks.forEach((b, i) => {
    if (b.type === "code") return;
    translatable.push({ index: i, text: b.text, type: b.type });
  });

  const batches: (typeof translatable)[] = [];
  let current: typeof translatable = [];
  let currentChars = 0;
  for (const item of translatable) {
    const len = item.text.length;
    if (currentChars + len > TRANSLATE_BLOCK_CHARS && current.length > 0) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(item);
    currentChars += len;
  }
  if (current.length > 0) batches.push(current);

  const translations: string[] = blocks.map((b) => (b.type === "code" ? b.text : ""));

  for (let i = 0; i < batches.length; i += MAX_CONCURRENT_GEMINI) {
    const group = batches.slice(i, i + MAX_CONCURRENT_GEMINI);
    await Promise.all(
      group.map(async (batch) => {
        const numbered = batch.map((b, idx) => `[${idx}] ${b.text}`).join("\n\n");
        const prompt = `你是专业技术翻译。把下列英文段落翻译成中文，逐段对应输出。

要求：
- 保持原意，技术术语准确（保留 Python/React/CPU 这类专有名词原文）
- 自然流畅的中文，不要死译
- 保留段落数量和顺序，每段独立
- 每段一行，以 "[N] " 开头（N 为下方原文编号），其后直接写中文正文
- 不要在正文前加「译文」等标签或标题
- 不要添加任何解释、前言、总结
- 如果原文已是中文，原样返回

原文：

${numbered}

直接输出，每段格式为 [N] 后跟中文：`;

        try {
          const responseText = await aiClient.call(prompt);
          // Parse: lines starting with [N]
          const lines = responseText.split(/\n(?=\[\d+\])/);
          for (const line of lines) {
            const m = line.match(/^\[(\d+)\]\s*([\s\S]*)$/);
            if (!m) continue;
            const localIdx = parseInt(m[1], 10);
            if (localIdx < 0 || localIdx >= batch.length) continue;
            const original = batch[localIdx];
            translations[original.index] = stripTranslationPrefix(m[2].trim());
          }
          // Fill any missing with original (LLM might have skipped)
          for (const item of batch) {
            if (!translations[item.index]) translations[item.index] = item.text;
          }
        } catch (error) {
          console.warn(
            `[digest] translate batch failed: ${error instanceof Error ? error.message : String(error)}`,
          );
          for (const item of batch) {
            translations[item.index] = item.text; // fallback to original
          }
        }
      }),
    );
  }

  const cleaned = translations.map(stripTranslationPrefix);
  await writeCache(key, {
    url,
    count: blocks.length,
    translations: cleaned,
  } satisfies TranslationCache);
  return cleaned;
}

async function translateAllArticles(articles: ScoredArticle[], aiClient: AIClient): Promise<void> {
  const withFullText = articles.filter(
    (a) => a.fullText && a.fullText.blocks.length > 0 && !a.fullText.partial,
  );
  console.log(
    `[digest] Translating full text for ${withFullText.length}/${articles.length} articles (skipping partial excerpts)`,
  );

  let done = 0;
  for (const article of withFullText) {
    try {
      article.translatedBlocks = await translateBlocks(
        article.link,
        article.fullText!.blocks,
        aiClient,
      );
    } catch (error) {
      console.warn(
        `[digest] translate failed for ${article.link}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    done++;
    console.log(`[digest] translation progress: ${done}/${withFullText.length}`);
  }
}

// ============================================================================
// Visualization Helpers
// ============================================================================

function humanizeTime(pubDate: Date): string {
  const diffMs = Date.now() - pubDate.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return pubDate.toISOString().slice(0, 10);
}

function generateKeywordBarChart(articles: ScoredArticle[]): string {
  const kwCount = new Map<string, number>();
  for (const a of articles) {
    for (const kw of a.keywords) {
      const normalized = kw.toLowerCase();
      kwCount.set(normalized, (kwCount.get(normalized) || 0) + 1);
    }
  }

  const sorted = Array.from(kwCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  if (sorted.length === 0) return "";

  const labels = sorted.map(([k]) => `"${k}"`).join(", ");
  const values = sorted.map(([, v]) => v).join(", ");
  const maxVal = sorted[0][1];

  let chart = "```mermaid\n";
  chart += `xychart-beta horizontal\n`;
  chart += `    title "高频关键词"\n`;
  chart += `    x-axis [${labels}]\n`;
  chart += `    y-axis "出现次数" 0 --> ${maxVal + 2}\n`;
  chart += `    bar [${values}]\n`;
  chart += "```\n";

  return chart;
}

function generateCategoryPieChart(articles: ScoredArticle[]): string {
  const catCount = new Map<CategoryId, number>();
  for (const a of articles) {
    catCount.set(a.category, (catCount.get(a.category) || 0) + 1);
  }

  if (catCount.size === 0) return "";

  const sorted = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1]);

  let chart = "```mermaid\n";
  chart += `pie showData\n`;
  chart += `    title "文章分类分布"\n`;
  for (const [cat, count] of sorted) {
    const meta = CATEGORY_META[cat];
    chart += `    "${meta.emoji} ${meta.label}" : ${count}\n`;
  }
  chart += "```\n";

  return chart;
}

function generateAsciiBarChart(articles: ScoredArticle[]): string {
  const kwCount = new Map<string, number>();
  for (const a of articles) {
    for (const kw of a.keywords) {
      const normalized = kw.toLowerCase();
      kwCount.set(normalized, (kwCount.get(normalized) || 0) + 1);
    }
  }

  const sorted = Array.from(kwCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted.length === 0) return "";

  const maxVal = sorted[0][1];
  const maxBarWidth = 20;
  const maxLabelLen = Math.max(...sorted.map(([k]) => k.length));

  let chart = "```\n";
  for (const [label, value] of sorted) {
    const barLen = Math.max(1, Math.round((value / maxVal) * maxBarWidth));
    const bar = "█".repeat(barLen) + "░".repeat(maxBarWidth - barLen);
    chart += `${label.padEnd(maxLabelLen)} │ ${bar} ${value}\n`;
  }
  chart += "```\n";

  return chart;
}

function generateTagCloud(articles: ScoredArticle[]): string {
  const kwCount = new Map<string, number>();
  for (const a of articles) {
    for (const kw of a.keywords) {
      const normalized = kw.toLowerCase();
      kwCount.set(normalized, (kwCount.get(normalized) || 0) + 1);
    }
  }

  const sorted = Array.from(kwCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (sorted.length === 0) return "";

  return sorted
    .map(([word, count], i) => (i < 3 ? `**${word}**(${count})` : `${word}(${count})`))
    .join(" · ");
}

// ============================================================================
// Report Generation
// ============================================================================

function generateDigestReport(
  articles: ScoredArticle[],
  highlights: string,
  stats: {
    totalFeeds: number;
    successFeeds: number;
    totalArticles: number;
    filteredArticles: number;
    hours: number;
    lang: string;
  },
): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];

  let report = `# 📰 AI 博客每日精选 — ${dateStr}\n\n`;
  report += `> 来自 Karpathy 推荐的 ${stats.totalFeeds} 个顶级技术博客，AI 精选 Top ${articles.length}\n\n`;

  // ── Today's Highlights ──
  if (highlights) {
    report += `## 📝 今日看点\n\n`;
    report += `${highlights}\n\n`;
    report += `---\n\n`;
  }

  // ── Top 3 Deep Showcase ──
  if (articles.length >= 3) {
    report += `## 🏆 今日必读\n\n`;
    for (let i = 0; i < Math.min(3, articles.length); i++) {
      const a = articles[i];
      const medal = ["🥇", "🥈", "🥉"][i];
      const catMeta = CATEGORY_META[a.category];

      report += `${medal} **${a.titleZh || a.title}**\n\n`;
      report += `[${a.title}](${a.link}) — ${a.sourceName} · ${humanizeTime(a.pubDate)} · ${catMeta.emoji} ${catMeta.label}\n\n`;
      report += `> ${a.summary}\n\n`;
      if (a.reason) {
        report += `💡 **为什么值得读**: ${a.reason}\n\n`;
      }
      if (a.keywords.length > 0) {
        report += `🏷️ ${a.keywords.join(", ")}\n\n`;
      }
    }
    report += `---\n\n`;
  }

  // ── Visual Statistics ──
  report += `## 📊 数据概览\n\n`;

  report += `| 扫描源 | 抓取文章 | 时间范围 | 精选 |\n`;
  report += `|:---:|:---:|:---:|:---:|\n`;
  report += `| ${stats.successFeeds}/${stats.totalFeeds} | ${stats.totalArticles} 篇 → ${stats.filteredArticles} 篇 | ${stats.hours}h | **${articles.length} 篇** |\n\n`;

  const pieChart = generateCategoryPieChart(articles);
  if (pieChart) {
    report += `### 分类分布\n\n${pieChart}\n`;
  }

  const barChart = generateKeywordBarChart(articles);
  if (barChart) {
    report += `### 高频关键词\n\n${barChart}\n`;
  }

  const asciiChart = generateAsciiBarChart(articles);
  if (asciiChart) {
    report += `<details>\n<summary>📈 纯文本关键词图（终端友好）</summary>\n\n${asciiChart}\n</details>\n\n`;
  }

  const tagCloud = generateTagCloud(articles);
  if (tagCloud) {
    report += `### 🏷️ 话题标签\n\n${tagCloud}\n\n`;
  }

  report += `---\n\n`;

  // ── Category-Grouped Articles ──
  const categoryGroups = new Map<CategoryId, ScoredArticle[]>();
  for (const a of articles) {
    const list = categoryGroups.get(a.category) || [];
    list.push(a);
    categoryGroups.set(a.category, list);
  }

  const sortedCategories = Array.from(categoryGroups.entries()).sort(
    (a, b) => b[1].length - a[1].length,
  );

  let globalIndex = 0;
  for (const [catId, catArticles] of sortedCategories) {
    const catMeta = CATEGORY_META[catId];
    report += `## ${catMeta.emoji} ${catMeta.label}\n\n`;

    for (const a of catArticles) {
      globalIndex++;
      const scoreTotal =
        a.scoreBreakdown.relevance + a.scoreBreakdown.quality + a.scoreBreakdown.timeliness;

      report += `### ${globalIndex}. ${a.titleZh || a.title}\n\n`;
      report += `[${a.title}](${a.link}) — **${a.sourceName}** · ${humanizeTime(a.pubDate)} · ⭐ ${scoreTotal}/30\n\n`;
      report += `> ${a.summary}\n\n`;
      if (a.keywords.length > 0) {
        report += `🏷️ ${a.keywords.join(", ")}\n\n`;
      }
      report += `---\n\n`;
    }
  }

  // ── Footer ──
  report += `*生成于 ${dateStr} ${now.toISOString().split("T")[1]?.slice(0, 5) || ""} | 扫描 ${stats.successFeeds} 源 → 获取 ${stats.totalArticles} 篇 → 精选 ${articles.length} 篇*\n`;
  report += `*基于 [Hacker News Popularity Contest 2025](https://refactoringenglish.com/tools/hn-popularity/) RSS 源列表，由 [Andrej Karpathy](https://x.com/karpathy) 推荐*\n`;
  report += `*由「懂点儿AI」制作，欢迎关注同名微信公众号获取更多 AI 实用技巧 💡*\n`;

  return report;
}

// ============================================================================
// CLI
// ============================================================================

function printUsage(): never {
  console.log(`AI Daily Digest - AI-powered RSS digest from 90 top tech blogs

Usage:
  bun src/digest.ts [options]

Options:
  --date <YYYY-MM-DD>  Backfill: only articles published that UTC day. Output uses the date as filename.
  --day-end-hour <1-24>  With --date: end window at that UTC hour (1 = [00:00,01:00), …, 24 = full day). Default: 24.
  --hours <n>          Time range in hours (default: 48). Only used without --date; with --date, stats use --day-end-hour.
  --top-n <n>          Number of top articles to include (default: 15)
  --max-scan <n>       Cap how many candidate articles get AI-scored (saves tokens)
  --lang <lang>        Summary language: zh or en (default: zh)
  --data-dir <path>    JSON output directory (default: <repo>/data)
  --output <path>      Markdown report path (default: <data-dir>/digest-YYYYMMDD.md)
  --help               Show this help

Environment:
  GEMINI_API_KEY   Optional. If set, prefer Gemini.
  GEMINI_API_URL   Optional. Full Gemini generateContent URL (overrides base+model).
  GEMINI_API_BASE  Optional. Default: https://generativelanguage.googleapis.com/v1beta
  GEMINI_MODEL     Optional. Default: gemini-2.0-flash (used with GEMINI_API_BASE)
  OPENAI_API_KEY   OpenAI-compatible API key (LongCat / DeepSeek / OpenAI ...)
  OPENAI_API_BASE  Default: https://api.longcat.chat/openai/v1
  OPENAI_MODEL     Default: inferred from OPENAI_API_BASE or LongCat-Flash-Chat
  DIGEST_HTML=1    Also emit the legacy single-file HTML report

Examples:
  bun src/digest.ts                                   # Today, 48h window, 15 articles
  bun src/digest.ts --hours 24 --top-n 10
  bun src/digest.ts --date 2026-04-20 --top-n 3      # Backfill April 20
  bun src/digest.ts --date 2026-04-20 --max-scan 30 --top-n 3
  bun src/digest.ts --date 2026-04-22 --day-end-hour 8 --top-n 3  # 仅该 UTC 日 0:00-8:00
`);
  process.exit(0);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderBlock(block: ContentBlock, translation: string | undefined): string {
  if (block.type === "code") {
    const lang = block.lang ? ` data-lang="${escapeHtml(block.lang)}"` : "";
    return `<pre class="block block-code"${lang}><code>${escapeHtml(block.text)}</code></pre>`;
  }
  const en = escapeHtml(block.text);
  const zh =
    translation && translation.trim() && translation.trim() !== block.text.trim()
      ? escapeHtml(translation)
      : en;

  const tag =
    block.type === "h1"
      ? "h2" // demote within article
      : block.type === "h2"
        ? "h3"
        : block.type === "h3"
          ? "h4"
          : block.type === "li"
            ? "li"
            : block.type === "quote"
              ? "blockquote"
              : "p";

  return (
    `<${tag} class="block block-${block.type}">` +
    `<span class="lang-en">${en}</span>` +
    `<span class="lang-zh">${zh}</span>` +
    `</${tag}>`
  );
}

function renderArticleFullText(article: ScoredArticle): string {
  if (!article.fullText || article.fullText.blocks.length === 0) {
    const note =
      article.fullTextStatus === "failed"
        ? '<p class="fulltext-note">⚠️ 无法抓取全文，仅显示摘要。</p>'
        : "";
    return note;
  }
  const partialNote = article.fullText.partial
    ? '<p class="fulltext-note">📄 正文为节选（抓取内容较短或主要为要点列表）。</p>'
    : "";
  const blocks = article.fullText.blocks;
  const translations = article.translatedBlocks || [];
  const html = blocks.map((b, i) => renderBlock(b, translations[i])).join("\n");
  const meta = article.fullText.byline
    ? `<p class="fulltext-byline">${escapeHtml(article.fullText.byline)}</p>`
    : "";
  return partialNote + meta + '<div class="fulltext-body">' + html + "</div>";
}

function renderArticleCard(article: ScoredArticle, index: number): string {
  const catMeta = CATEGORY_META[article.category];
  const score =
    article.scoreBreakdown.relevance +
    article.scoreBreakdown.quality +
    article.scoreBreakdown.timeliness;
  const keywords = article.keywords.length
    ? `<div class="kw">${article.keywords.map((k) => `<span class="kw-tag">${escapeHtml(k)}</span>`).join("")}</div>`
    : "";
  const reason = article.reason
    ? `<p class="reason">💡 <strong>为什么值得读：</strong>${escapeHtml(article.reason)}</p>`
    : "";
  const fullText = renderArticleFullText(article);
  const titleZh =
    article.titleZh && article.titleZh !== article.title ? article.titleZh : article.title;
  const articleId = `article-${index}`;
  const statusBadge =
    article.fullTextStatus === "ok" && !article.fullText?.partial
      ? '<span class="badge badge-ok">全文已翻译</span>'
      : article.fullTextStatus === "ok" && article.fullText?.partial
        ? '<span class="badge badge-warn">节选</span>'
        : article.fullTextStatus === "failed"
          ? '<span class="badge badge-warn">仅摘要</span>'
          : "";

  return `<article class="article" id="${articleId}">
    <header class="article-header">
      <div class="article-cat">${catMeta.emoji} ${catMeta.label} · ⭐ ${score}/30 ${statusBadge}</div>
      <h2 class="article-title">
        <span class="lang-en">${escapeHtml(article.title)}</span>
        <span class="lang-zh">${escapeHtml(titleZh)}</span>
      </h2>
      <div class="article-meta">
        <a href="${escapeHtml(article.link)}" target="_blank" rel="noopener">${escapeHtml(article.sourceName)}</a>
        · ${escapeHtml(humanizeTime(article.pubDate))}
      </div>
    </header>
    <section class="article-summary">
      <p>${escapeHtml(article.summary)}</p>
      ${reason}
      ${keywords}
    </section>
    <details class="article-fulltext">
      <summary>📖 阅读全文（双语对照）</summary>
      ${fullText}
      <p class="fulltext-source"><a href="${escapeHtml(article.link)}" target="_blank" rel="noopener">查看原文 ↗</a></p>
    </details>
  </article>`;
}

const HTML_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.7; color: #1a1a2e; background: #f8f9fa; padding: 1rem; }
  .container { max-width: 920px; margin: 0 auto; }
  .topbar { background: #fff; border-radius: 12px; padding: 1.5rem 2rem; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .topbar h1 { font-size: 1.6rem; color: #1e1b4b; margin-bottom: 0.5rem; }
  .topbar .subtitle { color: #6b7280; font-size: 0.9rem; }
  .lang-switch { display: inline-flex; gap: 0.25rem; background: #eef2ff; border-radius: 999px; padding: 0.25rem; margin-top: 1rem; }
  .lang-switch button { border: none; background: transparent; padding: 0.4rem 1rem; border-radius: 999px; cursor: pointer; font-size: 0.9rem; color: #4338ca; font-weight: 500; }
  .lang-switch button.active { background: #6366f1; color: #fff; }
  .panel { background: #fff; border-radius: 12px; padding: 1.5rem 2rem; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .panel h2 { font-size: 1.2rem; color: #312e81; margin-bottom: 0.8rem; }
  .panel.highlights p { color: #1f2937; }
  .stats-table { width: 100%; border-collapse: collapse; }
  .stats-table th, .stats-table td { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: center; font-size: 0.9rem; }
  .stats-table th { background: #f9fafb; }
  .tagcloud { line-height: 2.2; }
  .tagcloud .tag { display: inline-block; background: #eef2ff; color: #4338ca; padding: 0.15rem 0.6rem; border-radius: 6px; margin-right: 0.4rem; font-size: 0.85rem; }
  .tagcloud .tag.hot { background: #6366f1; color: #fff; font-weight: 600; }
  .article { background: #fff; border-radius: 12px; padding: 1.5rem 2rem; margin-bottom: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
  .article-header { border-bottom: 1px solid #f3f4f6; padding-bottom: 0.8rem; margin-bottom: 1rem; }
  .article-cat { font-size: 0.85rem; color: #6366f1; margin-bottom: 0.4rem; }
  .badge { display: inline-block; font-size: 0.7rem; padding: 0.1rem 0.5rem; border-radius: 4px; margin-left: 0.4rem; vertical-align: middle; }
  .badge-ok { background: #d1fae5; color: #065f46; }
  .badge-warn { background: #fef3c7; color: #92400e; }
  .article-title { font-size: 1.2rem; color: #1e1b4b; margin-bottom: 0.4rem; }
  .article-title .lang-en, .article-title .lang-zh { display: block; }
  .article-meta { font-size: 0.85rem; color: #6b7280; }
  .article-meta a { color: #4338ca; text-decoration: none; }
  .article-summary p { margin-bottom: 0.6rem; }
  .reason { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 0.5rem 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.92rem; }
  .kw { margin-top: 0.6rem; }
  .kw-tag { display: inline-block; background: #f3f4f6; color: #4b5563; padding: 0.1rem 0.5rem; border-radius: 4px; margin-right: 0.3rem; font-size: 0.8rem; }
  .article-fulltext { margin-top: 1rem; border-top: 1px solid #f3f4f6; padding-top: 0.8rem; }
  .article-fulltext > summary { cursor: pointer; color: #4338ca; font-weight: 500; padding: 0.25rem 0; user-select: none; }
  .article-fulltext > summary:hover { color: #6366f1; }
  .fulltext-byline { color: #6b7280; font-size: 0.85rem; font-style: italic; margin-top: 0.8rem; margin-bottom: 0.5rem; }
  .fulltext-body { margin-top: 1rem; padding-top: 0.5rem; }
  .fulltext-note { color: #92400e; background: #fef3c7; padding: 0.6rem; border-radius: 6px; margin-top: 0.8rem; font-size: 0.9rem; }
  .fulltext-source { margin-top: 1.2rem; font-size: 0.85rem; }
  .block { margin: 0.6rem 0; }
  .block-h1, .block-h2, .block-h3 { color: #312e81; margin-top: 1.2rem; margin-bottom: 0.5rem; }
  .block-quote { border-left: 4px solid #c7d2fe; padding: 0.4rem 0.9rem; background: #eef2ff; border-radius: 0 6px 6px 0; }
  .block-li { margin-left: 1.5rem; list-style: disc; }
  .block-code { background: #f4f4f5; border-radius: 6px; padding: 0.8rem; overflow-x: auto; font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 0.85rem; }
  /* Bilingual modes */
  body[data-mode="zh"] .lang-en { display: none; }
  body[data-mode="en"] .lang-zh { display: none; }
  body[data-mode="both"] .lang-en { display: block; opacity: 0.65; }
  body[data-mode="both"] .lang-zh { display: block; margin-top: 0.2rem; }
  body[data-mode="both"] .article-title .lang-en { font-size: 0.95rem; font-weight: normal; opacity: 0.7; }
  body[data-mode="both"] h2.block-h1, body[data-mode="both"] h3.block-h2, body[data-mode="both"] h4.block-h3 { display: block; }
  body[data-mode="both"] h2.block-h1 .lang-en, body[data-mode="both"] h3.block-h2 .lang-en, body[data-mode="both"] h4.block-h3 .lang-en { font-size: 0.85em; opacity: 0.7; }
  /* Default for both: stack inside same block */
  body[data-mode="both"] .block .lang-en, body[data-mode="both"] .block .lang-zh { display: block; }
  footer { text-align: center; color: #6b7280; font-size: 0.85rem; padding: 2rem 0 1rem; }
  footer a { color: #6366f1; }
  @media (max-width: 640px) {
    body { padding: 0.5rem; }
    .topbar, .panel, .article { padding: 1rem 1.2rem; }
  }
`;

const HTML_SCRIPT = `
  (function(){
    var key = 'aidd-lang-mode';
    var saved = (function(){ try { return localStorage.getItem(key); } catch(e) { return null; } })();
    var initial = saved || 'both';
    document.body.setAttribute('data-mode', initial);
    var btns = document.querySelectorAll('.lang-switch button');
    btns.forEach(function(b){
      if (b.getAttribute('data-mode') === initial) b.classList.add('active');
      b.addEventListener('click', function(){
        var mode = b.getAttribute('data-mode');
        document.body.setAttribute('data-mode', mode);
        btns.forEach(function(x){ x.classList.remove('active'); });
        b.classList.add('active');
        try { localStorage.setItem(key, mode); } catch(e){}
      });
    });
  })();
`;

function generateHtmlReport(
  articles: ScoredArticle[],
  highlights: string,
  stats: {
    totalFeeds: number;
    successFeeds: number;
    totalArticles: number;
    filteredArticles: number;
    hours: number;
    lang: string;
  },
): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  // Tag cloud
  const kwCount = new Map<string, number>();
  for (const a of articles) {
    for (const kw of a.keywords) {
      const n = kw.toLowerCase();
      kwCount.set(n, (kwCount.get(n) || 0) + 1);
    }
  }
  const sortedKw = Array.from(kwCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  const tagCloud = sortedKw.length
    ? `<div class="tagcloud">${sortedKw
        .map(
          ([k, v], i) => `<span class="tag${i < 3 ? " hot" : ""}">${escapeHtml(k)} · ${v}</span>`,
        )
        .join("")}</div>`
    : "";

  // Category distribution
  const catCount = new Map<CategoryId, number>();
  for (const a of articles) catCount.set(a.category, (catCount.get(a.category) || 0) + 1);
  const catRows = Array.from(catCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([c, n]) => {
      const m = CATEGORY_META[c];
      return `<tr><td>${m.emoji} ${m.label}</td><td>${n}</td></tr>`;
    })
    .join("");

  const articlesHtml = articles.map((a, i) => renderArticleCard(a, i)).join("\n");

  const okCount = articles.filter(articleHasCompleteFullText).length;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI 博客每日精选 — ${dateStr}</title>
<style>${HTML_STYLES}</style>
</head>
<body data-mode="both">
<div class="container">
  <div class="topbar">
    <h1>📰 AI 博客每日精选 — ${dateStr}</h1>
    <div class="subtitle">来自 Karpathy 推荐的 ${stats.totalFeeds} 个顶级技术博客 · AI 精选 ${articles.length} 篇 · 全文翻译 ${okCount}/${articles.length}</div>
    <div class="lang-switch" role="tablist">
      <button data-mode="zh">中文</button>
      <button data-mode="en">English</button>
      <button data-mode="both">双语对照</button>
    </div>
  </div>

  ${
    highlights
      ? `<div class="panel highlights">
    <h2>📝 今日看点</h2>
    <p>${escapeHtml(highlights)}</p>
  </div>`
      : ""
  }

  <div class="panel">
    <h2>📊 数据概览</h2>
    <table class="stats-table">
      <tr><th>扫描源</th><th>抓取文章</th><th>时间范围</th><th>精选</th><th>全文已翻译</th></tr>
      <tr><td>${stats.successFeeds}/${stats.totalFeeds}</td><td>${stats.totalArticles} → ${stats.filteredArticles}</td><td>${stats.hours}h</td><td><strong>${articles.length}</strong></td><td>${okCount}</td></tr>
    </table>
    ${
      catRows
        ? `<h2 style="margin-top:1rem">分类分布</h2>
    <table class="stats-table"><tr><th>分类</th><th>数量</th></tr>${catRows}</table>`
        : ""
    }
    ${tagCloud ? `<h2 style="margin-top:1rem">🏷️ 高频关键词</h2>${tagCloud}` : ""}
  </div>

  ${articlesHtml}

  <footer>
    生成于 ${dateStr} · 由「懂点儿AI」制作 · <a href="https://github.com/anthropics/claude-code" target="_blank" rel="noopener">源码</a>
  </footer>
</div>
<script>${HTML_SCRIPT}</script>
</body>
</html>`;
}

// ============================================================================
// JSON Data Output (for SSG consumption)
// ============================================================================

interface DigestJson {
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
  articles: Array<{
    slug: string;
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
    summaryEn: string;
    reason: string;
    fullTextStatus: "ok" | "failed" | "skipped";
    fullText: {
      byline?: string;
      siteName?: string;
      partial?: boolean;
      blocks: ContentBlock[];
      translations: string[];
    } | null;
  }>;
}

interface DigestIndex {
  dates: Array<{
    date: string;
    generatedAt: string;
    articleCount: number;
    successFullText: number;
  }>;
}

function buildDigestJson(
  articles: ScoredArticle[],
  highlights: string,
  stats: DigestJson["stats"],
  date: string,
): DigestJson {
  return {
    date,
    generatedAt: new Date().toISOString(),
    stats,
    highlights,
    articles: articles.map((a) => ({
      slug: urlHash(a.link),
      title: a.title,
      titleZh: a.titleZh,
      link: a.link,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
      pubDate: a.pubDate.toISOString(),
      category: a.category,
      keywords: a.keywords,
      score: {
        relevance: a.scoreBreakdown.relevance,
        quality: a.scoreBreakdown.quality,
        timeliness: a.scoreBreakdown.timeliness,
        total: a.score,
      },
      summary: a.summary,
      summaryEn: a.summaryEn,
      reason: a.reason,
      fullTextStatus: a.fullTextStatus,
      fullText: a.fullText
        ? {
            byline: a.fullText.byline,
            siteName: a.fullText.siteName,
            partial: a.fullText.partial,
            blocks: a.fullText.blocks,
            translations: a.translatedBlocks || [],
          }
        : null,
    })),
  };
}

async function writeJsonOutputs(
  dataDir: string,
  digest: DigestJson,
): Promise<{ jsonPath: string; indexPath: string }> {
  await mkdir(dataDir, { recursive: true });

  const jsonPath = join(dataDir, `${digest.date}.json`);
  await writeFile(jsonPath, JSON.stringify(digest, null, 2));

  // Update index.json
  const indexPath = join(dataDir, "index.json");
  let index: DigestIndex = { dates: [] };
  try {
    const existing = await readFile(indexPath, "utf-8");
    index = JSON.parse(existing) as DigestIndex;
  } catch {
    // first run, no index yet
  }

  const okFullText = digest.articles.filter(
    (a) => a.fullTextStatus === "ok" && !a.fullText?.partial,
  ).length;
  const entry = {
    date: digest.date,
    generatedAt: digest.generatedAt,
    articleCount: digest.articles.length,
    successFullText: okFullText,
  };

  // Replace existing entry for same date, otherwise prepend
  index.dates = index.dates.filter((d) => d.date !== digest.date);
  index.dates.unshift(entry);
  // Keep newest first by date
  index.dates.sort((a, b) => (a.date < b.date ? 1 : -1));

  await writeFile(indexPath, JSON.stringify(index, null, 2));

  return { jsonPath, indexPath };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) printUsage();

  let hours = 48;
  let topN = 15;
  let lang: "zh" | "en" = "zh";
  let outputPath = "";
  let maxScan = 0; // 0 = no limit
  let dataDir = DEFAULT_DATA_DIR;
  let targetDate = ""; // YYYY-MM-DD; empty = use "last N hours from now"
  let dayEndHour = 24; // with --date: [dayStart, dayStart+dayEndHour) in UTC; 24 = full day

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === "--hours" && args[i + 1]) {
      hours = parseInt(args[++i]!, 10);
    } else if (arg === "--top-n" && args[i + 1]) {
      topN = parseInt(args[++i]!, 10);
    } else if (arg === "--lang" && args[i + 1]) {
      lang = args[++i] as "zh" | "en";
    } else if (arg === "--output" && args[i + 1]) {
      outputPath = args[++i]!;
    } else if (arg === "--max-scan" && args[i + 1]) {
      maxScan = parseInt(args[++i]!, 10);
    } else if (arg === "--data-dir" && args[i + 1]) {
      dataDir = args[++i]!;
    } else if (arg === "--date" && args[i + 1]) {
      targetDate = args[++i]!;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        console.error(`[digest] Invalid --date "${targetDate}". Expected YYYY-MM-DD.`);
        process.exit(1);
      }
    } else if (arg === "--day-end-hour" && args[i + 1]) {
      dayEndHour = parseInt(args[++i]!, 10);
    }
  }
  if (dayEndHour < 1 || dayEndHour > 24 || Number.isNaN(dayEndHour)) {
    console.error(`[digest] --day-end-hour must be 1–24, got: ${dayEndHour}`);
    process.exit(1);
  }
  if (dayEndHour < 24 && !targetDate) {
    console.error(`[digest] --day-end-hour only applies with --date`);
    process.exit(1);
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  const geminiApiUrl = process.env.GEMINI_API_URL;
  const geminiApiBase = process.env.GEMINI_API_BASE;
  const geminiModel = process.env.GEMINI_MODEL;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiApiBase = process.env.OPENAI_API_BASE;
  const openaiModel = process.env.OPENAI_MODEL;

  if (!geminiApiKey && !openaiApiKey) {
    console.error("[digest] Error: Missing API key. Set GEMINI_API_KEY and/or OPENAI_API_KEY.");
    console.error("[digest] Gemini key: https://aistudio.google.com/apikey");
    process.exit(1);
  }

  const aiClient = createAIClient({
    geminiApiKey,
    geminiApiUrl,
    geminiApiBase,
    geminiModel,
    openaiApiKey,
    openaiApiBase,
    openaiModel,
  });

  // dateStr: ISO YYYY-MM-DD used for output filenames + JSON `date` field
  const effectiveDate = targetDate || new Date().toISOString().slice(0, 10);
  if (!outputPath) {
    const compact = effectiveDate.replace(/-/g, "");
    outputPath = join(dataDir, `digest-${compact}.md`);
  }

  console.log(`[digest] === AI Daily Digest ===`);
  if (targetDate) {
    console.log(
      `[digest] Target date: ${targetDate} (UTC, ${dayEndHour < 24 ? `00:00–${String(dayEndHour).padStart(2, "0")}:00` : "full 24h"})`,
    );
  } else {
    console.log(`[digest] Time range: ${hours} hours (from now)`);
  }
  console.log(`[digest] Top N: ${topN}`);
  console.log(`[digest] Language: ${lang}`);
  console.log(`[digest] Output: ${outputPath}`);
  console.log(
    `[digest] AI provider: ${geminiApiKey ? "Gemini (primary)" : "OpenAI-compatible (primary)"}`,
  );
  if (geminiApiKey) {
    const gUrl = resolveGeminiGenerateUrl({ geminiApiUrl, geminiApiBase, geminiModel });
    console.log(`[digest] Gemini endpoint: ${gUrl}`);
  }
  if (openaiApiKey) {
    const resolvedBase = (openaiApiBase?.trim() || OPENAI_DEFAULT_API_BASE).replace(/\/+$/, "");
    const resolvedModel = openaiModel?.trim() || inferOpenAIModel(resolvedBase);
    console.log(`[digest] Fallback: ${resolvedBase} (model=${resolvedModel})`);
  }
  console.log("");

  console.log(`[digest] Step 1/5: Fetching ${RSS_FEEDS.length} RSS feeds...`);
  const allArticles = await fetchAllFeeds(RSS_FEEDS);

  if (allArticles.length === 0) {
    console.error("[digest] Error: No articles fetched from any feed. Check network connection.");
    process.exit(1);
  }

  let recentArticles: Article[];
  if (targetDate) {
    // Lock window: UTC day start + optional end hour (default full 24h)
    const dayStart = new Date(`${targetDate}T00:00:00.000Z`).getTime();
    const dayEnd = dayStart + dayEndHour * 60 * 60 * 1000;
    console.log(`[digest] Step 2/5: Filtering for date ${targetDate} (UTC)...`);
    recentArticles = allArticles.filter((a) => {
      const t = a.pubDate.getTime();
      return t >= dayStart && t < dayEnd;
    });
    console.log(
      `[digest] Found ${recentArticles.length} articles in window (${dayEndHour < 24 ? `first ${dayEndHour}h UTC` : targetDate + " (UTC) full day"})`,
    );
    if (recentArticles.length === 0) {
      console.error(`[digest] Error: No articles found for date ${targetDate}.`);
      console.error(
        `[digest] Hint: many feeds only retain recent items, so older dates may be empty.`,
      );
      process.exit(1);
    }
  } else {
    console.log(`[digest] Step 2/5: Filtering by time range (${hours} hours)...`);
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    recentArticles = allArticles.filter((a) => a.pubDate.getTime() > cutoffTime.getTime());
    console.log(`[digest] Found ${recentArticles.length} articles within last ${hours} hours`);
    if (recentArticles.length === 0) {
      console.error(`[digest] Error: No articles found within the last ${hours} hours.`);
      console.error(`[digest] Try increasing --hours (e.g., --hours 168 for one week)`);
      process.exit(1);
    }
  }

  let toScore = recentArticles;
  if (maxScan > 0 && recentArticles.length > maxScan) {
    // Take the most recent N to avoid scoring everything
    toScore = [...recentArticles]
      .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
      .slice(0, maxScan);
    console.log(
      `[digest] --max-scan ${maxScan}: scoring only ${toScore.length} most recent of ${recentArticles.length}`,
    );
  }

  console.log(`[digest] Step 3/7: AI scoring ${toScore.length} articles...`);
  const scores = await scoreArticlesWithAI(toScore, aiClient);

  const scoredArticles = toScore.map((article, index) => {
    const score = scores.get(index) || {
      relevance: 5,
      quality: 5,
      timeliness: 5,
      category: "other" as CategoryId,
      keywords: [],
    };
    return {
      ...article,
      totalScore: score.relevance + score.quality + score.timeliness,
      breakdown: score,
    };
  });

  scoredArticles.sort((a, b) => b.totalScore - a.totalScore);
  const topArticles = scoredArticles.slice(0, topN);

  console.log(
    `[digest] Top ${topN} articles selected (score range: ${topArticles[topArticles.length - 1]?.totalScore || 0} - ${topArticles[0]?.totalScore || 0})`,
  );

  console.log(`[digest] Step 4/7: Generating AI summaries...`);
  const indexedTopArticles = topArticles.map((a, i) => ({ ...a, index: i }));
  const summaries = await summarizeArticles(indexedTopArticles, aiClient, lang);

  const finalArticles: ScoredArticle[] = topArticles.map((a, i) => {
    const sm = summaries.get(i) || {
      titleZh: a.title,
      summary: a.description.slice(0, 200),
      summaryEn: lang === "en" ? a.description.slice(0, 200) : "",
      reason: "",
    };
    return {
      title: a.title,
      link: a.link,
      pubDate: a.pubDate,
      description: a.description,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
      score: a.totalScore,
      scoreBreakdown: {
        relevance: a.breakdown.relevance,
        quality: a.breakdown.quality,
        timeliness: a.breakdown.timeliness,
      },
      category: a.breakdown.category,
      keywords: a.breakdown.keywords,
      titleZh: sm.titleZh,
      summary: sm.summary,
      summaryEn: sm.summaryEn,
      reason: sm.reason,
      fullTextStatus: "skipped" as const,
    };
  });

  console.log(`[digest] Step 5/7: Fetching full text for ${finalArticles.length} articles...`);
  const fullTextMap = await fetchAllFullText(
    finalArticles.map((a) => ({ link: a.link, title: a.title })),
  );
  for (const article of finalArticles) {
    const ft = fullTextMap.get(article.link);
    if (ft && ft.blocks.length > 0) {
      const partial = fullTextLooksPartial(ft.blocks);
      article.fullText = { ...ft, partial };
      article.fullTextStatus = "ok";
    } else {
      article.fullTextStatus = "failed";
    }
  }
  const completeFull = finalArticles.filter(articleHasCompleteFullText).length;
  const partialFull = finalArticles.filter(
    (a) => a.fullTextStatus === "ok" && a.fullText?.partial,
  ).length;
  console.log(
    `[digest] Full text: ${completeFull} complete, ${partialFull} partial, ${finalArticles.length - completeFull - partialFull} failed of ${finalArticles.length}`,
  );

  console.log(`[digest] Step 6/7: Translating full text paragraphs...`);
  await translateAllArticles(finalArticles, aiClient);

  console.log(`[digest] Step 7/7: Generating today's highlights...`);
  const highlights = await generateHighlights(finalArticles, aiClient, lang);

  const successfulSources = new Set(allArticles.map((a) => a.sourceName));

  const reportStats = {
    totalFeeds: RSS_FEEDS.length,
    successFeeds: successfulSources.size,
    totalArticles: allArticles.length,
    filteredArticles: recentArticles.length,
    hours: targetDate ? dayEndHour : hours,
    lang,
  };

  const report = generateDigestReport(finalArticles, highlights, reportStats);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, report);

  // JSON output for SSG site
  const digestJson = buildDigestJson(finalArticles, highlights, reportStats, effectiveDate);
  const { jsonPath, indexPath } = await writeJsonOutputs(dataDir, digestJson);
  console.log(`[digest] 📦 JSON:   ${jsonPath}`);
  console.log(`[digest] 📦 Index:  ${indexPath}`);

  // Legacy self-contained HTML (opt-in)
  if (process.env.DIGEST_HTML === "1") {
    const htmlPath = outputPath.replace(/\.md$/, ".html");
    await writeFile(htmlPath, generateHtmlReport(finalArticles, highlights, reportStats));
    console.log(`[digest] 🌐 HTML:   ${htmlPath}`);
    if (process.env.DIGEST_OPEN !== "0") {
      try {
        Bun.spawn(["open", htmlPath]);
      } catch {}
    }
  }

  console.log("");
  console.log(`[digest] ✅ Done!`);
  console.log(`[digest] 📁 Report: ${outputPath}`);
  console.log(
    `[digest] 📊 Stats: ${successfulSources.size} sources → ${allArticles.length} articles → ${recentArticles.length} recent → ${finalArticles.length} selected`,
  );

  if (finalArticles.length > 0) {
    console.log("");
    console.log(`[digest] 🏆 Top 3 Preview:`);
    for (let i = 0; i < Math.min(3, finalArticles.length); i++) {
      const a = finalArticles[i];
      console.log(`  ${i + 1}. ${a.titleZh || a.title}`);
      console.log(`     ${a.summary.slice(0, 80)}...`);
    }
  }
}

await main().catch((err) => {
  console.error(`[digest] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
