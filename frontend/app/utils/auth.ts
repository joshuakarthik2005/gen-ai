"use client";

import { getApiUrl } from "../config/api";

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds
};

const STORAGE_KEY = "auth_token_v1";
const USER_TOKEN_KEY = "token"; // AuthContext stores JWT here

type StoredToken = {
  token: string;
  expiresAt: number; // epoch ms
};

const getStored = (): StoredToken | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed.token || !parsed.expiresAt) return null;
    return parsed;
  } catch {
    return null;
  }
};

const setStored = (t: StoredToken) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    // ignore
  }
};

async function loginAndGetToken(): Promise<string> {
  const email = process.env.NEXT_PUBLIC_DEMO_EMAIL || "demo@example.com";
  const password = process.env.NEXT_PUBLIC_DEMO_PASSWORD || "demo123";

  const resp = await fetch(getApiUrl("/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`Login failed (${resp.status}): ${txt}`);
  }
  const data = (await resp.json()) as TokenResponse;
  const expiresAt = Date.now() + (data.expires_in || 3600) * 1000 - 30_000; // refresh 30s early
  setStored({ token: data.access_token, expiresAt });
  return data.access_token;
}

export async function getAuthToken(): Promise<string> {
  // Prefer real user token if available
  try {
    const userToken = localStorage.getItem(USER_TOKEN_KEY);
    if (userToken) return userToken;
  } catch { /* ignore */ }

  const stored = getStored();
  if (stored && stored.expiresAt > Date.now()) return stored.token;
  return loginAndGetToken();
}

export async function withAuthHeaders(extra: HeadersInit = {}): Promise<HeadersInit> {
  const token = await getAuthToken();
  return {
    ...(typeof extra === "object" ? extra : {}),
    Authorization: `Bearer ${token}`,
  };
}
