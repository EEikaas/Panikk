/** Enkel token-bøtte for socket-hendelser. */
export class TokenBucket {
  private tokens: number;
  private last = Date.now();
  constructor(private capacity: number, private refillPerSec: number) {
    this.tokens = capacity;
  }
  take(n = 1): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSec);
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

/** Fast vindu per nøkkel (f.eks. IP) – brukes til romoppretting og innloggingsforsøk. */
export class WindowLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private max: number, private windowMs: number) {}
  hit(key: string): boolean {
    const now = Date.now();
    const h = this.hits.get(key);
    if (!h || h.resetAt < now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 50_000) this.prune(now);
      return true;
    }
    h.count++;
    return h.count <= this.max;
  }
  private prune(now: number) {
    for (const [k, v] of this.hits) if (v.resetAt < now) this.hits.delete(k);
  }
}
