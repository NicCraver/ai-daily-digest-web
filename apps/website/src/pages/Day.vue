<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { getDigest, digestIndex } from "../data";
import DayDigest from "../components/DayDigest.vue";

const route = useRoute();
const date = computed(() => String(route.params.date || ""));
const digest = computed(() => getDigest(date.value));
const recentArchive = computed(() =>
  digestIndex.dates.filter((d) => d.date !== date.value).slice(0, 5),
);
</script>

<template>
  <div v-if="digest">
    <DayDigest :digest="digest" :recent="recentArchive" />
  </div>
  <div v-else class="mx-auto max-w-[720px] px-4 md:px-12 py-32 text-center">
    <h1 class="font-serif text-2xl md:text-3xl font-semibold mb-4">未找到 {{ date }} 的内容</h1>
    <p class="text-ink-500">
      <RouterLink to="/" class="underline">回到首页</RouterLink>
    </p>
  </div>
</template>
