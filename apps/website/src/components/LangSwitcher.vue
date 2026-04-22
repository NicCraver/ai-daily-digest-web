<script setup lang="ts">
import { useLangMode, type LangMode } from "../composables/useLangMode";

const { langMode, setLang } = useLangMode();

const options: Array<{ key: LangMode; label: string }> = [
  { key: "zh", label: "中" },
  { key: "en", label: "EN" },
  { key: "both", label: "双语" },
];
</script>

<template>
  <div
    class="inline-flex items-center bg-ink-100 rounded-full p-1 text-xs font-medium"
    role="tablist"
  >
    <button
      v-for="opt in options"
      :key="opt.key"
      type="button"
      class="px-3 py-1 rounded-full transition-colors cursor-pointer"
      :class="langMode === opt.key ? 'bg-ink-900 text-paper' : 'text-ink-700 hover:text-ink-900'"
      @click="setLang(opt.key)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
