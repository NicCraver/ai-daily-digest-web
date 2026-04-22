<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { ExternalLink, ArrowLeft } from "lucide-vue-next";
import { getDigest } from "../data";
import { articleSlug } from "../articleSlug";
import { CATEGORY_META } from "../types";
import ArticleFullText from "../components/ArticleFullText.vue";
import { useLangMode } from "../composables/useLangMode";

const route = useRoute();
const router = useRouter();
const date = computed(() => String(route.params.date || ""));

/** Prefer history.back() so scrollBehavior receives savedPosition (list scroll). */
function goBackFromArticle(): void {
  if (import.meta.env.SSR) return;
  const pos = (router.options.history.state as { position?: number })?.position;
  if (typeof pos === "number" && pos > 1) {
    router.back();
    return;
  }
  void router.push(`/d/${date.value}`);
}
const slug = computed(() => String(route.params.slug || ""));

const digest = computed(() => getDigest(date.value));

const article = computed(() => {
  const d = digest.value;
  if (!d) return undefined;
  return d.articles.find((a) => articleSlug(a) === slug.value);
});

const cat = computed(() => (article.value ? CATEGORY_META[article.value.category] : null));

const { langMode } = useLangMode();

const titleZh = computed(() => {
  const a = article.value;
  if (!a) return "";
  return a.titleZh && a.titleZh !== a.title ? a.titleZh : a.title;
});

const displaySummary = computed(() => {
  const a = article.value;
  if (!a) return "";
  if (langMode.value === "en" && a.summaryEn?.trim()) return a.summaryEn.trim();
  return a.summary;
});
</script>

<template>
  <article v-if="article && digest" class="mx-auto max-w-[720px] px-4 md:px-12 pb-20 pt-10">
    <a
      :href="`/d/${date}`"
      class="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900 no-underline mb-8 cursor-pointer"
      @click.prevent="goBackFromArticle"
    >
      <ArrowLeft class="w-4 h-4 shrink-0" stroke-width="2" aria-hidden="true" />
      返回 {{ date }}
    </a>

    <header class="mb-8">
      <div v-if="cat" class="text-[11px] font-semibold tracking-wider text-ink-900 uppercase mb-2">
        {{ cat.emoji }} {{ cat.label }}
      </div>
      <h1
        class="bilingual-title font-serif text-2xl md:text-3xl font-semibold text-ink-900 leading-tight"
      >
        <span class="lang-zh block">{{ titleZh }}</span>
        <span class="lang-en block text-base md:text-lg font-normal italic text-ink-500 mt-2">
          {{ article.title }}
        </span>
      </h1>
      <div class="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
        <a
          :href="article.sourceUrl"
          target="_blank"
          rel="noopener"
          class="hover:text-ink-900 no-underline"
        >
          {{ article.sourceName }}
        </a>
        <span>·</span>
        <span>{{ article.pubDate.slice(0, 10) }}</span>
        <span
          v-if="article.fullTextStatus === 'failed'"
          class="text-[10px] px-1.5 py-0.5 bg-ink-100 text-ink-500"
        >
          仅摘要
        </span>
        <span
          v-else-if="article.fullText?.partial"
          class="text-[10px] px-1.5 py-0.5 bg-ink-100 text-ink-600"
        >
          节选正文
        </span>
      </div>
    </header>

    <p
      class="font-serif text-[15px] leading-[1.75] text-ink-700 mb-8 border-l-2 border-ink-200 pl-4"
    >
      {{ displaySummary }}
    </p>

    <div class="flex flex-wrap gap-3 mb-10">
      <a
        :href="article.link"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-2 px-4 py-2.5 bg-ink-900 text-paper text-sm font-medium no-underline rounded hover:opacity-90"
      >
        <ExternalLink class="w-4 h-4" stroke-width="2" aria-hidden="true" />
        阅读原文
      </a>
    </div>

    <div v-if="article.fullTextStatus === 'failed'" class="text-sm text-ink-500">
      本站未抓取到正文，请点击「阅读原文」在来源站点阅读。
    </div>
    <ArticleFullText v-else-if="article.fullText" :article="article" />
  </article>

  <div v-else class="mx-auto max-w-[720px] px-4 md:px-12 py-32 text-center">
    <h1 class="font-serif text-3xl font-semibold mb-4">未找到文章</h1>
    <p class="text-ink-500 mb-6">该链接可能无效或内容已更新。</p>
    <a
      :href="`/d/${date}`"
      class="underline text-ink-900 cursor-pointer"
      @click.prevent="goBackFromArticle"
    >
      返回 {{ date || "当日" }}
    </a>
    <span class="text-ink-400 mx-2">·</span>
    <RouterLink to="/" class="underline text-ink-900">首页</RouterLink>
  </div>
</template>
