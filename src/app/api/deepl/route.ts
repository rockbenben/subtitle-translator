import { NextRequest, NextResponse } from "next/server";
import * as deepl from "deepl-node";

interface TranslationRequest {
  text: string;
  source_lang?: string;
  target_lang: string;
  authKey: string;
  tag_handling?: "html" | "xml";
}

// DeepL 弃用了无地区的 en/pt,默认补成 en-US / pt-BR 兼容老客户端。
const TARGET_LANG_MAPPING: Record<string, string> = {
  en: "en-US",
  pt: "pt-BR",
};

// 默认重试 5 次,连接超时 60s。
const options = { maxRetries: 5, minTimeout: 60000 };

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TranslationRequest;
    const { text, source_lang, target_lang: rawTargetLang, authKey, tag_handling } = body;

    if (typeof text !== "string" || !text || typeof rawTargetLang !== "string" || !rawTargetLang) {
      return NextResponse.json({ error: "Missing or invalid parameters: text and target_lang must be non-empty strings" }, { status: 400 });
    }
    if (typeof authKey !== "string" || !authKey) {
      return NextResponse.json({ error: "Missing or invalid parameter: authKey must be a non-empty string" }, { status: 400 });
    }

    const target_lang = TARGET_LANG_MAPPING[rawTargetLang] || rawTargetLang;
    const translator = new deepl.Translator(authKey, options);

    const result = await translator.translateText(
      text,
      (source_lang as deepl.SourceLanguageCode) || null, // null = auto-detect
      target_lang as deepl.TargetLanguageCode,
      tag_handling ? { tagHandling: tag_handling } : undefined,
    );

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

    // The deepl-node SDK signals fault class via the thrown error type rather
    // than an HTTP status field (see translator.ts#checkStatusCode). Map each
    // class to the status DeepL itself returned so the browser client's
    // isRetryableError treats client-class faults (auth/quota/bad-request) as
    // fast-fail instead of retrying them 3× as if they were 5xx.
    if (error instanceof deepl.DeepLError) {
      // Unsupported / deprecated language code — actionable client error.
      if (error.message.includes("is deprecated") || error.message.includes("not supported")) {
        return NextResponse.json(
          {
            error: `DeepL API error: ${error.message}`,
            suggestion: "Please update your language code — e.g. use 'en-US'/'en-GB' instead of 'en', or 'pt-BR'/'pt-PT' instead of 'pt'. / 请更新您的语言代码。例如，使用'en-US'或'en-GB'代替'en'，使用'pt-BR'或'pt-PT'代替'pt'。",
          },
          { status: 400 },
        );
      }

      let status = 500;
      if (error instanceof deepl.AuthorizationError) {
        status = 403; // invalid auth key
      } else if (error instanceof deepl.QuotaExceededError) {
        status = 456; // billing quota exhausted
      } else if (error instanceof deepl.TooManyRequestsError) {
        status = 429; // rate limited
      } else if (error instanceof deepl.ArgumentError) {
        status = 400; // bad client input
      } else if (error instanceof deepl.ConnectionError) {
        status = 502; // upstream/network failure reaching DeepL
      } else if (error.message.includes("Bad request") || error.message.includes("Not found")) {
        // Plain DeepLError text from 400/404 — still client-class.
        status = error.message.includes("Not found") ? 404 : 400;
      }
      // else: service-unavailable / unexpected status → genuine 5xx → 500

      return NextResponse.json({ error: `DeepL API error: ${error.message}` }, { status });
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
