import type { TranslationCache } from "@subtitle-translator/translation-core";
import { serverConfig } from "./config.js";

type Entry = { value: string; expiresAt: number };

export type CacheStats = {
  size: number;
  maxSize: number;
  ttlMs: number;
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
};

export class MemoryCache implements TranslationCache {
  private readonly store = new Map<string, Entry>();
  private hits = 0;
  private misses = 0;
  private sets = 0;
  private deletes = 0;
  private evictions = 0;

  constructor(
    private readonly maxSize = 10_000,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
  ) {}

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      this.evictions += 1;
      return null;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  async set(key: string, value: string): Promise<void> {
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value as string | undefined;
      if (oldest) {
        this.store.delete(oldest);
        this.evictions += 1;
      }
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    this.sets += 1;
  }

  async delete(key: string): Promise<void> {
    if (this.store.delete(key)) this.deletes += 1;
  }

  async clear(): Promise<number> {
    const count = this.store.size;
    this.store.clear();
    this.deletes += count;
    return count;
  }

  stats(): CacheStats {
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      hits: this.hits,
      misses: this.misses,
      sets: this.sets,
      deletes: this.deletes,
      evictions: this.evictions,
    };
  }
}

export const translationCache = new MemoryCache(
  serverConfig.cacheMaxSize,
  serverConfig.cacheTtlMs,
);
