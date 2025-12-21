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

**Subtitle Translator** 是一款批量字幕翻译工具，支持 `.srt`、`.ass`、`.vtt`、`.lrc` 等格式。通过**多种翻译接口（API + AI 大模型）**，可将字幕文件**快速翻译成 50+ 种语言**，并支持**多语言同时翻译**，满足国际化需求。

👉 **在线体验**：<https://tools.newzone.top/zh/subtitle-translator>

## 核心特性

![批量翻译演示](https://img.newzone.top/subtile-translator.gif?imageMogr2/format/webp)

- **秒级翻译**：利用**分块压缩**和**并行处理**技术，实现 1 秒翻译一集电视剧。
- **批量处理**：支持一次性处理上百份字幕文件，极大提升翻译效率。
- **高性能缓存 (IndexedDB)**：翻译结果存储在 **IndexedDB** 中，**无容量限制**，突破浏览器存储瓶颈。
- **上下文关联翻译**（仅限 AI 模型）：带入前后文语境进行翻译，对话更连贯自然。
- **格式兼容**：自动识别 `.srt`、`.ass`、`.vtt`、`.lrc` 格式，导出文件名与原文件一致。
- **双语字幕**：译文可插入原字幕下方，支持调整显示位置（上/下）。
- **字幕提取**：导出纯文本，方便 AI 总结或二次创作。
- **多语言支持**：同一文件可同时翻译成 **50+ 种语言**。

## 翻译接口

支持 **5 种翻译 API** 和 **9 种 AI 大模型**：

### 传统翻译 API

| API 类型             | 翻译质量 | 稳定性 | 免费额度                       |
| -------------------- | -------- | ------ | ------------------------------ |
| **DeepL(X)**         | ★★★★★    | ★★★★☆  | 每月 50 万字符                 |
| **Google Translate** | ★★★★☆    | ★★★★★  | 每月 50 万字符                 |
| **Azure Translate**  | ★★★★☆    | ★★★★★  | **前 12 个月** 每月 200 万字符 |
| **GTX API（免费）**  | ★★★☆☆    | ★★★☆☆  | 免费（有频率限制）             |
| **GTX Web（免费）**  | ★★★☆☆    | ★★☆☆☆  | 免费                           |

### AI 大模型

支持 **DeepSeek**、**OpenAI**、**Gemini**、**Azure OpenAI**、**Siliconflow**、**Groq**、**OpenRouter**、**Perplexity** 以及 **自定义 LLM**。

- **适用场景**：文学作品、技术文档、多语言对话。
- **可定制**：支持配置**系统提示词**和**用户提示词**，个性化翻译风格。
- **温度控制**：调整 AI 创造性（0–1）。

## 上下文关联翻译

_上下文关联翻译_（仅限 AI 模型）会将字幕分批发送给大模型，并附带前后文语境，确保对话连贯、语气自然。

两个关键参数：

- **并发行数**：同时翻译的最大行数（默认：20）。过高可能触发速率限制。
- **上下文行数**：每批包含的上下文行数（默认：50）。越高连贯性越好，但可能超出 Token 限制。

⚠️ **提示**：70B 以下或本地小模型可能输出错位文本，建议使用主流在线大模型。

## 字幕格式支持

- **双语字幕**：译文插入原字幕下方，位置可调。
- **时间轴兼容**：支持 100+ 小时时间戳及 1–3 位毫秒格式。
- **自动编码识别**：自动检测文件编码，避免乱码。

## 翻译模式

- **批量模式**（默认）：同时处理上百文件，结果自动下载。
- **单文件模式**：快速翻译并即时预览，每次上传覆盖上一个文件。

## 文档与部署

详细配置、API 设置和自托管说明，请参阅 **[官方文档](https://docs.newzone.top/guide/translation/subtitle-translator/)**。

**快速部署**：[部署指南](https://docs.newzone.top/guide/translation/subtitle-translator/deploy.html)

## 参与贡献

欢迎通过 Issue 或 Pull Request 参与贡献！

## 许可协议

MIT © 2025 [rockbenben](https://github.com/rockbenben)。详见 [LICENSE](./LICENSE)。
