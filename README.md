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

**Subtitle Translator** is a batch subtitle translation tool supporting `.srt`, `.ass`, `.vtt`, and `.lrc` formats. With **real-time translation speeds**, it leverages multiple **translation APIs and AI models** to quickly translate subtitle files into **50+ languages**, including the ability to **translate a single file into multiple languages at once** for global accessibility.

👉 **Try it online**: <https://tools.newzone.top/en/subtitle-translator>

## Key Features

![Batch Translation Demo](https://img.newzone.top/subtile-translator.gif?imageMogr2/format/webp)

- **Real-time Translation**: Uses **chunked compression** and **parallel processing** to achieve **1-second translation per episode**.
- **Batch Processing**: Handles **hundreds of subtitle files at once**, significantly boosting efficiency.
- **High-Performance Caching (IndexedDB)**: Stores translation results in **IndexedDB** with **unlimited capacity**—no more browser storage limits.
- **Context-Aware Translation** (AI models only): Translates with surrounding context for more coherent dialogue.
- **Format Compatibility**: **Automatically detects** `.srt`, `.ass`, `.vtt`, and `.lrc` formats, preserving original file names.
- **Bilingual Output**: Insert translations below original text with adjustable positioning.
- **Subtitle Extraction**: Export clean text for AI summarization, content repurposing, and more.
- **Multi-language Support**: Translate into **50+ languages** simultaneously from a single file.

## Translation APIs

Subtitle Translator supports **5 translation APIs** and **9 AI LLM models**:

### Traditional APIs

| API                  | Quality | Stability | Free Tier                        |
| -------------------- | ------- | --------- | -------------------------------- |
| **DeepL (X)**        | ★★★★★   | ★★★★☆     | 500K chars/month                 |
| **Google Translate** | ★★★★☆   | ★★★★★     | 500K chars/month                 |
| **Azure Translate**  | ★★★★☆   | ★★★★★     | 2M chars/month (first 12 months) |
| **GTX API (Free)**   | ★★★☆☆   | ★★★☆☆     | Free (rate-limited)              |
| **GTX Web (Free)**   | ★★★☆☆   | ★★☆☆☆     | Free                             |

### LLM Models

Supports **DeepSeek**, **OpenAI**, **Gemini**, **Azure OpenAI**, **Siliconflow**, **Groq**, **OpenRouter**, **Perplexity**, and **Custom LLM**.

- **Best for**: Literary works, technical documents, and multilingual dialogue.
- **Customization**: Configure **system prompts** and **user prompts** for personalized translation styles.
- **Temperature Control**: Adjust AI creativity (0–1 scale).

## Context-Aware Translation

_Context-Aware Translation_ (AI models only) sends subtitles to the LLM in batches with preceding and succeeding context, ensuring more coherent character dialogue and natural tone.

Two key parameters control this process:

- **Concurrent Lines**: Maximum lines translated simultaneously (default: 20). Too high may trigger rate limits.
- **Context Lines**: Lines included per batch for context (default: 50). Higher values improve coherence but may exceed token limits.

⚠️ **Tip**: Models under 70B parameters may produce misaligned output. Mainstream online large models are recommended.

## Subtitle Format Support

- **Bilingual Subtitles**: Translated text inserted below original; position adjustable (top/bottom).
- **Timeline Compatibility**: Supports 100+ hour timestamps and 1–3 digit millisecond formats.
- **Automatic Encoding Detection**: Prevents character encoding issues automatically.

## Translation Modes

- **Batch Mode (Default)**: Process hundreds of files simultaneously; results auto-download.
- **Single-File Mode**: Quick translation with instant preview; each upload replaces the previous.

## Documentation & Deployment

For detailed configuration, API setup, and self-hosting instructions, see the **[Official Documentation](https://docs.newzone.top/en/guide/translation/subtitle-translator/)**.

**Quick Deployment**: [Deploy Guide](https://docs.newzone.top/en/guide/translation/subtitle-translator/deploy.html)

## Contributing

Contributions are welcome! Feel free to open issues and pull requests.

## License

MIT © 2025 [rockbenben](https://github.com/rockbenben). See [LICENSE](./LICENSE).
