export class TokenBucket {
  constructor(tokensPerInterval, intervalMs) {
    this.tokensPerInterval = tokensPerInterval;
    this.intervalMs = intervalMs;
    this.tokens = tokensPerInterval;
    this.lastRefill = Date.now();
    this.queue = [];
  }

  _refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = Math.floor(elapsed / this.intervalMs) * this.tokensPerInterval;
    if (newTokens > 0) {
      this.tokens = Math.min(this.tokensPerInterval, this.tokens + newTokens);
      this.lastRefill = now;
    }
  }

  async acquire() {
    this._refill();

    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
      if (this.queue.length === 1) {
        this._scheduleNext();
      }
    });
  }

  _scheduleNext() {
    if (this.queue.length === 0) return;

    const waitMs = this.intervalMs - (Date.now() - this.lastRefill);
    setTimeout(() => {
      this.tokens = this.tokensPerInterval;
      this.lastRefill = Date.now();

      const resolve = this.queue.shift();
      if (resolve) {
        this.tokens--;
        resolve();
      }

      if (this.queue.length > 0) {
        this._scheduleNext();
      }
    }, Math.max(0, waitMs));
  }
}

export const gdeltLimiter = new TokenBucket(1, 12000);
export const googleLimiter = new TokenBucket(100, 86400000);
