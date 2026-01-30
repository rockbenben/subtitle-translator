import { NextRequest, NextResponse } from "next/server";

interface NvidiaRequest {
  url: string;
  apiKey?: string;
  messages: Array<{ role: string; content: string }>;
  model: string;
  temperature?: number;
  top_p?: number;
  chat_template_kwargs?: Record<string, unknown>;
  reasoning_effort?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as NvidiaRequest;
    const { url, apiKey, messages, model, temperature, top_p, chat_template_kwargs, reasoning_effort } = body;

    if (!url) {
      return NextResponse.json({ error: "Missing required parameter: url" }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Missing required parameter: messages" }, { status: 400 });
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
    if (reasoning_effort !== undefined) requestBody.reasoning_effort = reasoning_effort;

    console.log("Nvidia proxy request:", { url, model, hasApiKey: !!apiKey?.trim() });

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    // Get response as text first to handle non-JSON responses
    const responseText = await response.text();
    console.log("Nvidia API response status:", response.status, "length:", responseText.length);

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      // Response is not valid JSON (likely an HTML error page)
      console.error("Nvidia API returned non-JSON response:", responseText.substring(0, 500));
      return NextResponse.json(
        {
          error: `Nvidia API returned invalid response (HTTP ${response.status}). Check your API URL and key.`,
          details: responseText.substring(0, 300),
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      console.error("Nvidia API error:", data);
      return NextResponse.json(data, { status: response.status });
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
