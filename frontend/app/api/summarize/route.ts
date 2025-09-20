import { NextRequest } from "next/server";
import { API_CONFIG, getApiUrl } from "../../config/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Forward auth headers if present
    const auth = req.headers.get("authorization") || "";
    const cookie = req.headers.get("cookie") || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth) headers["Authorization"] = auth;
    if (cookie) headers["Cookie"] = cookie;

    const upstream = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SUMMARIZE), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const contentType = upstream.headers.get("content-type") || "application/json";
    const text = await upstream.text();
    return new Response(text, { status: upstream.status, headers: { "Content-Type": contentType, "Cache-Control": "no-store" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Proxy error", detail: String(err) }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
}
