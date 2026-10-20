import { NextRequest, NextResponse } from "next/server";

interface NvidiaRequest {
  apiKey?: string;
  messages: Array<{ role: string; content: string }>;
  model: string;
  temperature?: number;
  top_p?: number;
  chat_template_kwargs?: Record<string, unknown>;
}

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

/** The slice of the OpenAI-compatible success body this route actually touches. */
interface ChatCompletion {
  choices?: Array<{ message?: { content?: string } }>;
  [key: string]: unknown;
}

/**
 * Normalize an upstream error body into `{ error: { message, code } }`, but only
 * when the body carries no usable message of its own.
 *
 * NIM answers most failures with an RFC 7807 problem document —
 * `{"type","title","status","detail"}` — which has no `error` / `message` key at
 * all. Passed through verbatim, the browser client (formatHttpError in
 * services/shared.ts only reads `error.message` and a top-level `message`)
 * degrades to "HTTP error! status: 410" and the one actionable sentence — that
 * the model reached end of life — never reaches the user. Bodies that already
 * carry a message (OpenAI-style `{error:{message}}`, `{error:"…"}`, `{message}`)
 * are returned untouched.
 */
function normalizeUpstreamError(body: Record<string, unknown>, status: number): Record<string, unknown> {
  const nested = body.error as Record<string, unknown> | string | undefined;
  if (typeof nested === "string" && nested.trim()) return body;
  if (nested && typeof nested === "object" && typeof nested.message === "string" && nested.message.trim()) return body;
  if (typeof body.message === "string" && body.message.trim()) return body;

  const detail = typeof body.detail === "string" && body.detail.trim() ? body.detail : null;
  const title = typeof body.title === "string" && body.title.trim() ? body.title : null;
  const message = detail ?? title;
  // Nothing better to say than a verbatim passthrough — upstream gave us no text.
  if (!message) return body;
  return { ...body, error: { message, code: status } };
}

/**
 * Parse an upstream body, trusting it only when it is a JSON *object*.
 * Returns undefined on a parse failure (NIM serves a bare "404 page not found"
 * for a model id that isn't deployed) and also for JSON scalars — JSON.parse
 * happily turns `"404"` into the number 404, which is no more usable here.
 */
function parseJsonObject(raw: string): ChatCompletion | undefined {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as ChatCompletion;
  } catch {
    // fall through — the caller decides how to classify a non-JSON body
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  let parsed: unknown;
  try {
    parsed = await req.json();
  } catch {
    // Must not fall through to the generic 500 below — the browser client's
    // isRetryableError retries every 5xx three times, and a body that failed to
    // parse fails identically on each attempt.
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  // `null` is a legal JSON document and `Request.json()` hands it straight back,
  // so destructuring it below threw a TypeError the catch reported as 500 —
  // a request that can never succeed landed in the retryable band, and the
  // internal TypeError text went out to the caller. Numbers, strings and arrays
  // are equally unusable as a request body.
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }
  const body = parsed as NvidiaRequest;

  try {
    const { apiKey, messages, model, temperature, top_p, chat_template_kwargs } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Missing or invalid parameter: messages must be a non-empty array" }, { status: 400 });
    }
    if (typeof model !== "string" || !model) {
      return NextResponse.json({ error: "Missing or invalid parameter: model must be a non-empty string" }, { status: 400 });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey?.trim()) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    // Build request body with optional thinking parameters
    const requestBody: Record<string, unknown> = {
      messages,
      model,
    };

    if (temperature !== undefined) requestBody.temperature = temperature;
    if (top_p !== undefined) requestBody.top_p = top_p;
    if (chat_template_kwargs !== undefined) requestBody.chat_template_kwargs = chat_template_kwargs;

    // Forward the incoming request's abort signal: when the browser gives up
    // (per-request timeout in useTranslationState, or the user cancels), Next
    // aborts req.signal and this cancels the upstream NIM call too. Without it
    // the standalone/Docker server keeps a dangling connection to NVIDIA long
    // after nobody is waiting for the answer.
    const response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: req.signal,
    });

    // Get response as text first to handle non-JSON responses
    const responseText = await response.text();
    const data = parseJsonObject(responseText);

    if (!response.ok) {
      console.error("Nvidia API error (HTTP %d):", response.status, data ? JSON.stringify(data).substring(0, 500) : responseText.substring(0, 500));

      // Forward Retry-After on 429. The client's rateLimitGate is built to
      // honor it (parseRetryAfterMs in services/shared.ts → retry.ts trip()),
      // and NextResponse.json rebuilds the header set, so without this the gate
      // falls back to its own 1s→2s→…→60s guess instead of what upstream asked.
      const retryAfter = response.status === 429 ? response.headers.get("retry-after") : null;
      const headers: Record<string, string> | undefined = retryAfter ? { "Retry-After": retryAfter } : undefined;

      if (data) {
        return NextResponse.json(normalizeUpstreamError(data, response.status), { status: response.status, headers });
      }

      // A non-JSON upstream failure: NIM answers an undeployed model id with a
      // bare "404 page not found". That is a deterministic client fault — as
      // retryable 502 it made callers re-send a request that can never succeed,
      // and the old "Check your API key" wording pointed at the wrong knob when
      // the key was fine and only the model id was dead. Only genuinely
      // unattributable upstream failures stay 502.
      const isClientFault = response.status >= 400 && response.status < 500;
      return NextResponse.json(
        {
          error: {
            message: `Nvidia API returned a non-JSON error response (HTTP ${response.status}).`,
            code: response.status,
          },
          details: responseText.substring(0, 300),
        },
        { status: isClientFault ? response.status : 502, headers },
      );
    }

    // Success but not a JSON object — an edge/gateway error page, or a truncated
    // body. This is the one case that truly can't be attributed, so 502.
    if (!data) {
      console.error("Nvidia API returned non-JSON success response:", responseText.substring(0, 500));
      return NextResponse.json({ error: `Nvidia API returned an invalid response (HTTP ${response.status}).` }, { status: 502 });
    }

    // A 200 with no message content is a malformed upstream response — surface
    // it as a 502 (mirroring the non-JSON branch) instead of returning an empty
    // body the client would silently treat as a successful but blank translation.
    if (!data.choices?.[0]?.message?.content) {
      console.error("Nvidia API returned 200 with no message content:", JSON.stringify(data).substring(0, 500));
      return NextResponse.json({ error: "Nvidia API returned a response with no message content." }, { status: 502 });
    }

    // MiniMax models force-output `<think>...</think>` regardless of
    // reasoning toggle — strip across the whole family (M2, M2.7, M3, …)
    // rather than pinning to one version. Other providers only emit think
    // tags when the user explicitly enables thinking, so we leave their
    // output alone to respect intent.
    // model is guaranteed string after the validation gate above
    if (model.toLowerCase().includes("minimax")) {
      const choice = data.choices[0];
      const content = choice?.message?.content;
      if (choice?.message && content) {
        // Strip <think>...</think> tags and everything inside them.
        // Non-greedy regex matches correctly when multiple tags exist.
        choice.message.content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
        // 内容只剩 <think> 块时剥完为空 —— 正是上面 502 闸门要拦的"成功但空白
        // 翻译",必须复检(短输入下 MiniMax 偶发只回思考块)。
        if (!choice.message.content) {
          console.error("Nvidia API returned only a <think> block (empty after strip).");
          return NextResponse.json({ error: "Nvidia API returned a response with no message content." }, { status: 502 });
        }
      }
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    // Client walked away (cancel button / per-request timeout) — the abort we
    // forwarded above surfaces here. Nobody is reading the response, so log
    // nothing: users cancel routinely and this would flood a self-hoster's logs.
    if (req.signal.aborted) {
      return NextResponse.json({ error: "Request aborted by client" }, { status: 499 });
    }

    console.error("Nvidia proxy error:", error);

    let errorMessage = "An unknown error occurred";
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
