<h1 align="center">
⚡️ Subtitle Translator Server
</h1>

<p align="center">
  <em>面向后端与自动化场景的字幕翻译 API 服务</em>
</p>

`apps/server` 是 Subtitle Translator 的独立后端 API 服务。它复用 `@subtitle-translator/translation-core` 中的纯类型、服务注册表、术语表、字幕解析、缓存键、重试策略等通用逻辑，并在服务端实现真实翻译请求、批量编排、内存缓存和 HTTP API。

与浏览器端工具不同，Server 版本面向自动化、内网服务、批处理任务和后续 CLI 集成。现有前端代码不依赖此服务，二者可以独立运行。

## 核心特性

- **独立 API 服务**：基于 Fastify，提供文本翻译、批量翻译、字幕解析和字幕翻译接口。
- **复用核心逻辑**：语言、Provider 注册表、默认配置、术语表、字幕格式解析等来自 `translation-core`。
- **服务端缓存**：内置内存 LRU + TTL 缓存，减少重复翻译请求。
- **多 Provider 支持**：沿用当前项目的传统翻译 API 与 LLM Provider 配置模型。
- **字幕结构保护**：只翻译字幕正文，时间轴、序号和结构按格式回写。
- **适合自动化**：可被脚本、CI、内部工具或未来 CLI 调用。

## 快速开始

### 环境要求

- Node.js >= 20.9.0
- Yarn via Corepack

### 安装与启动

在仓库根目录执行：

```bash
corepack yarn install
corepack yarn server:dev
```

默认地址：

```text
http://127.0.0.1:8787
```

自定义监听地址：

```bash
PORT=9000 HOST=127.0.0.1 corepack yarn server:dev
```

### 生产构建

```bash
corepack yarn server:build
corepack yarn workspace @subtitle-translator/server start
```

## API 总览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/v1/languages` | 获取支持语言列表 |
| `GET` | `/api/v1/providers` | 获取翻译服务、默认配置和模型列表 |
| `POST` | `/api/v1/translate` | 翻译单段文本 |
| `POST` | `/api/v1/translate/batch` | 批量翻译多行文本 |
| `POST` | `/api/v1/translate/probe` | 测试翻译服务连通性 |
| `POST` | `/api/v1/subtitle/parse` | 解析字幕文本为 cue 列表 |
| `POST` | `/api/v1/subtitle/translate` | 翻译字幕文本并回写原格式 |

所有请求默认使用 JSON：

```http
Content-Type: application/json
```

错误响应格式：

```json
{
  "error": {
    "message": "[401] Invalid API key",
    "status": 401
  }
}
```

`status` 可能不存在，例如网络错误或本地校验错误。

## 翻译配置

`config` 与当前前端 Provider 配置保持一致。不同服务需要的字段不同，可通过 `GET /api/v1/providers` 查看默认值。

常见字段：

```json
{
  "apiKey": "sk-xxx",
  "url": "https://api.openai.com/v1/chat/completions",
  "model": "gpt-5.4-mini",
  "temperature": 0.7,
  "region": "eastasia",
  "apiVersion": "2025-11-18",
  "folderId": "...",
  "batchSize": 20,
  "chunkSize": 5000,
  "systemPrompt": "You are a professional translator...",
  "userPrompt": "Please translate ${content} into ${targetLanguage}",
  "useRelay": false,
  "useProxy": false,
  "sendSystemPrompt": true,
  "domains": "movie subtitles"
}
```

术语表示例：

```json
{
  "source": "AI",
  "target": "人工智能",
  "targetLang": "zh"
}
```

## API 示例

### 获取语言列表

```bash
curl http://127.0.0.1:8787/api/v1/languages
```

响应：

```json
{
  "languages": [
    { "value": "en", "name": "English" },
    { "value": "zh", "name": "Chinese (Simplified)" }
  ]
}
```

### 获取 Provider 列表

```bash
curl http://127.0.0.1:8787/api/v1/providers
```

响应结构：

```json
{
  "providers": [
    {
      "value": "openai",
      "label": "OpenAI",
      "defaultConfig": {
        "apiKey": "",
        "model": "gpt-5.4-mini",
        "temperature": 1,
        "batchSize": 20
      },
      "models": [
        { "label": "GPT-5.5", "value": "gpt-5.5" }
      ]
    }
  ]
}
```

### 翻译单段文本

```bash
curl -X POST http://127.0.0.1:8787/api/v1/translate \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Hello, world!",
    "translationMethod": "gtxFreeAPI",
    "sourceLanguage": "en",
    "targetLanguage": "zh",
    "config": {}
  }'
```

响应：

```json
{
  "translatedText": "你好，世界！"
}
```

使用 LLM Provider：

```bash
curl -X POST http://127.0.0.1:8787/api/v1/translate \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Hello, world!",
    "translationMethod": "openai",
    "sourceLanguage": "en",
    "targetLanguage": "zh",
    "config": {
      "apiKey": "sk-xxx",
      "model": "gpt-5.4-mini",
      "temperature": 0.7
    }
  }'
```

### 批量翻译

`/api/v1/translate/batch` 接收 `texts` 数组，响应顺序与输入顺序一致。失败的行会回填原文，并写入 `stats.errors`。

```bash
curl -X POST http://127.0.0.1:8787/api/v1/translate/batch \
  -H 'Content-Type: application/json' \
  -d '{
    "texts": ["Hello.", "How are you?"],
    "translationMethod": "gtxFreeAPI",
    "sourceLanguage": "en",
    "targetLanguage": "zh",
    "config": { "batchSize": 10 },
    "documentType": "subtitle",
    "glossaryTerms": [
      { "source": "AI", "target": "人工智能", "targetLang": "zh" }
    ]
  }'
```

响应：

```json
{
  "translations": ["你好。", "你好吗？"],
  "stats": {
    "total": 2,
    "cached": 0,
    "translated": 2,
    "failed": 0,
    "errors": [],
    "timeMs": 1200
  }
}
```

### 测试连通性

`/api/v1/translate/probe` 会执行一次真实翻译请求：`Hello, world!` → 中文。

```bash
curl -X POST http://127.0.0.1:8787/api/v1/translate/probe \
  -H 'Content-Type: application/json' \
  -d '{
    "translationMethod": "openai",
    "apiKey": "sk-xxx",
    "model": "gpt-5.4-mini"
  }'
```

成功响应：

```json
{
  "ok": true,
  "result": "你好，世界！"
}
```

### 解析字幕

当前接口使用 JSON `content` 输入，`format` 可省略并自动检测。支持 `srt`、`vtt`、`ass`、`ssa`、`lrc`、`sbv`。

```bash
curl -X POST http://127.0.0.1:8787/api/v1/subtitle/parse \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "1\n00:00:01,000 --> 00:00:03,000\nHello\n",
    "format": "srt"
  }'
```

响应：

```json
{
  "format": "srt",
  "cues": [
    {
      "index": 1,
      "startMs": 1000,
      "endMs": 3000,
      "text": "Hello"
    }
  ]
}
```

### 翻译字幕

```bash
curl -X POST http://127.0.0.1:8787/api/v1/subtitle/translate \
  -H 'Content-Type: application/json' \
  -d '{
    "content": "1\n00:00:01,000 --> 00:00:03,000\nHello\n",
    "format": "srt",
    "translationMethod": "gtxFreeAPI",
    "sourceLanguage": "en",
    "targetLanguage": "zh",
    "config": { "batchSize": 10 }
  }'
```

响应：

```json
{
  "content": "1\n00:00:01,000 --> 00:00:03,000\n你好\n",
  "format": "srt",
  "stats": {
    "total": 1,
    "cached": 0,
    "translated": 1,
    "failed": 0,
    "errors": [],
    "timeMs": 900
  }
}
```

## Provider 配置示例

### OpenAI

```json
{
  "translationMethod": "openai",
  "config": {
    "apiKey": "sk-xxx",
    "model": "gpt-5.4-mini",
    "temperature": 0.7
  }
}
```

### DeepL

```json
{
  "translationMethod": "deepl",
  "config": {
    "apiKey": "your-deepl-key"
  }
}
```

### Azure Translate

```json
{
  "translationMethod": "azure",
  "config": {
    "apiKey": "your-azure-key",
    "region": "eastasia"
  }
}
```

### 自定义 OpenAI-compatible 服务

```json
{
  "translationMethod": "llm",
  "config": {
    "url": "http://127.0.0.1:1234/v1/chat/completions",
    "apiKey": "",
    "model": "",
    "temperature": 0.7,
    "sendSystemPrompt": true,
    "maxTokens": 0
  }
}
```

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `8787` | HTTP 监听端口 |
| `HOST` | `0.0.0.0` | HTTP 监听地址 |
| `TRANSLATION_CACHE_MAX_SIZE` | `10000` | 内存缓存最大条目数 |
| `TRANSLATION_CACHE_TTL_MS` | `86400000` | 内存缓存 TTL，默认 24 小时 |

## 技术栈

- **Server**：[Fastify](https://fastify.dev/)
- **Shared Core**：`@subtitle-translator/translation-core`
- **Cache**：进程内 MemoryCache（LRU + TTL）
- **Runtime**：Node.js >= 20.9.0

## 目前限制

- 字幕 API 当前使用 JSON `content` 输入，multipart 文件上传后续再补。
- 批量翻译当前返回完整 JSON，不提供 SSE 进度流。
- Server 与现有 Web 前端独立运行；前端仍使用原有浏览器端翻译实现。
