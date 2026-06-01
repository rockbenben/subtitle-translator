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

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NvidiaRequest;
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

    const response = await fetch(NVIDIA_API_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    // Get response as text first to handle non-JSON responses
    const responseText = await response.text();
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      // Response is not valid JSON (likely an HTML error page)
      console.error("Nvidia API returned non-JSON response:", responseText.substring(0, 500));
      return NextResponse.json(
        {
          error: `Nvidia API returned invalid response (HTTP ${response.status}). Check your API key.`,
          details: responseText.substring(0, 300),
        },
        { status: 502 },
      );
    }

    if (!response.ok) {
      console.error("Nvidia API error:", data);
      return NextResponse.json(data, { status: response.status });
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
      // Strip <think>...</think> tags and everything inside them.
      // Non-greedy regex matches correctly when multiple tags exist.
      data.choices[0].message.content = data.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
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
