import { NextRequest } from "next/server";
import { API_CONFIG, getApiUrl } from "../../../config/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const upstream = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SUMMARIZE_UPLOAD), {
      method: "POST",
      body: formData,
      cache: "no-store",
    });

    const contentType = upstream.headers.get("content-type") || "application/json";
    const arrayBuffer = await upstream.arrayBuffer();
    return new Response(arrayBuffer, {
      status: upstream.status,
      headers: { "Content-Type": contentType, "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: "Proxy error", detail: String(err) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
