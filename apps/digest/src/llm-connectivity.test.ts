import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

import { expect, test } from "vite-plus/test";

import { createAIClient } from "./ai-provider";

// 与 `bun --env-file=../../.env` 一致：从 monorepo 根目录读 `.env`（Vitest 默认 cwd 在 apps/digest）
const rootEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env");
if (existsSync(rootEnvPath)) {
  try {
    const fromFile = parseEnv(readFileSync(rootEnvPath, "utf8"));
    for (const [key, value] of Object.entries(fromFile)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    /* ignore invalid .env for optional connectivity test */
  }
}

const hasAnyKey = Boolean(process.env.GEMINI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim());

/** 有任一 API Key 时走真实网络；无 Key 时跳过（便于 CI / 未配置环境）。 */
test.skipIf(!hasAnyKey)("大模型连通：最小对话能返回非空内容", async () => {
  const client = createAIClient({
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiApiUrl: process.env.GEMINI_API_URL,
    geminiApiBase: process.env.GEMINI_API_BASE,
    geminiModel: process.env.GEMINI_MODEL,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiApiBase: process.env.OPENAI_API_BASE,
    openaiModel: process.env.OPENAI_MODEL,
  });

  const reply = await client.call(
    "Reply with a single short word only: ok. No punctuation or explanation.",
  );

  expect(reply.trim().length).toBeGreaterThan(0);
});
