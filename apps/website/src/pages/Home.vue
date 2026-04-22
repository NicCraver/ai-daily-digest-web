<script setup lang="ts">
import { computed } from "vue";
import { getLatestDate, getDigest, digestIndex } from "../data";
import DayDigest from "../components/DayDigest.vue";

const latestDate = computed(() => getLatestDate());
const digest = computed(() => (latestDate.value ? getDigest(latestDate.value) : undefined));
const recentArchive = computed(() => digestIndex.dates.slice(1, 6));
</script>

<template>
  <div v-if="digest">
    <DayDigest :digest="digest" :recent="recentArchive" />
  </div>
  <div v-else class="mx-auto max-w-[720px] px-12 py-32 text-center">
    <h1 class="font-serif text-4xl font-semibold text-ink-900 mb-4">还没有内容</h1>
    <p class="text-ink-500">
      请先在仓库根目录运行
      <code class="bg-ink-100 px-2 py-0.5 rounded text-sm font-mono">bun scripts/digest.ts</code>
      生成第一份 digest。
    </p>
  </div>
</template>
