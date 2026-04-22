import { ref, watchEffect } from "vue";

export type LangMode = "zh" | "en";

const STORAGE_KEY = "aidd-lang-mode";
const isClient = typeof window !== "undefined";

const initial: LangMode = (() => {
  if (!isClient) return "zh";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en") return saved;
  } catch {
    /* ignore */
  }
  return "zh";
})();

const langMode = ref<LangMode>(initial);

if (isClient) {
  watchEffect(() => {
    const mode = langMode.value;
    document.documentElement.setAttribute("data-lang", mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  });
}

export function useLangMode() {
  return {
    langMode,
    setLang(mode: LangMode) {
      langMode.value = mode;
    },
  };
}
