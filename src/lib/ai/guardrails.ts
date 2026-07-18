/**
 * Lightweight prompt-injection / output filters and a per-user rate limiter.
 * Real production rate limiting should be backed by Redis; this in-memory
 * version is sufficient for single-instance deploys and is the documented
 * baseline.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all )?(previous|above) instructions/i,
  /disregard (the )?system prompt/i,
  /you are now (a |an )?[a-z ]+/i,
  /reveal (your )?system prompt/i,
  /print (your )?system message/i,
];

export function flagInjection(input: string): { flagged: boolean; reason?: string } {
  for (const re of INJECTION_PATTERNS) {
    if (re.test(input)) return { flagged: true, reason: re.source };
  }
  return { flagged: false };
}

/**
 * Output filter — strips obvious leakage of secrets / API keys we know about.
 * Cheap defence-in-depth, not a substitute for not-prompting-with-secrets.
 */
const SECRET_HINTS: RegExp[] = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /sb_secret_[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._-]{20,}/g,
];

export function scrubOutput(text: string): string {
  let out = text;
  for (const re of SECRET_HINTS) out = out.replace(re, "[redacted]");
  return out;
}

// ---------------------------------------------------------------------------
// In-memory rate limiter. Key = `${orgId}:${userId}`.
// ---------------------------------------------------------------------------
type Bucket = { hourStart: number; hourCount: number; dayStart: number; dayCount: number };
const buckets = new Map<string, Bucket>();

const DEFAULTS = {
  perHour: 60,
  perDay: 500,
};

export function checkRateLimit(orgId: string, userId: string, limits = DEFAULTS) {
  const key = `${orgId}:${userId}`;
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  const b = buckets.get(key) ?? { hourStart: now, hourCount: 0, dayStart: now, dayCount: 0 };
  if (now - b.hourStart > hour) { b.hourStart = now; b.hourCount = 0; }
  if (now - b.dayStart > day)   { b.dayStart  = now; b.dayCount  = 0; }
  if (b.hourCount >= limits.perHour) {
    return { ok: false as const, reason: "hourly limit reached" };
  }
  if (b.dayCount >= limits.perDay) {
    return { ok: false as const, reason: "daily limit reached" };
  }
  b.hourCount++; b.dayCount++;
  buckets.set(key, b);
  return { ok: true as const, remainingHour: limits.perHour - b.hourCount, remainingDay: limits.perDay - b.dayCount };
}
