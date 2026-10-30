/**
 * Byte-bounded LRU. Used for the in-memory image cache so pages the user flips
 * back to do not hit the site again, while nothing is ever written to disk.
 */
export class ByteLruCache<V> {
  private readonly entries = new Map<string, V>();
  private total = 0;

  constructor(
    private readonly maxBytes: number,
    private readonly sizeOf: (value: V) => number
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get bytes(): number {
    return this.total;
  }

  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) {
      return undefined;
    }
    // Re-insert to mark as most recently used
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    const size = this.sizeOf(value);
    if (size > this.maxBytes) {
      return; // would evict everything else and still not fit
    }
    const previous = this.entries.get(key);
    if (previous !== undefined) {
      this.total -= this.sizeOf(previous);
      this.entries.delete(key);
    }
    this.entries.set(key, value);
    this.total += size;
    while (this.total > this.maxBytes) {
      const oldestKey = this.entries.keys().next().value as string;
      const oldest = this.entries.get(oldestKey) as V;
      this.entries.delete(oldestKey);
      this.total -= this.sizeOf(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
    this.total = 0;
  }
}
