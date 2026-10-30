/**
 * Serialises requests to the site: at most `maxConcurrency` in flight and at
 * least `minIntervalMs` between two starts. Sites in this space throttle or
 * ban IPs that burst, so this is a correctness feature, not a nicety.
 *
 * Clock and sleep are injectable for deterministic tests.
 */
import type { RateLimit } from '../../shared/sites/types';

export interface RateLimiterDeps {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface Waiter {
  run: () => void;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class RateLimiter {
  private readonly queue: Waiter[] = [];
  private active = 0;
  private lastStartAt = -Infinity;
  private timerPending = false;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(
    private readonly limits: RateLimit,
    deps: RateLimiterDeps = {}
  ) {
    this.now = deps.now ?? Date.now;
    this.sleep = deps.sleep ?? defaultSleep;
  }

  /** Number of tasks waiting to start. */
  get pending(): number {
    return this.queue.length;
  }

  /** Number of tasks currently running. */
  get running(): number {
    return this.active;
  }

  schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        run: () => {
          this.active += 1;
          this.lastStartAt = this.now();
          task()
            .then(resolve, reject)
            .finally(() => {
              this.active -= 1;
              this.pump();
            });
        },
      });
      this.pump();
    });
  }

  private pump(): void {
    while (this.queue.length > 0 && this.active < Math.max(1, this.limits.maxConcurrency)) {
      const wait = this.lastStartAt + this.limits.minIntervalMs - this.now();
      if (wait > 0) {
        if (!this.timerPending) {
          this.timerPending = true;
          void this.sleep(wait).then(() => {
            this.timerPending = false;
            this.pump();
          });
        }
        return;
      }
      const next = this.queue.shift();
      next?.run();
    }
  }
}
