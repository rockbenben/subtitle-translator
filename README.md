<h1 align="center">
⚡️Subtitle Translator
</h1>
<p align="center">
    English | <a href="./README-zh.md">中文</a>
</p>
<p align="center">
    <em>Translate subtitles effortlessly—fast, accurate, and multilingual!</em>
</p>

**Subtitle Translator** is a **free and open-source** batch subtitle translation tool that supports `.srt`, `.ass`, and `.vtt` formats. With **real-time translation speeds**, it leverages multiple **translation APIs and AI models** to quickly translate subtitle files into **35 languages**, including the ability to **translate a single subtitle file into multiple languages at once** for global accessibility.  

Compared to traditional subtitle translation tools, Subtitle Translator excels with its **batch processing, high-speed translation, translation caching, and automatic format adaptation**, significantly improving workflow efficiency. It is ideal for use in film and TV, education, and content creation.  

👉 **Try it online**: <https://tools.newzone.top/en/subtitle-translator>  

## Key Features

!["Batch Translation"](https://img.newzone.top/subtile-translator.gif?imageMogr2/format/webp "Batch Translation")  

- **Real-time translation**: Uses **chunked compression** and **parallel processing** to achieve **1-second translation per episode** (GTX interface is slightly slower).  
- **Batch processing**: Handles **hundreds of subtitle files at once**, significantly boosting efficiency.  
- **Translation caching**: Automatically **stores translation results locally**, avoiding redundant API calls and saving both time and costs.  
- **Format compatibility**: **Automatically detects and adapts** to `.srt`, `.ass`, and `.vtt` subtitle formats, preserving the original file name.  
- **Subtitle extraction**: Allows **easy text extraction** for use in AI summarization, content repurposing, and more.  
- **Multiple translation options**: Supports **3 free translation APIs, 3 commercial-grade APIs, and 5 AI LLM (large language model) interfaces**, catering to different needs.  
- **Multi-language support & internationalization**: Translates subtitles into **35 major languages**, including English, Chinese, Japanese, Korean, French, German, and Spanish. It also supports **multi-language translations from a single file**, generating **bilingual or multilingual subtitles**.  

Subtitle Translator offers a range of customizable parameters to meet diverse user needs. Below is a detailed explanation of its features.  

## Translation APIs  

Subtitle Translator supports **5 translation APIs** and **5 AI LLM models**, allowing users to choose the best option for their needs.  

### API Comparison

| API | Translation Quality | Stability | Best Use Case | Free Tier |  
|-|-|-|-|-|  
| **DeepL (X)** | ★★★★★ | ★★★★☆ | Best for long texts, fluent translations | 500,000 characters/month |  
| **Google Translate** | ★★★★☆ | ★★★★★ | Best for UI text and common phrases | 500,000 characters/month |  
| **Azure Translate** | ★★★★☆ | ★★★★★ | Best for multi-language support | **2 million characters/month** (first 12 months) |  
| **GTX API (Free)** | ★★★☆☆ | ★★★☆☆ | General translation tasks | Free |  
| **GTX Web (Free)** | ★★★☆☆ | ★★☆☆☆ | Small-scale translations | Free |  

- **DeepL**: Ideal for long-form content, offering **more fluent** translations, but requires local or server proxy usage.  
- **Google Translate**: **Stable and widely used**, best for **short sentences and UI text**.  
- **Azure Translate**: **Supports the most languages**, making it the best option for **multi-language translations**.  
- **GTX API/Web**: Free translation options, suitable for **light usage** but with **limited stability**.  

🔹 **API Key Registration**: [Google Translate](https://cloud.google.com/translate/docs/setup?hl=zh-cn), [Azure Translate](https://learn.microsoft.com/zh-cn/azure/ai-services/translator/reference/v3-0-translate), [DeepL Translate](https://www.deepl.com/your-account/keys)  

🔹 **Supported Languages**: [DeepL](https://developers.deepl.com/docs/v/zh/api-reference/languages), [Google Translate](https://cloud.google.com/translate/docs/languages?hl=zh-cn), [Azure](https://learn.microsoft.com/zh-cn/azure/ai-services/translator/language-support)  

### LLM Translation (AI Models)  

Subtitle Translator also supports **5 AI LLM models**, including **OpenAI, DeepSeek, Siliconflow, and Groq**.  

- **Best for**: **Literary works, technical documents, and multilingual dialogue**.  
- **Customization**: Supports **system prompts and user prompts**, allowing personalized translation styles.  
- **Temperature control**: Adjusts **AI translation creativity**, where **higher values produce more diverse translations** but may reduce consistency.  

## Subtitle Format Support

Subtitle Translator supports **`.srt`, `.ass`, and `.vtt` formats** with **automatic format detection and adaptation**:  

- **Bilingual subtitles**: Translated text **can be inserted below the original** and its position can be adjusted.  
- **Timeline compatibility**: Supports **over 100-hour timestamps**, along with **1-3 digit millisecond formats** to ensure seamless synchronization.  
- **Automatic encoding detection**: Prevents **character encoding issues** by detecting and adjusting encoding settings automatically.  

## Translation Modes  

Subtitle Translator offers **batch translation** and **single-file translation**, adapting to different workflows:  

✅ **Batch Translation (Default Mode)**  

- **Processes hundreds of files simultaneously**, maximizing efficiency.  
- **Translated files are automatically saved** in the browser’s default download folder.  

✅ **Single-File Mode** (For quick tasks)  

- **Allows direct text input and translation**.  
- **Results are displayed instantly**, with the option to **copy or export**.  
- Uploading a new file **will replace the previous file**.  

## Translation Caching

Subtitle Translator **employs local caching** to optimize efficiency:  

- **Caching rules**: Translation results are stored using a unique key format:  
  `original_text_target_language_source_language_API_model_settings`  
- **Efficiency boost**: **Avoids redundant translations, reducing API calls and speeding up workflows**.  

## Multi-Language Translation  

Subtitle Translator allows **translating the same subtitle file into multiple languages at once**, ideal for internationalization.  

For example:  

- Translate an **English subtitle** into **Chinese, Japanese, German, and French** simultaneously for global accessibility.  
- Supports **35 major languages**, with more to be added based on user feedback.  

## Usage Notes  

When using Subtitle Translator, keep in mind:  

- **DeepL API does not support web-based usage**. Instead, Subtitle Translator **provides a dedicated server-side proxy** for DeepL translations, ensuring security and efficiency. Users can also **deploy the proxy locally**.  
- **Subtitle Translator does not store API keys**—all data remains **locally cached in your browser** for privacy.  
- **GTX Web API runs locally** to prevent server overload. Avoid using GTX Web in **global proxy mode** to prevent translation errors.  

## Future Updates

🚀 **Upcoming Features**:  
✅ **Standalone desktop version**  
✅ **AI-powered translation refinement**  

Subtitle Translator will continue to evolve based on user feedback. If you find this tool helpful, feel free to contribute or suggest improvements! 🚀

## Deployment  

Subtitle Translator can be deployed on Cloudflare, Vercel, or any server.

System Requirements:

- [Node.js 18.18](https://nodejs.org/) or later.
- macOS, Windows (including WSL), and Linux are supported.

```shell
# Installation
yarn

# Local Development
yarn dev

# build and start
yarn build && yarn start

# Deploy for a single language
yarn build:lang en
yarn build:lang zh
yarn build:lang zh-hant
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `src/app/[locale]/page.tsx`. The page auto-updates as you edit the file.
