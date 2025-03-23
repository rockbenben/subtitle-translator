<h1 align="center">
⚡️Subtitle Translator
</h1>
<p align="center">
    <a href="./README.md">English</a> | 中文
</p>
<p align="center">
    <em>Translate subtitles effortlessly—fast, accurate, and multilingual!</em>
</p>

**Subtitle Translator** 是一款**免费、开源**的批量字幕翻译工具，支持 `.srt`、`.ass`、`.vtt` 等字幕格式，并具备**秒级翻译**能力。通过**多种翻译接口（API + AI 大模型）**，可将字幕文件**快速翻译成 35 种语言**，并支持**多语言同时翻译**，满足国际化需求。  

相较于传统字幕翻译工具，Subtitle Translator 具备**批量翻译、高速处理、翻译缓存、自动格式匹配**等优势，能大幅提升字幕翻译效率，适用于影视、教育、内容创作等多个场景。  

👉 **在线体验**：<https://tools.newzone.top/zh/subtitle-translator>

## 特色功能

!["批量翻译"](https://img.newzone.top/subtile-translator.gif?imageMogr2/format/webp "批量翻译")

- **秒级翻译**：利用字幕文本的分块压缩和并行处理技术，实现 1 秒翻译一集电视剧（GTX 接口稍慢）。  
- **批量翻译**：支持一次性处理上百份字幕文件，极大提升翻译效率。  
- **翻译缓存**：自动本地缓存翻译结果，避免重复调用，节省时间和 API 费用。  
- **格式兼容**：自动匹配主流字幕格式（.srt / .ass / .vtt），导出文件与原文件名一致，无需手动调整。
- **字幕提取**：支持提取字幕文本，方便后续用于 AI 总结、二次创作等应用场景。
- **多接口选择**：提供 3 种免费翻译方式、3 种商业级翻译 API，以及 5 种 AI LLM（大模型）接口，满足不同需求。  
- **多语言支持与国际化**：支持 35 种主流语言（英语、中文、日语、韩语、法语、德语、西班牙语等），还可将同一字幕文件同时翻译成多种语言，满足国际化需求。

Subtitle Translator 提供了丰富的参数选项，以适应不同用户的需求。以下是各项参数的详细说明：

## 翻译 API

Subtitle Translator 支持 5 种翻译 API 和 5 种 LLM（大语言模型）接口，用户可根据需求选择合适的翻译方式：  

### 翻译 API 对比

| API 类型 | 翻译质量 | 稳定性 | 适用场景 | 免费额度 |  
|----------|----------|----------|----------|----------|  
| **DeepL(X)** | ★★★★★ | ★★★★☆ | 适合长文本，翻译更流畅 | 每月 50 万字符 |  
| **Google Translate** | ★★★★☆ | ★★★★★ | 适合 UI 界面、常见句子 | 每月 50 万字符 |  
| **Azure Translate** | ★★★★☆ | ★★★★★ | 语言支持最广泛 | **前 12 个月** 每月 200 万字符 |  
| **GTX API（免费）** | ★★★☆☆ | ★★★☆☆ | 一般文本翻译 | 免费 |  
| **GTX Web（免费）** | ★★★☆☆ | ★★☆☆☆ | 适合小规模翻译 | 免费 |  

- **DeepL**：适用于长篇文本，翻译更加流畅自然，但不支持网页端 API，需本地或服务器代理调用。  
- **Google Translate**：翻译质量稳定，适用于短句、界面文本，支持网页端调用。  
- **Azure Translate**：支持语言最多，适合多语言翻译需求。  
- **GTX API/Web**：免费翻译选项，适合小规模使用，但稳定性一般。  

如果对翻译速度和质量有更高要求，可自行申请 API Key：[Google Translate](https://cloud.google.com/translate/docs/setup?hl=zh-cn)、[Azure Translate](https://learn.microsoft.com/zh-cn/azure/ai-services/translator/reference/v3-0-translate)、[DeepL Translate](https://www.deepl.com/your-account/keys)。申请流程参考相关的[接口申请教程](https://ttime.timerecord.cn/service/translate/google.html)。更多支持语言详见：  

- [DeepL 支持语言](https://developers.deepl.com/docs/v/zh/api-reference/languages)  
- [Google Translate 支持语言](https://cloud.google.com/translate/docs/languages?hl=zh-cn)  
- [Azure 支持语言](https://learn.microsoft.com/zh-cn/azure/ai-services/translator/language-support)  

### LLM 翻译（AI 大模型）

Subtitle Translator 还支持 5 种 AI LLM 模型进行翻译，包括 OpenAI、DeepSeek、Siliconflow、Groq 等。  

- **适用场景**：适合更复杂的语言理解需求，如文学作品、技术文档等。  
- **可定制性**：支持自定义系统提示词（System Prompt）和用户提示词（User Prompt），让翻译风格更加符合预期。  
- **温度控制（temperature）**：可以调整 AI 翻译的随机性，数值越高，翻译越有创意，但可能会降低稳定性。  

## 字幕格式

Subtitle Translator 支持 `.srt`、`.ass`、`.vtt` 等多种字幕格式，并提供自动格式匹配功能：  

- **双语字幕**：勾选后，翻译后的文本将插入原字幕下方，并可调整译文的显示位置（上/下）。  
- **时间轴兼容性**：支持省略默认小时、超过 100 小时的时间格式，以及 1~3 位毫秒显示，确保兼容性。  
- **自动编码识别**：无需手动选择编码格式，工具会自动识别字幕文件编码，避免乱码问题。  

## 翻译模式  

Subtitle Translator 支持批量翻译和单文件模式，适应不同使用需求：  

**批量翻译**（默认）：

- 支持同时处理上百个文件，大幅提升工作效率。  
- 翻译后的文件将自动保存在浏览器默认下载目录，无需手动操作。  

**单文件模式**（适用于小型任务）：

- 适用于单个字幕的快速翻译，支持直接粘贴文本翻译。  
- 翻译结果可在网页端实时查看，并手动复制或导出。  
- 若开启单文件模式，则**上传新文件会覆盖上一个文件**。  

## 翻译缓存

Subtitle Translator 采用可选的本地缓存机制，提高翻译效率：  

- **缓存规则**：每段翻译结果将以 `源文本_目标语言_源语言_翻译 API_模型设置` 作为唯一 key 进行存储。  
- **缓存命中条件**：只有完全匹配相同参数的情况下，才会使用本地缓存结果，确保准确性。  
- **缓存作用**：避免重复翻译，减少 API 调用次数，提高翻译速度。  

## 多语言翻译

Subtitle Translator 允许 **将同一个字幕文件翻译成多种语言**，适用于国际化场景：  

- 例如：将英文字幕同时翻译为中文、日语、德语、法语，方便全球用户使用。  
- 支持 35 种主流语言，并将持续扩展。  

## 使用注意

使用 Subtitle Translator 时，请注意以下几点：

- DeepL API 不支持在网页上使用，所以 Subtitle Translator 在服务器端提供了一个专门的 DeepL 翻译转发接口，该接口仅用于数据转发，不会收集任何用户数据。用户可以选择在本地环境中部署并使用这一接口。
- Subtitle Translator 不会储存你的 API Key，所有数据均缓存在本地浏览器中。
- GTX Web 接口对服务器压力过大，改为仅在本地运行。另外，避免在全局代理环境下使用 GTX Web 接口，以免出现翻译错误。
