<h1 align="center">
⚡️ Subtitle Translator
</h1>
<p align="center">
    <a href="./README.md">English</a> | 中文
</p>
<p align="center">
    <em>AI 驱动的批量字幕翻译，支持 50+ 种语言，秒级完成</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://tools.newzone.top/zh/subtitle-translator"><img src="https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-subtitle--translator-blue" alt="在线体验"></a>
</p>

**Subtitle Translator** 是一款批量字幕翻译工具，支持 `.srt`、`.ass`、`.vtt`、`.lrc` 等格式。通过分块压缩 + 并行处理，可达到 1 集电视剧 ≈ 1 秒的翻译速度。接入 7 种传统翻译 API（DeepL、Google、Azure、DeepLX、Qwen-MT、TranslateGemma、GTX）和 17+ 种 LLM，支持把同一份字幕同时翻译为 50+ 种语言。

👉 **在线体验**：<https://tools.newzone.top/zh/subtitle-translator>

![批量翻译演示](https://img.newzone.top/subtile-translator.gif?imageMogr2/format/webp)

## 核心特性

- **秒级翻译**：分块压缩 + 并行处理，达到 1 秒翻译一集电视剧。
- **批量处理**：一次性拖入上百份字幕文件，结果以原文件名自动下载。
- **格式兼容**：自动识别 `.srt`、`.ass`、`.vtt`、`.lrc`。WebVTT 的 NOTE / STYLE / REGION 非 cue 块会被正确跳过（不当作对白翻译）。
- **双语字幕**：译文可插入原字幕上方或下方，对齐保留。
- **上下文关联翻译**（仅 LLM）：每批携带前后文，对话更连贯，角色语气更稳定。
- **字幕提取**：剥离 cue / 时间码，导出纯文本用于 AI 总结或二次创作。
- **多语言输出**：同一文件可一次翻译到 50+ 种目标语言。
- **无上限缓存**（IndexedDB）：所有翻译结果本地缓存，无浏览器存储容量限制。
- **多语言界面**：基于 next-intl，支持 18 种界面语言。

## 翻译接口

支持 **7 种传统翻译 API** 和 **17+ 种 LLM 服务**：

### 传统翻译 API

| API 类型             | 翻译质量 | 稳定性 | 免费额度                        |
| -------------------- | -------- | ------ | ------------------------------- |
| **DeepL**            | ★★★★★    | ★★★★☆  | 每月 50 万字符                  |
| **Google Translate** | ★★★★☆    | ★★★★★  | 每月 50 万字符                  |
| **Azure Translate**  | ★★★★☆    | ★★★★★  | **前 12 个月** 每月 200 万字符  |
| **DeepLX（免费）**   | ★★★★☆    | ★★★☆☆  | 自部署或公共免费节点            |
| **Qwen-MT**          | ★★★★☆    | ★★★★☆  | 阿里云百炼（DashScope）配额     |
| **TranslateGemma**   | ★★★★☆    | ★★★★☆  | 自部署（LM Studio / Ollama 等） |
| **GTX API（免费）**  | ★★★☆☆    | ★★★☆☆  | 免费（有频率限制）              |

### AI 大模型

支持 **DeepSeek**、**OpenAI**、**Claude**、**Gemini**、**Qwen**、**Moonshot**、**Doubao**、**Zhipu GLM**、**MiniMax**、**Mistral**、**Perplexity**、**Cohere**、**OpenRouter**、**Groq**、**SiliconFlow**、**Nvidia NIM**、**Azure OpenAI**，以及任意 **Custom (OpenAI-compatible)** 端点（Ollama / LM Studio / vLLM / Together AI / Fireworks AI 等）。

LLM 模式提供：

- **适用场景**：文学作品、技术演讲、多语言对话
- **可定制**：支持配置 system / user prompt，定制翻译风格
- **温度控制**：调节 AI 创造性（0–1）
- **思考模式**：对推理类模型，可按 provider 单独开关

## 上下文关联翻译（仅 LLM）

LLM 模式可在每一批请求里携带前后文，提升对话连贯性和角色语气一致性。

- **并发行数**：同时翻译的最大行数（默认 20）。过高可能触发速率限制。
- **上下文行数**：每批携带的上下文行数（默认 50）。值越大连贯性越好，但 token 消耗也越多。

⚠️ **提示**：70B 以下或本地小模型容易输出错位文本，上下文模式建议使用主流在线大模型（Claude、GPT、DeepSeek、Gemini 等）。

## 字幕格式支持

| 格式     | 自动识别 | 双语 | 备注                                                                |
| -------- | -------- | ---- | ------------------------------------------------------------------- |
| **.srt** | ✅       | ✅   | 1–3 位毫秒、100+ 小时时间戳                                         |
| **.ass** | ✅       | ✅   | Style 标签通过占位符保护，翻译完后无损还原                          |
| **.vtt** | ✅       | ✅   | NOTE / STYLE / REGION 块正确跳过（不会被翻译成对白）                |
| **.lrc** | ✅       | ✅   | 预编译全局正则处理多时间标签的卡拉 OK 行                            |

- **自动编码检测**：避免非 UTF-8 文件乱码。
- **文件名保留**：导出文件继承原文件名，多语言输出额外追加语言后缀。

## 翻译模式

- **批量模式**（默认）：一次性拖入上百文件，结果自动下载。
- **单文件模式**：快速预览，新上传的文件替换当前文件。

## 技术栈

- **框架**：[Next.js 16](https://nextjs.org/)（App Router）+ React 19 with React Compiler
- **UI**：[Ant Design 6](https://ant.design/) + [Tailwind CSS 4](https://tailwindcss.com/)
- **i18n**：[next-intl](https://next-intl-docs.vercel.app/)
- **缓存**：[idb](https://github.com/jakearchibald/idb)（IndexedDB）
- **编码检测**：[jschardet](https://github.com/aadsm/jschardet)

## 快速开始

### 环境要求

- Node.js >= 20.9.0
- Yarn（推荐）、npm 或 pnpm

### 安装与启动

```bash
git clone https://github.com/rockbenben/subtitle-translator.git
cd subtitle-translator

yarn install
yarn dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

### 构建生产版本

```bash
yarn build
```

## 文档与部署

详细配置、API 设置和自托管说明，请参阅 **[官方文档](https://docs.newzone.top/zh/guide/translation/subtitle-translator/)**。

**快速部署**：[部署指南](https://docs.newzone.top/zh/guide/translation/subtitle-translator/deploy.html)

## 参与贡献

欢迎通过 Issue 或 Pull Request 参与贡献！

1. Fork 本仓库并创建功能分支
2. 本地执行 `yarn` 与 `yarn dev`
3. 适当补充测试 / 文档
4. 提交 PR 并清晰描述变更

## 许可协议

MIT © 2025 [rockbenben](https://github.com/rockbenben)。详见 [LICENSE](./LICENSE)。
