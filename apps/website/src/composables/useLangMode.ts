import { ref, watchEffect } from "vue";

export type LangMode = "zh" | "en" | "both";

const STORAGE_KEY = "aidd-lang-mode";
const isClient = typeof window !== "undefined";

const initial: LangMode = (() => {
  if (!isClient) return "both";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "zh" || saved === "en" || saved === "both") return saved;
  } catch {
    /* ignore */
  }
  return "both";
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
