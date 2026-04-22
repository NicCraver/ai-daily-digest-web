<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { Award, BookOpen, ExternalLink, Lightbulb, Star } from "lucide-vue-next";
import type { DigestArticle } from "../types";
import { CATEGORY_META } from "../types";
import { articleSlug } from "../articleSlug";
import { useLangMode } from "../composables/useLangMode";

const props = defineProps<{
  article: DigestArticle;
  digestDate: string;
  rank?: number;
  variant?: "featured" | "list";
}>();

const { langMode } = useLangMode();
const cat = computed(() => CATEGORY_META[props.article.category]);

const readPath = computed(() => `/d/${props.digestDate}/a/${articleSlug(props.article)}`);

const titleZh = computed(() =>
  props.article.titleZh && props.article.titleZh !== props.article.title
    ? props.article.titleZh
    : props.article.title,
);

const displaySummary = computed(() => {
  const a = props.article;
  if (langMode.value === "en" && a.summaryEn?.trim()) return a.summaryEn.trim();
  return a.summary;
});

function humanizeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (hours < 1) return "刚刚";
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return iso.slice(0, 10);
}

const showReadActions = computed(
  () =>
    props.article.fullTextStatus === "ok" ||
    (props.article.fullText && props.article.fullText.blocks.length > 0),
);
</script>

<template>
  <article
    :class="[
      variant === 'featured'
        ? 'border border-ink-200 p-6 flex flex-col gap-3.5'
        : 'border-b border-ink-200 pb-6 last:border-b-0 flex flex-col gap-2',
    ]"
  >
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Award
          v-if="rank && rank <= 3"
          class="w-4 h-4 text-ink-700 shrink-0"
          stroke-width="2"
          aria-hidden="true"
        />
        <span v-if="rank && rank > 3" class="text-[11px] font-semibold text-ink-500 tabular-nums">
          #{{ rank }}
        </span>
        <span class="text-[11px] font-semibold tracking-wider text-ink-900 uppercase">
          {{ cat.emoji }} {{ cat.label }}
        </span>
      </div>
      <span
        class="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider text-ink-700 uppercase"
      >
        <Star class="w-3.5 h-3.5 text-ink-600" stroke-width="2" aria-hidden="true" />
        {{ article.score.total }} / 30
      </span>
    </div>

    <h3
      :class="[
        'bilingual-title font-serif font-semibold text-ink-900 leading-tight',
        variant === 'featured' ? 'text-[22px]' : 'text-lg',
      ]"
    >
      <RouterLink :to="readPath" class="no-underline hover:underline text-inherit">
        <span class="lang-zh block">{{ titleZh }}</span>
        <span
          class="lang-en block"
          :class="
            variant === 'featured'
              ? 'text-[12px] italic text-ink-400 font-normal mt-1'
              : 'text-sm italic text-ink-400 font-normal mt-0.5'
          "
        >
          {{ article.title }}
        </span>
      </RouterLink>
    </h3>

    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-500">
      <a
        :href="article.sourceUrl"
        target="_blank"
        rel="noopener"
        class="hover:text-ink-900 no-underline"
      >
        {{ article.sourceName }}
      </a>
      <span>·</span>
      <span>{{ humanizeTime(article.pubDate) }}</span>
      <template v-if="article.keywords.length">
        <span>·</span>
        <span v-for="(kw, i) in article.keywords" :key="kw" class="text-ink-700"
          >{{ kw }}<span v-if="i < article.keywords.length - 1">,</span></span
        >
      </template>
      <span
        v-if="article.fullTextStatus === 'failed'"
        class="text-[10px] px-1.5 py-0.5 bg-ink-100 text-ink-500 ml-1"
      >
        仅摘要
      </span>
      <span
        v-else-if="article.fullText?.partial"
        class="text-[10px] px-1.5 py-0.5 bg-ink-100 text-ink-600 ml-1"
      >
        节选
      </span>
    </div>

    <p
      :class="[
        'font-serif leading-[1.7] text-ink-700',
        variant === 'featured' ? 'text-[15px]' : 'text-sm',
      ]"
    >
      {{ displaySummary }}
    </p>

    <p
      v-if="article.reason && variant === 'featured'"
      class="text-[13px] text-ink-700 border-l-2 border-ink-900 pl-3 italic flex gap-2"
    >
      <Lightbulb class="w-4 h-4 shrink-0 mt-0.5 text-ink-700" stroke-width="2" aria-hidden="true" />
      <span> <strong class="not-italic">为什么值得读：</strong>{{ article.reason }} </span>
    </p>

    <div
      v-if="showReadActions || article.link"
      class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1"
    >
      <RouterLink
        v-if="showReadActions"
        :to="readPath"
        class="inline-flex items-center gap-1.5 text-xs text-ink-700 hover:text-ink-900 no-underline font-medium"
      >
        <BookOpen class="w-3.5 h-3.5" stroke-width="2" aria-hidden="true" />
        站内阅读
      </RouterLink>
      <a
        :href="article.link"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1.5 text-xs text-ink-700 hover:text-ink-900 no-underline font-medium"
      >
        <ExternalLink class="w-3.5 h-3.5" stroke-width="2" aria-hidden="true" />
        阅读原文
      </a>
    </div>
  </article>
</template>
