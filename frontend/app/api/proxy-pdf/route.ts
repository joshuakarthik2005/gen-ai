import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("url");
  if (!urlParam) {
    return new Response("Missing url parameter", { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(urlParam);
    if (!/^https?:$/i.test(target.protocol)) {
      return new Response("Only http/https URLs are allowed", { status: 400 });
    }
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  try {
    // Check if this is a request to our own backend proxy endpoint
    const isBackendProxyUrl = target.pathname.startsWith('/api/proxy-gcs') || 
                             target.pathname.startsWith('/proxy-gcs');
    
    const headers: Record<string, string> = {
      "User-Agent": req.headers.get("user-agent") || "Mozilla/5.0"
    };
    
    // If this is our backend proxy, pass through authentication headers
    if (isBackendProxyUrl) {
      const authHeader = req.headers.get("authorization");
      if (authHeader) {
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
    return new Response("Failed to fetch target URL", { status: 502 });
  }
}
