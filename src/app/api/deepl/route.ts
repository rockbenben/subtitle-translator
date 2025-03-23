// 文件：/app/api/deepl/route.ts
import { NextRequest, NextResponse } from "next/server";
import * as deepl from "deepl-node";

const TARGET_LANG_MAPPING = {
  en: "en-US", // 默认英语使用美式英语
  pt: "pt-BR", // 默认葡萄牙语使用巴西葡萄牙语
};

export async function POST(req: NextRequest) {
  try {
    // 解析请求体
    const requestBody = await req.json();
    let { text, target_lang, source_lang, authKey } = requestBody;

    // 验证请求参数
    if (!text || !target_lang) {
      return NextResponse.json({ error: "Missing required parameters: text and target_lang are required" }, { status: 400 });
    }

    // 验证 API 密钥
    if (!authKey) {
      return NextResponse.json({ error: "Missing required parameter: authKey is required" }, { status: 400 });
    }

    // 目标语言：处理弃用的语言代码
    if (TARGET_LANG_MAPPING[target_lang]) {
      console.log(`Converting deprecated language code '${target_lang}' to '${TARGET_LANG_MAPPING[target_lang]}'`);
      target_lang = TARGET_LANG_MAPPING[target_lang];
    }

    // 初始化 DeepL 翻译器
    const translator = new deepl.Translator(authKey);

    // 调用 DeepL API 进行翻译
    const result = await translator.translateText(
      text,
      source_lang || null, // 如果未提供源语言，则为自动检测
      target_lang
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
  } catch (error) {
    console.error("DeepL translation error:", error);

    // 如果是语言代码问题，提供更明确的错误信息
    if (error instanceof deepl.DeepLError && (error.message.includes("is deprecated") || error.message.includes("not supported"))) {
      // 提取错误消息
      const errorMsg = error.message;

      // 返回详细的错误信息和建议
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

    // 处理其他错误
    return NextResponse.json({ error: error.message || "An unknown error occurred" }, { status: 500 });
  }
}
