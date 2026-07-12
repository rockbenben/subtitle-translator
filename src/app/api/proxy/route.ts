import { NextRequest, NextResponse } from "next/server";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "x-proxy-pass",
]);

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const applyCorsHeaders = (headers: Headers): Headers => {
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-headers", "*");
  headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,HEAD,OPTIONS");
  return headers;
};

const jsonError = (message: string, status: number): NextResponse => {
  const response = NextResponse.json({ error: message }, { status });
  applyCorsHeaders(response.headers);
  return response;
};

const buildProxyUrl = (req: NextRequest, target: string): URL => {
  const proxyUrl = new URL(target);

  req.nextUrl.searchParams.forEach((value, key) => {
    if (key !== "x-proxy-pass") {
      proxyUrl.searchParams.append(key, value);
    }
  });

  return proxyUrl;
};

const buildProxyHeaders = (headers: Headers, targetHost: string): Headers => {
  const proxyHeaders = new Headers();

  headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      proxyHeaders.set(key, value);
    }
  });

  proxyHeaders.set("host", targetHost);
  return proxyHeaders;
};

const buildResponseHeaders = (headers: Headers): Headers => {
  const responseHeaders = new Headers();

  headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      responseHeaders.set(key, value);
    }
  });

  return applyCorsHeaders(responseHeaders);
};

async function handleProxy(req: NextRequest) {
  const target = req.headers.get("x-proxy-pass")?.trim() || req.nextUrl.searchParams.get("x-proxy-pass")?.trim();

  if (!target) {
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: applyCorsHeaders(new Headers()) });
    }
    return jsonError("Missing target URL. Provide x-proxy-pass header or query parameter.", 400);
  }

  let proxyUrl: URL;
  try {
    proxyUrl = buildProxyUrl(req, target);
  } catch {
    return jsonError("Invalid target URL.", 400);
  }

  const init: RequestInit & { duplex?: "half" } = {
    method: req.method,
    headers: buildProxyHeaders(req.headers, proxyUrl.host),
    redirect: "follow",
  };

  if (METHODS_WITH_BODY.has(req.method)) {
    init.body = req.body;
    init.duplex = "half";
  }

  try {
    const upstream = await fetch(proxyUrl, init);
    return new NextResponse(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: buildResponseHeaders(upstream.headers),
    });
  } catch (error: unknown) {
    console.error("Proxy request error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonError(`Proxy request failed: ${message}`, 502);
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const HEAD = handleProxy;
export const OPTIONS = handleProxy;
