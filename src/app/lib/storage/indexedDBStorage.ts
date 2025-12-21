// IndexedDB storage utility for translation cache
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "tools-by-ai";
const DB_VERSION = 1;
const STORE_NAME = "translation-cache";

interface TranslationCacheDB {
  "translation-cache": {
    key: string;
    value: string;
  };
}

let dbPromise: Promise<IDBPDatabase<TranslationCacheDB>> | null = null;

const getDB = (): Promise<IDBPDatabase<TranslationCacheDB>> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available in SSR"));
  }

  if (!dbPromise) {
    dbPromise = openDB<TranslationCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }

  return dbPromise;
};

export const translationCache = {
  async get(key: string): Promise<string | null> {
    try {
      const db = await getDB();
      const value = await db.get(STORE_NAME, key);
      return value ?? null;
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      const db = await getDB();
      await db.put(STORE_NAME, value, key);
    } catch (error) {
      console.error("Failed to set translation cache:", error);
    }
  },

  async delete(key: string): Promise<void> {
    try {
      const db = await getDB();
      await db.delete(STORE_NAME, key);
    } catch (error) {
      console.error("Failed to delete translation cache:", error);
    }
  },

  async clear(): Promise<number> {
    try {
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const count = await store.count();
      await store.clear();
      await tx.done;
      return count;
    } catch (error) {
      console.error("Failed to clear translation cache:", error);
      return 0;
    }
  },

  async count(): Promise<number> {
    try {
      const db = await getDB();
      return await db.count(STORE_NAME);
    } catch {
      return 0;
    }
  },
};
