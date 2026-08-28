// ── In-memory sliding-window rate limiter ────────────────────────────────────
// Best-effort protection shared by login, order creation, cancellation-code
// attempts and order tracking. State is kept on globalThis so hot reloads and
// module duplication don't reset the counters.
//
// On Vercel serverless each instance keeps its own map, so this raises the bar
// without pretending to be a Redis-backed limiter. Swap the storage for
// Upstash/Redis later if you need cross-instance guarantees.

const MAX_FAILURES = 5;
const WINDOW_MS = 5 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

interface AttemptEntry {
  count: number;
  firstAt: number;
  lockedUntil: number;
}

type Buckets = Map<string, Map<string, AttemptEntry>>;

const globalStore = globalThis as typeof globalThis & {
  __hdRateBuckets?: Buckets;
};

function buckets(): Buckets {
  if (!globalStore.__hdRateBuckets) globalStore.__hdRateBuckets = new Map();
  return globalStore.__hdRateBuckets;
}

// Memory hygiene for long-running private servers: every unique bucket/ip
// pair leaves a stale entry behind once its window and lockout have both
// passed. Without a sweep the maps grow forever (one entry per abusive IP).
// Retention uses LOCKOUT_MS (the longest relevant lifetime) so a still-locked
// entry is never dropped early. Runs at most once per minute.
const SWEEP_INTERVAL_MS = 60 * 1000;
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  const store = buckets();
  for (const [bucketName, perBucket] of store) {
    for (const [ip, entry] of perBucket) {
      if (entry.lockedUntil <= now && now - entry.firstAt > LOCKOUT_MS) {
        perBucket.delete(ip);
      }
    }
    if (perBucket.size === 0) store.delete(bucketName);
  }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export function checkRateLimit(
  bucket: string,
  ip: string,
  opts?: { max?: number; windowMs?: number }
): { locked: boolean; retryAfterMin?: number } {
  const max = opts?.max ?? MAX_FAILURES;
  const windowMs = opts?.windowMs ?? WINDOW_MS;
  const now = Date.now();
  sweep(now);
  const entry = buckets().get(bucket)?.get(ip);
  if (!entry) return { locked: false };
  if (entry.lockedUntil > now) {
    return { locked: true, retryAfterMin: Math.ceil((entry.lockedUntil - now) / 60000) };
  }
  // Window expired — stale entry no longer blocks.
  if (now - entry.firstAt > windowMs && entry.lockedUntil <= now) {
    return { locked: false };
  }
  if (entry.count >= max && entry.lockedUntil <= now) {
    // Hit the cap without an explicit lockout (used as a quota) — lock now.
    entry.lockedUntil = now + LOCKOUT_MS;
    return { locked: true, retryAfterMin: Math.ceil(LOCKOUT_MS / 60000) };
  }
  return { locked: false };
}

export function recordFailure(
  bucket: string,
  ip: string,
  opts?: { max?: number; windowMs?: number }
): void {
  const max = opts?.max ?? MAX_FAILURES;
  const windowMs = opts?.windowMs ?? WINDOW_MS;
  const now = Date.now();
  sweep(now);
  let perBucket = buckets().get(bucket);
  if (!perBucket) {
    perBucket = new Map();
    buckets().set(bucket, perBucket);
  }
  const entry = perBucket.get(ip);
  if (!entry || now - entry.firstAt > windowMs) {
    perBucket.set(ip, { count: 1, firstAt: now, lockedUntil: 0 });
    return;
  }
  entry.count++;
  if (entry.count >= max) entry.lockedUntil = now + LOCKOUT_MS;
}

export function recordAttempt(bucket: string, ip: string, opts?: { max?: number; windowMs?: number }): void {
  // Same as recordFailure but for quota-style limits that count every request.
  recordFailure(bucket, ip, opts);
}

export function clearFailures(bucket: string, ip: string): void {
  buckets().get(bucket)?.delete(ip);
}
