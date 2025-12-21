import { NextRequest, NextResponse } from "next/server";
import * as deepl from "deepl-node";

// 1. 定义请求体的接口，避免使用 any
interface TranslationRequest {
  text: string;
  source_lang?: string;
  target_lang: string;
  authKey: string;
}

const TARGET_LANG_MAPPING: Record<string, string> = {
  en: "en-US", // 默认英语使用美式英语
  pt: "pt-BR", // 默认葡萄牙语使用巴西葡萄牙语
};

// 默认重试 5 次，连接超时 60s
const options = { maxRetries: 5, minTimeout: 60000 };

export async function POST(req: NextRequest) {
  try {
    // 2. 安全地解析 JSON 并断言为我们定义的接口
    // 先转为 unknown 再转为接口是更安全的做法，或者直接断言
    const body = (await req.json()) as TranslationRequest;
    const { text, source_lang, target_lang: rawTargetLang, authKey } = body;

    // 验证请求参数
    if (!text || !rawTargetLang) {
      return NextResponse.json({ error: "Missing required parameters: text and target_lang are required" }, { status: 400 });
    }

    // 验证 API 密钥
    if (!authKey) {
      return NextResponse.json({ error: "Missing required parameter: authKey is required" }, { status: 400 });
    }

    // 目标语言：处理弃用的语言代码
    const target_lang = TARGET_LANG_MAPPING[rawTargetLang] || rawTargetLang;

    // 初始化 DeepL 翻译器
    const translator = new deepl.Translator(authKey, options);

    // 调用 DeepL API 进行翻译
    // 注意：这里可能需要根据 deepl-node 的类型定义进行简单的类型断言，或者保持 string
    const result = await translator.translateText(
      text,
      (source_lang as deepl.SourceLanguageCode) || null, // 如果未提供源语言，则为自动检测
      target_lang as deepl.TargetLanguageCode
    );

    // 返回翻译结果
    return NextResponse.json({
      translations: Array.isArray(result)
        ? result.map((item) => ({
            detected_source_language: item.detectedSourceLang,
            text: item.text,
          }))
        : [
            {
              detected_source_language: result.detectedSourceLang,
              text: result.text,
            },
          ],
    });
  } catch (error: unknown) {
    console.error("DeepL translation error:", error);

    // 3. 使用 instanceof 检查 DeepL 特定的错误
    if (error instanceof deepl.DeepLError && (error.message.includes("is deprecated") || error.message.includes("not supported"))) {
      const errorMsg = error.message;
      return NextResponse.json(
        {
          error: `DeepL API error: ${errorMsg}`,
          suggestion: "请更新您的语言代码。例如，使用'en-US'或'en-GB'代替'en'，使用'pt-BR'或'pt-PT'代替'pt'。",
        },
        { status: 400 }
      );
    }

    // 处理可能的其他 API 错误
    if (error instanceof deepl.DeepLError) {
      return NextResponse.json({ error: `DeepL API error: ${error.message}` }, { status: 500 });
    }

    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
