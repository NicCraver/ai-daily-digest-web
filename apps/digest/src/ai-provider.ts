// Gemini + OpenAI-compatible providers (shared by digest CLI and tests)

/** 未设置 `GEMINI_API_URL` / `GEMINI_API_BASE` 时的 Google Generative Language API 根路径 */
export const DEFAULT_GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
/** 未设置 `GEMINI_MODEL` 时的默认模型 id（与官方 REST 路径段一致） */
export const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

export const OPENAI_DEFAULT_API_BASE = "https://api.longcat.chat/openai/v1";
const OPENAI_DEFAULT_MODEL = "LongCat-Flash-Chat";

/**
 * 解析 Gemini `generateContent` 完整 URL（不含 `?key=`）。
 * 优先 `GEMINI_API_URL`；否则用 `GEMINI_API_BASE` + `GEMINI_MODEL` 拼接。
 */
export function resolveGeminiGenerateUrl(options: {
  geminiApiUrl?: string;
  geminiApiBase?: string;
  geminiModel?: string;
}): string {
  const explicit = options.geminiApiUrl?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const base = (options.geminiApiBase?.trim() || DEFAULT_GEMINI_API_BASE).replace(/\/+$/, "");
  const model = options.geminiModel?.trim() || DEFAULT_GEMINI_MODEL;
  return `${base}/models/${model}:generateContent`;
}

export interface AIClient {
  call(prompt: string): Promise<string>;
}

async function callGemini(
  prompt: string,
  apiKey: string,
  generateContentUrl: string,
): Promise<string> {
  const response = await fetch(`${generateContentUrl}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function callOpenAICompatible(
  prompt: string,
  apiKey: string,
  apiBase: string,
  model: string,
): Promise<string> {
  const normalizedBase = apiBase.replace(/\/+$/, "");
  const response = await fetch(`${normalizedBase}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      top_p: 0.8,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`OpenAI-compatible API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("\n");
  }
  return "";
}

export function inferOpenAIModel(apiBase: string): string {
  const base = apiBase.toLowerCase();
  if (base.includes("deepseek")) return "deepseek-chat";
  if (base.includes("longcat")) return "LongCat-Flash-Chat";
  return OPENAI_DEFAULT_MODEL;
}

export function createAIClient(config: {
  geminiApiKey?: string;
  geminiApiUrl?: string;
  geminiApiBase?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiApiBase?: string;
  openaiModel?: string;
}): AIClient {
  const geminiGenerateUrl = resolveGeminiGenerateUrl({
    geminiApiUrl: config.geminiApiUrl,
    geminiApiBase: config.geminiApiBase,
    geminiModel: config.geminiModel,
  });

  const state = {
    geminiApiKey: config.geminiApiKey?.trim() || "",
    openaiApiKey: config.openaiApiKey?.trim() || "",
    openaiApiBase: (config.openaiApiBase?.trim() || OPENAI_DEFAULT_API_BASE).replace(/\/+$/, ""),
    openaiModel: config.openaiModel?.trim() || "",
    geminiEnabled: Boolean(config.geminiApiKey?.trim()),
    fallbackLogged: false,
  };

  if (!state.openaiModel) {
    state.openaiModel = inferOpenAIModel(state.openaiApiBase);
  }

  return {
    async call(prompt: string): Promise<string> {
      if (state.geminiEnabled && state.geminiApiKey) {
        try {
          return await callGemini(prompt, state.geminiApiKey, geminiGenerateUrl);
        } catch (error) {
          if (state.openaiApiKey) {
            if (!state.fallbackLogged) {
              const reason = error instanceof Error ? error.message : String(error);
              console.warn(
                `[digest] Gemini failed, switching to OpenAI-compatible fallback (${state.openaiApiBase}, model=${state.openaiModel}). Reason: ${reason}`,
              );
              state.fallbackLogged = true;
            }
            state.geminiEnabled = false;
            return callOpenAICompatible(
              prompt,
              state.openaiApiKey,
              state.openaiApiBase,
              state.openaiModel,
            );
          }
          throw error;
        }
      }

      if (state.openaiApiKey) {
        return callOpenAICompatible(
          prompt,
          state.openaiApiKey,
          state.openaiApiBase,
          state.openaiModel,
        );
      }

      throw new Error("No AI API key configured. Set GEMINI_API_KEY and/or OPENAI_API_KEY.");
    },
  };
}
