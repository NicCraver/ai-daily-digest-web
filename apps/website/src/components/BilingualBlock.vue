<script setup lang="ts">
import { computed } from "vue";
import type { ContentBlock } from "../types";
import { useLangMode } from "../composables/useLangMode";

const props = defineProps<{
  block: ContentBlock;
  /** 与 digest JSON `fullText.translations[i]` 对齐；缺省则仅显示原文 */
  translation?: string;
}>();

const { langMode } = useLangMode();

/** 与 digest 生成侧一致：去掉模型在段首加的「译文」标签 */
function stripTranslationPrefix(text: string): string {
  let s = text.trimStart();
  if (!s.startsWith("译文")) return text.trim();
  s = s.slice(2);
  s = s.replace(/^[：:\s\u3000\u00a0]+/, "");
  return s.trim();
}

const tag = computed(() => {
  switch (props.block.type) {
    case "h1":
      return "h2";
    case "h2":
      return "h3";
    case "h3":
      return "h4";
    case "li":
      return "li";
    case "quote":
      return "blockquote";
    default:
      return "p";
  }
});

const isHeading = computed(() => ["h1", "h2", "h3"].includes(props.block.type));
const isCode = computed(() => props.block.type === "code");

const enText = computed(() => props.block.text);
const zhText = computed(() => {
  const raw = props.translation?.trim();
  if (!raw) return props.block.text;
  const t = stripTranslationPrefix(raw);
  if (!t || t === props.block.text.trim()) return props.block.text;
  return t;
});
/** 正文不逐段中英对照；仅随语言在「中文 / 英文」间切换（对照模式与中文相同，以中文为主） */
const displayText = computed(() => {
  if (isCode.value) return props.block.text;
  return langMode.value === "en" ? enText.value : zhText.value;
});
</script>

<template>
  <pre
    v-if="isCode"
    class="bg-ink-100 rounded p-3 overflow-x-auto text-xs font-mono text-ink-900"
  ><code>{{ block.text }}</code></pre>

  <component
    :is="tag"
    v-else
    :class="[
      'block',
      isHeading ? 'font-serif font-semibold text-ink-900 mt-4 mb-1' : '',
      block.type === 'h1' ? 'text-xl' : '',
      block.type === 'h2' ? 'text-lg' : '',
      block.type === 'h3' ? 'text-base' : '',
      block.type === 'p' ? 'font-serif text-[15px] leading-[1.75] text-ink-700' : '',
      block.type === 'li' ? 'list-disc ml-6 font-serif text-[15px] leading-[1.7] text-ink-700' : '',
      block.type === 'quote'
        ? 'border-l-2 border-ink-200 pl-3 italic font-serif text-[15px] text-ink-500'
        : '',
    ]"
  >
    <span class="block text-ink-800">{{ displayText }}</span>
  </component>
</template>
