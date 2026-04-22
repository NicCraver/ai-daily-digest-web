<script setup lang="ts">
import { computed } from "vue";
import type { DigestArticle, ContentBlock } from "../types";
import BilingualBlock from "./BilingualBlock.vue";

const props = defineProps<{ article: DigestArticle }>();

const blocks = computed<ContentBlock[]>(() => props.article.fullText?.blocks || []);
const byline = computed(() => props.article.fullText?.byline);
</script>

<template>
  <div class="mt-4 border-t border-ink-200 pt-5">
    <p v-if="byline" class="text-xs italic text-ink-500 mb-3">
      {{ byline }}
    </p>
    <div class="space-y-3 max-w-[720px]">
      <BilingualBlock
        v-for="(block, idx) in blocks"
        :key="idx"
        :block="block"
        :translation="article.fullText?.translations?.[idx]"
      />
    </div>
    <p class="mt-6 text-xs text-ink-500">需要完整排版与评论请前往来源站点阅读。</p>
  </div>
</template>
