import { NextRequest } from "next/server";
import { API_CONFIG } from "../../config/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  const bearer = req.nextUrl.searchParams.get("bearer");
  if (!urlParam) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let target: URL | null = null;
  try {
    // First try absolute URL
    target = new URL(urlParam);
  } catch {
    // Handle relative or known proxy paths
    try {
      if (urlParam.startsWith("/api/proxy-gcs/")) {
        const rest = urlParam.replace(/^\/api\/proxy-gcs\//, "");
        target = new URL(`/proxy-gcs/${rest}`, API_CONFIG.BASE_URL);
      } else if (urlParam.startsWith("/proxy-gcs/")) {
        target = new URL(urlParam, API_CONFIG.BASE_URL);
      } else if (urlParam.startsWith("/")) {
        // Same-origin relative path
        target = new URL(urlParam, req.nextUrl.origin);
      }
    } catch {
      // fallthrough
    }
  }
  if (!target) {
    return new Response("Invalid url", { status: 400 });
  }
  if (!/^https?:$/i.test(target.protocol)) {
    return new Response("Only http/https URLs are allowed", { status: 400 });
  }

  try {
    // Check if this is a request to our backend proxy endpoint
    const backendHost = (() => {
      try { return new URL(API_CONFIG.BASE_URL).host; } catch { return null; }
    })();
    const isBackendProxyUrl = (
      (backendHost && target.host === backendHost && target.pathname.startsWith('/proxy-gcs')) ||
      target.pathname.startsWith('/api/proxy-gcs') ||
      target.pathname.startsWith('/proxy-gcs')
    );
    
    const headers: Record<string, string> = {
      "User-Agent": req.headers.get("user-agent") || "Mozilla/5.0"
    };
    
    // If a bearer token was explicitly provided, use it
    if (bearer) {
      headers["Authorization"] = `Bearer ${bearer}`;
    }
    
    // If this is our backend proxy, pass through authentication headers
    if (isBackendProxyUrl) {
      const authHeader = req.headers.get("authorization");
      if (!headers["Authorization"] && authHeader) {
        headers["Authorization"] = authHeader;
      }
      // Also check for cookie-based auth
      const cookie = req.headers.get("cookie");
      if (cookie) {
        headers["Cookie"] = cookie;
      }
    }
    
    const upstream = await fetch(target.toString(), {
      headers,
      // Disable Next caching for dynamic proxies
      cache: "no-store",
    });

    if (!upstream.ok) {
      console.error(`[proxy-pdf] Upstream error: ${upstream.status} for ${target.toString()}`);
      return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") || "application/pdf";
    const data = await upstream.arrayBuffer();
    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Ensure same-origin access by the browser; CORS not needed since same origin
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error('[proxy-pdf] Fetch error:', err);
    return new Response(`Failed to fetch target URL: ${err instanceof Error ? err.message : 'Unknown error'}`, { status: 502 });
  }
}
