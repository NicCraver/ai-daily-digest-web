<script setup lang="ts">
import { RouterView, RouterLink } from "vue-router";
import { Archive } from "lucide-vue-next";
import LangSwitcher from "./components/LangSwitcher.vue";
import WeeklyBanner from "./components/WeeklyBanner.vue";
</script>

<template>
  <div class="min-h-screen bg-paper">
    <WeeklyBanner />
    <header class="border-b border-ink-200">
      <div class="mx-auto max-w-[1440px] px-12 h-[60px] flex items-center justify-between">
        <div class="flex items-center gap-6 min-w-0">
          <RouterLink
            to="/"
            class="font-serif text-xl font-semibold text-ink-900 no-underline tracking-tight truncate"
          >
            AI Daily · 博客每日精选
          </RouterLink>
          <RouterLink
            to="/archive"
            class="shrink-0 inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-900 no-underline"
          >
            <Archive class="w-4 h-4" stroke-width="2" aria-hidden="true" />
            归档
          </RouterLink>
        </div>
        <LangSwitcher />
      </div>
    </header>

    <main>
      <RouterView />
    </main>

    <footer class="border-t border-ink-200 mt-16">
      <div class="mx-auto max-w-[1440px] px-12 py-8 text-xs text-ink-400 flex justify-between">
        <span>由「懂点儿AI」制作 · 数据每日 AI 精选</span>
        <span>Powered by LongCat · Vue3 SSG</span>
      </div>
    </footer>
  </div>
</template>
