<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Trophy } from "lucide-vue-next";
import { digestIndex, weeklyIndex } from "../data";
import type { DigestIndexEntry, WeeklyIndexEntry } from "../types";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${y} 年 ${parseInt(m, 10)} 月 ${parseInt(d, 10)} 日`;
}

function formatRange(start: string, end: string): string {
  const [, m1, d1] = start.split("-");
  const [, m2, d2] = end.split("-");
  if (m1 === m2) return `${parseInt(m1, 10)} 月 ${parseInt(d1, 10)}–${parseInt(d2, 10)} 日`;
  return `${parseInt(m1, 10)}/${parseInt(d1, 10)} – ${parseInt(m2, 10)}/${parseInt(d2, 10)}`;
}

// Compute ISO week for a YYYY-MM-DD string (UTC, ISO 8601)
function isoWeekOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNum + 3);
  const firstThu = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDayNum + 3);
  const week = Math.round((target.getTime() - firstThu.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

interface WeekGroup {
  weekId: string;
  weekly?: WeeklyIndexEntry;
  days: DigestIndexEntry[];
}

const groups = computed<WeekGroup[]>(() => {
  const byWeek = new Map<string, DigestIndexEntry[]>();
  for (const entry of digestIndex.dates) {
    const w = isoWeekOf(entry.date);
    const list = byWeek.get(w) || [];
    list.push(entry);
    byWeek.set(w, list);
  }

  // Also include weeks that have a weekly digest but no daily entries (rare)
  for (const w of weeklyIndex.weeks) {
    if (!byWeek.has(w.weekId)) byWeek.set(w.weekId, []);
  }

  const weeklyById = new Map(weeklyIndex.weeks.map((w) => [w.weekId, w]));

  return Array.from(byWeek.entries())
    .map<WeekGroup>(([weekId, days]) => ({
      weekId,
      weekly: weeklyById.get(weekId),
      days: days.sort((a, b) => (a.date < b.date ? 1 : -1)),
    }))
    .sort((a, b) => (a.weekId < b.weekId ? 1 : -1));
});
</script>

<template>
  <section class="mx-auto max-w-[1200px] px-4 md:px-12 py-12">
    <header class="mb-10">
      <h1 class="font-serif text-2xl md:text-4xl font-semibold text-ink-900">归档</h1>
      <p class="mt-2 text-sm text-ink-500">
        共 {{ digestIndex.dates.length }} 期日报 · {{ weeklyIndex.weeks.length }} 期周报 · 按 ISO
        周倒序排列
      </p>
    </header>

    <div v-if="groups.length === 0" class="text-center py-16 text-ink-500">还没有归档。</div>

    <div v-else class="space-y-12">
      <section v-for="g in groups" :key="g.weekId">
        <!-- Week header -->
        <div class="flex items-baseline justify-between border-b border-ink-200 pb-2 mb-3">
          <h2 class="font-serif text-2xl text-ink-900">
            {{ g.weekId }}
          </h2>
          <span v-if="g.weekly" class="text-xs text-ink-500">
            {{ formatRange(g.weekly.rangeStart, g.weekly.rangeEnd) }}
          </span>
        </div>

        <!-- Weekly entry -->
        <RouterLink
          v-if="g.weekly"
          :to="`/w/${g.weekId}`"
          class="flex items-center justify-between py-3 px-4 bg-ink-50 hover:bg-ink-100 transition-colors no-underline mb-2 group"
        >
          <div class="flex items-center gap-3">
            <Trophy class="w-5 h-5 text-ink-700 shrink-0" stroke-width="2" aria-hidden="true" />
            <div>
              <div class="font-serif text-base text-ink-900 group-hover:underline">
                本周必读 · Top {{ g.weekly.pickCount }}
              </div>
              <div class="text-[10px] text-ink-400 uppercase tracking-widest mt-0.5">
                WEEKLY · BY OVERALL SCORE
              </div>
            </div>
          </div>
          <span class="text-ink-400 group-hover:text-ink-900 transition-colors">→</span>
        </RouterLink>

        <!-- Daily entries -->
        <ul v-if="g.days.length" class="divide-y divide-ink-200 border-y border-ink-200">
          <li v-for="entry in g.days" :key="entry.date">
            <RouterLink
              :to="`/d/${entry.date}`"
              class="flex items-center justify-between py-4 group no-underline"
            >
              <div>
                <div class="font-serif text-lg text-ink-900 group-hover:underline">
                  {{ formatDate(entry.date) }}
                </div>
                <div class="text-[11px] text-ink-400 mt-0.5 uppercase tracking-widest">
                  {{ entry.articleCount }} 篇 · 全文 {{ entry.successFullText }}/{{
                    entry.articleCount
                  }}
                </div>
              </div>
              <span class="text-ink-400 group-hover:text-ink-900 transition-colors">→</span>
            </RouterLink>
          </li>
        </ul>
        <p v-else class="text-sm text-ink-400 px-4">这周还没有日报。</p>
      </section>
    </div>
  </section>
</template>
