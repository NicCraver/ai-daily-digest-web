<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { FileText, Trophy } from "lucide-vue-next";
import type { Digest, DigestIndexEntry } from "../types";
import { CATEGORY_META } from "../types";
import ArticleCard from "./ArticleCard.vue";
import StatsPanel from "./StatsPanel.vue";

const props = defineProps<{
  digest: Digest;
  recent: DigestIndexEntry[];
}>();

const dateLabel = computed(() => {
  const [y, m, d] = props.digest.date.split("-");
  return `${y} 年 ${parseInt(m, 10)} 月 ${parseInt(d, 10)} 日`;
});

const weekday = computed(() => {
  const dt = new Date(props.digest.date + "T00:00:00");
  const zh = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const en = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const i = dt.getDay();
  return `${zh[i]} · ${en[i]}`;
});

const top3 = computed(() => props.digest.articles.slice(0, 3));
const rest = computed(() => props.digest.articles.slice(3));

const categoryGroups = computed(() => {
  const map = new Map<string, typeof props.digest.articles>();
  for (const a of rest.value) {
    const list = map.get(a.category) || [];
    list.push(a);
    map.set(a.category, list);
  }
  return Array.from(map.entries())
    .map(([catId, items]) => ({
      catId,
      meta: CATEGORY_META[catId as keyof typeof CATEGORY_META],
      items,
    }))
    .sort((a, b) => b.items.length - a.items.length);
});

const subtitleZh = computed(
  () =>
    `Karpathy 推荐 ${props.digest.stats.totalFeeds} 个技术博客 · AI 精选 ${props.digest.articles.length} 篇`,
);
</script>

<template>
  <article class="mx-auto max-w-[1440px] px-12 pb-16">
    <!-- Masthead -->
    <header class="pt-10 pb-8 grid grid-cols-12 gap-8 items-start">
      <div class="col-span-4">
        <h1 class="font-serif text-4xl font-semibold text-ink-900 leading-tight">
          {{ dateLabel }}
        </h1>
        <p class="mt-3 font-serif italic text-lg text-ink-500">
          {{ weekday }}
        </p>
        <p class="mt-3 text-xs uppercase tracking-widest text-ink-500">
          {{ subtitleZh }}
        </p>
      </div>

      <div class="col-span-8 border border-ink-200 p-6">
        <div class="flex items-center justify-between">
          <h2 class="font-serif text-lg font-semibold text-ink-900 inline-flex items-center gap-2">
            <FileText class="w-5 h-5 text-ink-700" stroke-width="2" aria-hidden="true" />
            今日看点
          </h2>
          <span class="text-[10px] uppercase tracking-[1.5px] text-ink-400">AI · GENERATED</span>
        </div>
        <hr class="my-3 border-ink-200" />
        <p class="font-serif text-[15px] leading-[1.75] text-ink-900">
          {{ digest.highlights || "（今日无看点摘要）" }}
        </p>
      </div>
    </header>

    <!-- Stats strip -->
    <StatsPanel :digest="digest" />

    <!-- Top 3 -->
    <section v-if="top3.length" class="mt-12">
      <div class="flex items-end justify-between mb-5">
        <div>
          <h2 class="font-serif text-2xl font-semibold text-ink-900 inline-flex items-center gap-2">
            <Trophy class="w-6 h-6 text-ink-700" stroke-width="2" aria-hidden="true" />
            今日必读
          </h2>
          <p class="mt-1 text-[10px] uppercase tracking-[2px] text-ink-400">
            TOP {{ top3.length }} · BY OVERALL SCORE
          </p>
        </div>
        <a href="#all" class="text-xs text-ink-700 hover:text-ink-900 no-underline"
          >查看全部 {{ digest.articles.length }} 篇 →</a
        >
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ArticleCard
          v-for="(article, idx) in top3"
          :key="article.link"
          :article="article"
          :digest-date="digest.date"
          :rank="idx + 1"
          variant="featured"
        />
      </div>
    </section>

    <!-- All articles by category -->
    <section v-if="categoryGroups.length" id="all" class="mt-16 grid grid-cols-12 gap-8">
      <div class="col-span-12 lg:col-span-8 space-y-12">
        <div v-for="group in categoryGroups" :key="group.catId">
          <h3
            class="font-serif text-xl font-semibold text-ink-900 mb-4 border-b border-ink-200 pb-2"
          >
            {{ group.meta.emoji }} {{ group.meta.label }}
          </h3>
          <div class="space-y-6">
            <ArticleCard
              v-for="article in group.items"
              :key="article.link"
              :article="article"
              :digest-date="digest.date"
              variant="list"
            />
          </div>
        </div>
      </div>

      <!-- Sidebar: recent archive -->
      <aside class="col-span-12 lg:col-span-4">
        <div class="sticky top-6 border border-ink-200 p-6">
          <h3 class="font-serif text-base font-semibold text-ink-900 mb-3">最近几期</h3>
          <ul class="space-y-3">
            <li v-for="r in recent" :key="r.date">
              <RouterLink :to="`/d/${r.date}`" class="block group no-underline">
                <div class="font-serif text-[15px] text-ink-900 group-hover:underline">
                  {{ r.date }}
                </div>
                <div class="text-[11px] text-ink-400 uppercase tracking-wider">
                  {{ r.articleCount }} 篇
                </div>
              </RouterLink>
            </li>
            <li v-if="recent.length === 0" class="text-sm text-ink-400">暂无更多</li>
          </ul>
          <RouterLink
            to="/archive"
            class="mt-4 inline-block text-xs text-ink-700 hover:text-ink-900"
          >
            查看完整归档 →
          </RouterLink>
        </div>
      </aside>
    </section>
  </article>
</template>
