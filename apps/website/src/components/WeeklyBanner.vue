<script setup lang="ts">
import { ref, computed, watchEffect } from "vue";
import { RouterLink } from "vue-router";
import { Calendar, ChevronRight } from "lucide-vue-next";
import { weeklyIndex } from "../data";

const isClient = typeof window !== "undefined";

const latest = computed(() => weeklyIndex.weeks[0]);

function dismissKey(weekId: string): string {
  return `aidd-weekly-dismissed-${weekId}`;
}

const dismissed = ref(false);

if (isClient) {
  watchEffect(() => {
    const w = latest.value;
    if (!w) {
      dismissed.value = true;
      return;
    }
    try {
      dismissed.value = window.localStorage.getItem(dismissKey(w.weekId)) === "1";
    } catch {
      dismissed.value = false;
    }
  });
}

function dismiss(): void {
  if (!latest.value) return;
  dismissed.value = true;
  try {
    window.localStorage.setItem(dismissKey(latest.value.weekId), "1");
  } catch {
    /* ignore */
  }
}

function formatRange(start: string, end: string): string {
  const [, m1, d1] = start.split("-");
  const [, m2, d2] = end.split("-");
  if (m1 === m2) return `${parseInt(m1, 10)}/${parseInt(d1, 10)}–${parseInt(d2, 10)}`;
  return `${parseInt(m1, 10)}/${parseInt(d1, 10)} – ${parseInt(m2, 10)}/${parseInt(d2, 10)}`;
}
</script>

<template>
  <div v-if="latest && !dismissed" class="bg-ink-900 text-paper text-sm">
    <div class="mx-auto max-w-[1440px] px-12 h-9 flex items-center justify-between gap-4">
      <RouterLink
        :to="`/w/${latest.weekId}`"
        class="flex items-center gap-2 no-underline text-paper hover:opacity-80 transition-opacity"
      >
        <Calendar class="w-4 h-4 shrink-0 opacity-90" stroke-width="2" aria-hidden="true" />
        <span class="font-medium">本周精选已更新</span>
        <span class="opacity-60">·</span>
        <span class="font-mono text-xs opacity-80">{{ latest.weekId }}</span>
        <span class="opacity-60">·</span>
        <span class="text-xs opacity-80">
          {{ formatRange(latest.rangeStart, latest.rangeEnd) }}
        </span>
        <span class="opacity-60">·</span>
        <span class="opacity-80">{{ latest.pickCount }} 篇</span>
        <ChevronRight
          class="w-4 h-4 ml-0.5 shrink-0 opacity-80"
          stroke-width="2"
          aria-hidden="true"
        />
      </RouterLink>
      <button
        type="button"
        class="text-paper opacity-60 hover:opacity-100 cursor-pointer text-lg leading-none px-1"
        :aria-label="`关闭 ${latest.weekId} 通知`"
        @click="dismiss"
      >
        ×
      </button>
    </div>
  </div>
</template>
