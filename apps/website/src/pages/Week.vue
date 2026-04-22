<script setup lang="ts">
import { computed } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { BarChart3, Trophy } from "lucide-vue-next";
import { getWeekly } from "../data";
import ArticleCard from "../components/ArticleCard.vue";

const route = useRoute();
const weekId = computed(() => String(route.params.weekId || ""));
const weekly = computed(() => getWeekly(weekId.value));

function formatRange(start: string, end: string): string {
  const [y1, m1, d1] = start.split("-");
  const [y2, m2, d2] = end.split("-");
  if (y1 === y2 && m1 === m2) {
    return `${y1} 年 ${parseInt(m1, 10)} 月 ${parseInt(d1, 10)}–${parseInt(d2, 10)} 日`;
  }
  if (y1 === y2) {
    return `${y1} 年 ${parseInt(m1, 10)} 月 ${parseInt(d1, 10)} 日 – ${parseInt(m2, 10)} 月 ${parseInt(d2, 10)} 日`;
  }
  return `${start} ~ ${end}`;
}
</script>

<template>
  <article v-if="weekly" class="mx-auto max-w-[1200px] px-12 pb-16">
    <!-- Masthead -->
    <header class="pt-10 pb-8 grid grid-cols-12 gap-8 items-start">
      <div class="col-span-5">
        <p class="text-[10px] uppercase tracking-[2px] text-ink-400 mb-2">
          WEEKLY DIGEST · {{ weekly.weekId }}
        </p>
        <h1 class="font-serif text-4xl font-semibold text-ink-900 leading-tight">本周精选</h1>
        <p class="mt-3 font-serif italic text-lg text-ink-500">
          {{ formatRange(weekly.rangeStart, weekly.rangeEnd) }}
        </p>
      </div>

      <div class="col-span-7 border border-ink-200 p-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="font-serif text-lg font-semibold text-ink-900 inline-flex items-center gap-2">
            <BarChart3 class="w-5 h-5 text-ink-700" stroke-width="2" aria-hidden="true" />
            本周概览
          </h2>
          <span class="text-[10px] uppercase tracking-[1.5px] text-ink-400"
            >TOP {{ weekly.topPicks.length }} · BY OVERALL SCORE</span
          >
        </div>
        <div class="grid grid-cols-3 gap-4">
          <div>
            <div class="text-[10px] uppercase tracking-widest text-ink-400">覆盖天数</div>
            <div class="font-serif text-2xl text-ink-900 mt-1">{{ weekly.stats.totalDays }}/7</div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-widest text-ink-400">候选文章</div>
            <div class="font-serif text-2xl text-ink-900 mt-1">
              {{ weekly.stats.candidateArticles }}
            </div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-widest text-ink-400">来源博客</div>
            <div class="font-serif text-2xl text-ink-900 mt-1">
              {{ weekly.stats.uniqueSources }}
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Top picks list -->
    <section class="mt-4">
      <div class="flex items-end justify-between mb-5">
        <div>
          <h2 class="font-serif text-2xl font-semibold text-ink-900 inline-flex items-center gap-2">
            <Trophy class="w-6 h-6 text-ink-700" stroke-width="2" aria-hidden="true" />
            本周必读
          </h2>
          <p class="mt-1 text-[10px] uppercase tracking-[2px] text-ink-400">按 AI 总评分排序</p>
        </div>
        <RouterLink to="/archive" class="text-xs text-ink-700 hover:text-ink-900 no-underline"
          >查看完整归档 →</RouterLink
        >
      </div>

      <div class="space-y-6">
        <div
          v-for="(pick, idx) in weekly.topPicks"
          :key="pick.link"
          class="grid grid-cols-12 gap-4 items-start"
        >
          <div class="col-span-1 pt-2">
            <div class="font-serif text-2xl text-ink-900">
              {{ idx + 1 }}
            </div>
            <RouterLink
              :to="`/d/${pick.fromDate}`"
              class="text-[10px] uppercase tracking-wider text-ink-400 hover:text-ink-700 no-underline"
            >
              {{ pick.fromDate.slice(5) }}
            </RouterLink>
          </div>
          <div class="col-span-11">
            <ArticleCard :article="pick" :digest-date="pick.fromDate" variant="list" />
          </div>
        </div>
      </div>
    </section>
  </article>

  <div v-else class="mx-auto max-w-[720px] px-12 py-32 text-center">
    <h1 class="font-serif text-3xl font-semibold mb-4">未找到 {{ weekId }} 的周报</h1>
    <p class="text-ink-500">
      <RouterLink to="/" class="underline">回到首页</RouterLink>
    </p>
  </div>
</template>
