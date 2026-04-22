import { defineConfig } from "vite-plus";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import { codeInspectorPlugin } from "code-inspector-plugin";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../..");
// website → apps → monorepo root → data
const DATA_DIR = resolve(REPO_ROOT, "data");
const WEEKLY_DIR = resolve(DATA_DIR, "weekly");

async function listDigestDates(): Promise<string[]> {
  try {
    const idx = await readFile(resolve(DATA_DIR, "index.json"), "utf-8");
    const parsed = JSON.parse(idx) as { dates: { date: string }[] };
    return parsed.dates.map((d) => d.date);
  } catch {
    try {
      const files = await readdir(DATA_DIR);
      return files
        .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
        .map((f) => f.replace(/\.json$/, ""));
    } catch {
      return [];
    }
  }
}

function articleSlugFromLink(url: string): string {
  return createHash("sha1").update(url, "utf8").digest("hex").slice(0, 16);
}

async function listArticleRoutes(dates: string[]): Promise<string[]> {
  const routes: string[] = [];
  for (const date of dates) {
    try {
      const raw = await readFile(resolve(DATA_DIR, `${date}.json`), "utf-8");
      const j = JSON.parse(raw) as { articles?: { link: string }[] };
      for (const a of j.articles ?? []) {
        routes.push(`/d/${date}/a/${articleSlugFromLink(a.link)}`);
      }
    } catch {
      /* skip missing or invalid */
    }
  }
  return routes;
}

async function listWeekIds(): Promise<string[]> {
  try {
    const idx = await readFile(resolve(WEEKLY_DIR, "index.json"), "utf-8");
    const parsed = JSON.parse(idx) as { weeks: { weekId: string }[] };
    return parsed.weeks.map((w) => w.weekId);
  } catch {
    try {
      const files = await readdir(WEEKLY_DIR);
      return files
        .filter((f) => /^\d{4}-W\d{2}\.json$/.test(f))
        .map((f) => f.replace(/\.json$/, ""));
    } catch {
      return [];
    }
  }
}

export default defineConfig({
  // 构建到 monorepo 根 dist/，供 Cloudflare Pages 等以仓库根为 cwd 的部署使用
  build: {
    outDir: resolve(REPO_ROOT, "dist"),
    emptyOutDir: true,
  },
  plugins: [
    codeInspectorPlugin({
      bundler: "vite",
    }),
    vue(),
    tailwindcss(),
  ],
  ssgOptions: {
    formatting: "minify",
    includedRoutes: async (paths: string[]) => {
      const dates = await listDigestDates();
      const [weeks, articles] = await Promise.all([listWeekIds(), listArticleRoutes(dates)]);
      const dynamic = [...dates.map((d) => `/d/${d}`), ...weeks.map((w) => `/w/${w}`), ...articles];
      return [...new Set([...paths, ...dynamic])];
    },
  },
});
