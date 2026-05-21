<h1 align="center">
⚡️ Subtitle Translator
</h1>
<p align="center">
    English | <a href="./README-zh.md">中文</a>
</p>
<p align="center">
    <em>Blazing-fast batch subtitle translation for 50+ languages — powered by AI</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://tools.newzone.top/en/subtitle-translator"><img src="https://img.shields.io/badge/Live%20Demo-subtitle--translator-blue" alt="Live Demo"></a>
</p>

**Subtitle Translator** is a batch subtitle translation tool for `.srt`, `.ass`, `.vtt`, and `.lrc` files. With chunked compression and parallel processing it hits ~1 second per episode. Connect to 7 traditional translation APIs (DeepL, Google, Azure, DeepLX, Qwen-MT, TranslateGemma, GTX) or 17+ LLM providers, and translate a single file into 50+ languages in one pass.

👉 **Try it online**: <https://tools.newzone.top/en/subtitle-translator>

![Batch Translation Demo](https://img.newzone.top/subtile-translator.gif?imageMogr2/format/webp)

## Key Features

- **Real-Time Translation**: Chunked compression + parallel processing → ~1 second per episode.
- **Batch Processing**: Drop hundreds of subtitle files at once; results auto-download with the original filename.
- **Format Compatibility**: Auto-detects `.srt`, `.ass`, `.vtt`, and `.lrc`. WebVTT NOTE / STYLE / REGION non-cue blocks are correctly skipped (not translated as dialogue).
- **Bilingual Output**: Insert the translation above or below the original; alignment preserved across formats.
- **Context-Aware Translation** (LLM only): Sends surrounding lines as context for more coherent dialogue and consistent character voice.
- **Subtitle Extraction**: Strip cues / timing and export clean text for AI summarization or content repurposing.
- **Multi-Language Output**: Translate one file into 50+ target languages in a single pass.
- **Unlimited Caching** (IndexedDB): All translations cached locally with no browser-storage size limit.
- **Multi-Locale UI**: Powered by next-intl, with full UI translation across 18 languages.

## Translation APIs

Supports **7 traditional MT APIs** and **17+ LLM providers**:

### Traditional APIs

| API                  | Quality | Stability | Free Tier                             |
| -------------------- | ------- | --------- | ------------------------------------- |
| **DeepL**            | ★★★★★   | ★★★★☆     | 500K chars/month                      |
| **Google Translate** | ★★★★☆   | ★★★★★     | 500K chars/month                      |
| **Azure Translate**  | ★★★★☆   | ★★★★★     | 2M chars/month (first 12 months)      |
| **DeepLX (Free)**    | ★★★★☆   | ★★★☆☆     | Self-host or free public endpoints    |
| **Qwen-MT**          | ★★★★☆   | ★★★★☆     | Alibaba DashScope quota               |
| **TranslateGemma**   | ★★★★☆   | ★★★★☆     | Self-host (LM Studio / Ollama / etc.) |
| **GTX API (Free)**   | ★★★☆☆   | ★★★☆☆     | Free (rate-limited)                   |

### LLM Providers

Supports **DeepSeek**, **OpenAI**, **Claude**, **Gemini**, **Qwen**, **Moonshot**, **Doubao**, **Zhipu GLM**, **MiniMax**, **Mistral**, **Perplexity**, **Cohere**, **OpenRouter**, **Groq**, **SiliconFlow**, **Nvidia NIM**, **Azure OpenAI**, plus any **Custom (OpenAI-compatible)** endpoint (Ollama / LM Studio / vLLM / Together AI / Fireworks AI etc.).

LLM modes give you:

- **Best for**: literary works, technical talks, multilingual dialogue
- **Customization**: configure system / user prompts for a specific translation style
- **Temperature Control**: adjust AI creativity (0–1 scale)
- **Thinking Mode**: per-provider toggle for reasoning-capable models

## Context-Aware Translation (LLM only)

LLM modes can send surrounding lines as context for each batch, improving dialogue coherence and character-voice consistency.

- **Concurrent Lines**: max lines translated in parallel (default 20). Too high triggers rate limits.
- **Context Lines**: lines included per batch as context (default 50). Higher = better coherence but more tokens.

⚠️ **Tip**: Models under 70B parameters may produce misaligned output. Mainstream online large models (Claude, GPT, DeepSeek, Gemini) are recommended for context mode.

## Subtitle Format Support

| Format   | Auto-detect | Bilingual | Notes                                                                        |
| -------- | ----------- | --------- | ---------------------------------------------------------------------------- |
| **.srt** | ✅          | ✅        | 1–3 digit milliseconds, 100+ hour timestamps                                 |
| **.ass** | ✅          | ✅        | Style tags preserved via placeholder protection                              |
| **.vtt** | ✅          | ✅        | NOTE / STYLE / REGION blocks correctly skipped (not treated as dialogue)     |
| **.lrc** | ✅          | ✅        | Pre-compiled global regex handles karaoke lines with multiple time tags      |

- **Automatic Encoding Detection**: Avoids garbled output for non-UTF-8 inputs.
- **Filename Preservation**: Exported files inherit the original name; multi-language output appends a language suffix.

## Translation Modes

- **Batch Mode (default)**: drop hundreds of files at once; results auto-download.
- **Single-File Mode**: instant preview; uploading a new file replaces the current one.

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router) + React 19 with the React Compiler
- **UI**: [Ant Design 6](https://ant.design/) + [Tailwind CSS 4](https://tailwindcss.com/)
- **i18n**: [next-intl](https://next-intl-docs.vercel.app/)
- **Caching**: [idb](https://github.com/jakearchibald/idb) (IndexedDB)
- **Encoding Detection**: [jschardet](https://github.com/aadsm/jschardet)

## Getting Started

### Requirements

- Node.js >= 20.9.0
- Yarn (recommended), npm, or pnpm

### Install & Run

```bash
git clone https://github.com/rockbenben/subtitle-translator.git
cd subtitle-translator

yarn install
yarn dev
```

Visit [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
yarn build
```

## Documentation & Deployment

For detailed configuration, API setup, and self-hosting instructions, see the **[Official Documentation](https://docs.newzone.top/en/guide/translation/subtitle-translator/)**.

**Quick Deployment**: [Deploy Guide](https://docs.newzone.top/en/guide/translation/subtitle-translator/deploy.html)

## Contributing

Contributions are welcome! Feel free to open issues and pull requests.

1. Fork the repo and create a feature branch
2. Run `yarn` and `yarn dev` locally
3. Add tests / docs when applicable
4. Submit a PR with a clear description

## License

MIT © 2025 [rockbenben](https://github.com/rockbenben). See [LICENSE](./LICENSE).
