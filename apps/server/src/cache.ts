import type { TranslationCache } from "@subtitle-translator/translation-core";

type Entry = { value: string; expiresAt: number };

export class MemoryCache implements TranslationCache {
  private readonly store = new Map<string, Entry>();

  constructor(
    private readonly maxSize = 10_000,
    private readonly ttlMs = 24 * 60 * 60 * 1000,
  ) {}

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  async set(key: string, value: string): Promise<void> {
    if (this.store.size >= this.maxSize) {
      const oldest = this.store.keys().next().value as string | undefined;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<number> {
    const count = this.store.size;
    this.store.clear();
    return count;
  }
}

export const translationCache = new MemoryCache(
  Number(process.env.TRANSLATION_CACHE_MAX_SIZE || 10_000),
  Number(process.env.TRANSLATION_CACHE_TTL_MS || 24 * 60 * 60 * 1000),
);
