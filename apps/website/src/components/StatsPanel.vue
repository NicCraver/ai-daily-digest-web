<script setup lang="ts">
import { computed } from "vue";
import type { Digest } from "../types";
import { CATEGORY_META } from "../types";

const props = defineProps<{ digest: Digest }>();

const completeFullText = computed(
  () =>
    props.digest.articles.filter((a) => a.fullTextStatus === "ok" && !a.fullText?.partial).length,
);

const partialFullText = computed(
  () =>
    props.digest.articles.filter((a) => a.fullTextStatus === "ok" && a.fullText?.partial).length,
);

const categoryCounts = computed(() => {
  const map = new Map<string, number>();
  for (const a of props.digest.articles) {
    map.set(a.category, (map.get(a.category) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => ({
      id,
      count,
      meta: CATEGORY_META[id as keyof typeof CATEGORY_META],
    }));
});

const topKeywords = computed(() => {
  const counts = new Map<string, number>();
  for (const a of props.digest.articles) {
    for (const k of a.keywords) {
      const key = k.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
});
</script>

<template>
  <section class="border-y border-ink-200">
    <div class="grid grid-cols-2 md:grid-cols-5 gap-px bg-ink-200">
      <div class="bg-paper px-3 py-4 md:px-4 md:py-5 text-center">
        <div class="text-[10px] uppercase tracking-widest text-ink-400">扫描源</div>
        <div class="font-serif text-xl md:text-2xl text-ink-900 mt-1 tabular-nums">
          {{ digest.stats.successFeeds }}/{{ digest.stats.totalFeeds }}
        </div>
      </div>
      <div class="bg-paper px-3 py-4 md:px-4 md:py-5 text-center">
        <div class="text-[10px] uppercase tracking-widest text-ink-400">抓取文章</div>
        <div class="font-serif text-xl md:text-2xl text-ink-900 mt-1 tabular-nums">
          {{ digest.stats.totalArticles }}
        </div>
      </div>
      <div class="bg-paper px-3 py-4 md:px-4 md:py-5 text-center">
        <div class="text-[10px] uppercase tracking-widest text-ink-400">时间范围</div>
        <div class="font-serif text-xl md:text-2xl text-ink-900 mt-1 tabular-nums">
          {{ digest.stats.hours }}h
        </div>
      </div>
      <div class="bg-paper px-3 py-4 md:px-4 md:py-5 text-center">
        <div class="text-[10px] uppercase tracking-widest text-ink-400">精选</div>
        <div class="font-serif text-xl md:text-2xl text-ink-900 mt-1 tabular-nums">
          {{ digest.articles.length }}
        </div>
      </div>
      <div class="bg-paper col-span-2 md:col-span-1 px-3 py-4 md:px-4 md:py-5 text-center">
        <div class="text-[10px] uppercase tracking-widest text-ink-400">完整全文</div>
        <div class="font-serif text-xl md:text-2xl text-ink-900 mt-1 tabular-nums">
          {{ completeFullText }}/{{ digest.articles.length }}
        </div>
        <div v-if="partialFullText > 0" class="text-[11px] text-ink-400 mt-1">
          节选 {{ partialFullText }} 篇
        </div>
      </div>
    </div>

    <div
      v-if="categoryCounts.length || topKeywords.length"
      class="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-ink-200 border-t border-ink-200"
    >
      <div v-if="categoryCounts.length" class="p-5">
        <div class="text-[10px] uppercase tracking-widest text-ink-400 mb-2">分类分布</div>
        <div class="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-700">
          <span v-for="c in categoryCounts" :key="c.id">
            {{ c.meta.emoji }} {{ c.meta.label }}
            <span class="text-ink-400">{{ c.count }}</span>
          </span>
        </div>
      </div>
      <div v-if="topKeywords.length" class="p-5">
        <div class="text-[10px] uppercase tracking-widest text-ink-400 mb-2">高频关键词</div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-700">
          <span v-for="[k, n] in topKeywords" :key="k">
            {{ k }} <span class="text-ink-400">{{ n }}</span>
          </span>
        </div>
      </div>
    </div>
  </section>
</template>
