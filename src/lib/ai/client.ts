import OpenAI from "openai";
import { env } from "@/lib/env";

/**
 * OpenRouter is OpenAI-API compatible. The OpenAI SDK works as-is by overriding
 * baseURL + apiKey. App attribution headers (HTTP-Referer, X-Title) are
 * recommended by OpenRouter for leaderboards and quota grouping.
 */
export const openrouter = new OpenAI({
  baseURL: env.OPENROUTER_BASE_URL,
  apiKey: env.OPENROUTER_API_KEY ?? "missing",
  defaultHeaders: {
    "HTTP-Referer": env.OPENROUTER_APP_URL ?? env.NEXT_PUBLIC_APP_URL,
    "X-Title": env.OPENROUTER_APP_NAME,
  },
});

export const PRIMARY_MODEL = env.OPENROUTER_MODEL;
export const FREE_MODEL = `${env.OPENROUTER_MODEL}:free`;

/**
 * Resolve which model to use for a given request. Falls back to the free tier
 * if the primary key isn't set (developer machines, demos).
 */
export function pickModel(opts?: { preferFree?: boolean }) {
  if (opts?.preferFree || !env.OPENROUTER_API_KEY) return FREE_MODEL;
  return PRIMARY_MODEL;
}
