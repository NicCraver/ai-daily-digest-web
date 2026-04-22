# AI Daily Digest

每天从 [Andrej Karpathy](https://x.com/karpathy) 推荐的 90 余个顶级技术博客中抓取最新文章，用 AI 多维评分挑出 Top 15，再抓回原文做段落级中文翻译，最后渲染成一个**可双语对照阅读的静态网站**。

适合在团队里分享给看不到外网的同事 —— 站点是纯静态的，HTML 已包含全部内容，部署到 Cloudflare Pages 后内网打开就能看。

> 信息源来自 [Hacker News Popularity Contest 2025](https://refactoringenglish.com/tools/hn-popularity/)，覆盖 simonwillison.net、paulgraham.com、overreacted.io、gwern.net、krebsonsecurity.com 等。

---

## 仓库结构

```
ai-daily-digest/
├── apps/
│   ├── digest/                ← ① 数据生成（Bun + LongCat AI）
│   │   ├── src/digest.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── website/               ← ② 前端（Vue3 + Tailwind v4 + vite-ssg）
│       ├── src/
│       │   ├── pages/         (Home / Day / Archive)
│       │   ├── components/    (DayDigest, ArticleCard, BilingualBlock …)
│       │   ├── composables/   (useLangMode 双语切换)
│       │   ├── data.ts        ← import.meta.glob 读 ../../../data/*.json
│       │   └── router.ts
│       └── vite.config.ts     ← vite-ssg + tailwind 配置
├── data/                      ← JSON 数据契约
│   ├── index.json             (所有日期索引)
│   └── 2026-04-21.json        (单日数据，含全文 + 翻译)
├── output/cache/              ← 全文 + 翻译缓存（按 URL hash）
├── .env                       ← API Key（git ignored）
├── package.json               ← workspace 根，含顶层快捷脚本
├── vite.config.ts             ← Vite+ 全局配置
└── README.md                  ← 你正在读
```

**两个 app，一个数据流：**

```
apps/digest                        apps/website
     │                                 │
     ├─ 抓 RSS                         ├─ vite-ssg build
     ├─ AI 评分 / 摘要                 ├─ import.meta.glob('../../../data/*.json')
     ├─ Readability 抽全文             ├─ 每个日期一个静态 HTML
     ├─ LongCat 段落翻译               └─ dist/ → 部署 Cloudflare Pages
     │
     └─ 写 ../../data/YYYY-MM-DD.json ─┘
```

---

## 关键设计

- **数据与渲染解耦**：`apps/digest` 只产 JSON，`apps/website` 独立构建。换前端框架不影响数据，换 AI 模型不影响前端。
- **AI 提供方可切换**：默认 [LongCat](https://api.longcat.chat)（每日 5000 万 token 免费），优先用 Gemini（如果配了 key），自动降级到任何 OpenAI 兼容 API。
- **段落对照翻译**：Readability 抽出的每个段落都有英文 + 中文，前端可在 中 / EN / 双语 三种模式切换（localStorage 记忆）。
- **失败优雅降级**：抓不到全文的文章只翻译标题和摘要，标记 "仅摘要"。
- **缓存**：全文抓取和翻译都按 URL hash 缓存到 `output/cache/`，重跑不浪费 API 配额。
- **静态产物自包含**：单个日期 HTML ~60 KB，含全部内容，无外网依赖（除 Google Fonts CDN，可选去掉）。

---

## 快速开始

> 需要 [Bun](https://bun.sh) 和 [Vite+ (`vp`)](https://viteplus.dev/) 全局 CLI。

### 1. 装依赖

```bash
bun install
```

### 2. 配置 AI Key

在仓库根目录建 `.env`：

```bash
# --- OpenAI 兼容（LongCat / DeepSeek / OpenAI 等）---
# 推荐：LongCat（每日 5000 万 token 免费，申请 https://longcat.chat/platform）
OPENAI_API_KEY=ak_xxxxxxxxxxxxxxxx
OPENAI_API_BASE=https://api.longcat.chat/openai/v1
OPENAI_MODEL=LongCat-Flash-Chat

# --- Gemini（可选；若配置则优先于 OpenAI 兼容端）---
# GEMINI_API_KEY=xxxxx
# 任选其一方式指定端点与模型：
# 1) 完整 generateContent URL（优先级最高）
# GEMINI_API_URL=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent
# 2) 或拆成 base + 模型名（与官方 REST 一致）
# GEMINI_API_BASE=https://generativelanguage.googleapis.com/v1beta
# GEMINI_MODEL=gemini-2.0-flash
```

### 3. 生成数据 → 构建 → 预览

从仓库根目录就能跑：

```bash
# 生成数据（抓 RSS、评分、抓全文、翻译）
bun run digest          # 完整：48h、15 篇，约 5–10 分钟
bun run digest:quick    # 验证：10 候选、3 篇，约 1–2 分钟

# 构建静态站
bun run build

# 本地预览
bun run preview         # http://localhost:4173

# 或开发模式（热重载）
bun run dev
```

也可以直接进 sub-app 跑（更细粒度）：

```bash
cd apps/digest && bun run start    # 完整生成
cd apps/digest && bun run quick    # 快速验证

cd apps/website && vp dev          # 开发
cd apps/website && vp dlx vite-ssg build
```

生成完会写入：

```
data/YYYY-MM-DD.json    （单日数据）
data/index.json         （日期索引）
data/digest-YYYYMMDD.md （备份 markdown）
```

构建产物在仓库根目录 `dist/`（由 `apps/website` 的 Vite 配置输出），每个日期一个 HTML。

---

## CLI 参数（apps/digest）

直接调用 `bun src/digest.ts [options]`：

| 参数                | 默认                           | 说明                                                  |
| ------------------- | ------------------------------ | ----------------------------------------------------- |
| `--hours <n>`       | 48                             | 抓取最近 N 小时的文章                                 |
| `--top-n <n>`       | 15                             | 精选条数                                              |
| `--max-scan <n>`    | 不限                           | 评分阶段最多扫多少篇（仅取最新的 N 篇评分，省 token） |
| `--lang <zh\|en>`   | zh                             | 摘要 / 翻译目标语言                                   |
| `--data-dir <path>` | 仓库根 `data/`                 | JSON 输出目录                                         |
| `--output <path>`   | `<dataDir>/digest-YYYYMMDD.md` | 备份 markdown 报告                                    |

环境变量：

| 变量              | 说明                                                                               |
| ----------------- | ---------------------------------------------------------------------------------- |
| `GEMINI_API_KEY`  | 可选，配了优先用 Gemini                                                            |
| `GEMINI_API_URL`  | 可选，完整 `generateContent` URL；不设则用 `GEMINI_API_BASE` + `GEMINI_MODEL` 拼接 |
| `GEMINI_API_BASE` | 可选，默认 `https://generativelanguage.googleapis.com/v1beta`                      |
| `GEMINI_MODEL`    | 可选，默认 `gemini-2.0-flash`                                                      |
| `OPENAI_API_KEY`  | OpenAI 兼容 API key（LongCat / DeepSeek / OpenAI 都行）                            |
| `OPENAI_API_BASE` | 可选，默认 `https://api.longcat.chat/openai/v1`                                    |
| `OPENAI_MODEL`    | 可选，不设时按 `OPENAI_API_BASE` 推断（如 LongCat / DeepSeek），否则见代码默认     |
| `DIGEST_HTML=1`   | 同时输出旧版自包含 HTML（默认关闭）                                                |

---

## 部署到 Cloudflare Pages（免费）

> 设计目标：你电脑关机也能每天自动更新。

### 流程概览

1. **GitHub Actions**（`.github/workflows/daily-digest.yml`）按 cron 或手动触发：跑 `digest`（24h、Top 15）→ 校验 `bun run build` → 将 `data/` 提交并 push 到当前分支。
2. **Cloudflare Pages** 与 GitHub 仓库关联后，该 push 会触发 **Cloudflare 侧**再执行 `bun install && bun run build`，产出 `dist/` 并发布。

`output/cache` 不提交，由 Actions 的 **cache** 在跑次之间复用全文/翻译缓存，省 API 与耗时。

### 1. 配置 GitHub Secrets

在仓库 **Settings → Secrets and variables → Actions** 中至少配置其一：

| Secret           | 说明                                             |
| ---------------- | ------------------------------------------------ |
| `OPENAI_API_KEY` | 推荐：LongCat 等 OpenAI 兼容 key                 |
| `GEMINI_API_KEY` | 若优先用 Gemini 则配置（与 digest 内优先级一致） |

可选（不设则用 digest 默认，见上文「环境变量」表）：

- `OPENAI_API_BASE`、`OPENAI_MODEL`
- `GEMINI_API_URL` 或 `GEMINI_API_BASE` + `GEMINI_MODEL`

### 2. 启用工作流

工作流已位于 `.github/workflows/daily-digest.yml`：

- 默认 **每天 UTC 00:00**（约 **北京时间 08:00**）执行；可在文件内改 `schedule.cron`。
- 在 Actions 里可 **Run workflow** 手动触发，便于先跑通再依赖定时。

需要 **GHA 有写权限** 以提交 `data/`：仓库 **Settings → Actions → General → Workflow permissions** 中勾选 _Read and write permissions_，或在组织策略里允许 GHA push。

### 3. 连接 Cloudflare Pages

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**。
2. 选中本仓库，构建设置建议：
   - **Root directory**：仓库根（`.`）
   - **Build command**：`bun install && bun run build`
   - **Build output directory**：`dist`
3. 生产分支选 `main`（或你的默认分支）。环境变量在 Pages 里一般**不必**放 AI Key（key 只用在 GitHub Actions）。

4. **Bun 版本**（可选）：Cloudflare Pages 新版构建镜像已预装 Bun。若与本地不一致，可在 Pages 项目 **Environment variables** 中设置 `BUN_VERSION=1.3.13`，与 `packageManager` 对齐。

首次可在本地跑通 `bun run build` 后，在 CF 上点 **Save and Deploy**。

### 5. 可选：不经过「提交 data」的直传

若希望由 CI 直接上传构建产物、而不依赖「push 触发 CF 再构建」：可在同一 run 中于 `bun run build` 后增加 `wrangler pages deploy`（需 `CLOUDFLARE_API_TOKEN` 等），并注意避免与 **Git 集成构建** 重复跑两次。多数场景用上面的「GHA 提交 + CF 拉取构建」即可。

### 免费额度核对

- GitHub Actions：公开仓库**无限**，私有仓库每月 2000 分钟。
- Cloudflare Pages：免费**无限带宽**，500 次构建/月。
- LongCat：5000 万 token / 天 / 账号。

---

## 浏览模式

每篇文章卡片可以点开"阅读全文（双语对照）"，正文段落支持三种视图：

- **中** —— 仅显示中文译文
- **EN** —— 仅显示英文原文
- **双语** —— 段落上下交替显示（默认）

切换状态保存在 localStorage，下次打开记住偏好。

---

## 常见问题

**Q: digest 跑得慢？**
评分 + 全文抓取 + 翻译都要时间。开发期用 `bun run digest:quick` 先验证（10 候选、3 篇）。生产环境放 GitHub Actions 跑，慢点没关系。

**Q: 翻译报 401？**
检查 `.env` 里的 key 是 LongCat 的（不是 OpenAI 的）。LongCat key 形如 `ak_xxxxx`。

**Q: 抓不到某些站全文？**
正常。Cloudflare 防爬、付费墙、JS 渲染内容都抓不到。这些文章会标记"仅摘要"，仍会显示标题和摘要的中英对照。

**Q: 想换 AI 模型？**
OpenAI 兼容端：改 `.env` 的 `OPENAI_API_BASE`、`OPENAI_API_KEY`、`OPENAI_MODEL`。Gemini：配 `GEMINI_API_KEY`，并用 `GEMINI_API_URL` 或 `GEMINI_API_BASE` + `GEMINI_MODEL` 指定端点与模型。已支持 LongCat（默认）、DeepSeek（按 base 推断）、OpenAI 官方、任何兼容协议的 endpoint。
