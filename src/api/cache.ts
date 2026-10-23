/** Caché persistente en IndexedDB con caducidad. Si IndexedDB no está disponible, queda en memoria. */
export interface KV {
  get(key: string): Promise<{ v: unknown; exp: number } | undefined>;
  set(key: string, value: { v: unknown; exp: number }): Promise<void>;
}

const DB = 'floraguessr';
const STORE = 'cache';

function idbKV(): KV | null {
  if (typeof indexedDB === 'undefined') return null;
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () =>
    (dbp ??= new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const tx = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const r = fn(db.transaction(STORE, mode).objectStore(STORE));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  };
  return {
    get: (key) => tx('readonly', (s) => s.get(key)),
    set: async (key, value) => {
      await tx('readwrite', (s) => s.put(value, key));
    },
  };
}

export class Cache {
  private mem = new Map<string, { v: unknown; exp: number }>();
  private inflight = new Map<string, Promise<unknown>>();

  constructor(private store: KV | null = idbKV(), private now: () => number = () => Date.now()) {}

  /** Lee sin cargar: undefined si no está o ha caducado. */
  async peek<T>(key: string): Promise<T | undefined> {
    const t = this.now();
    const hit = this.mem.get(key);
    if (hit && hit.exp > t) return hit.v as T;
    const stored = await this.store?.get(key).catch(() => undefined);
    if (stored && stored.exp > t) {
      this.mem.set(key, stored);
      return stored.v as T;
    }
    return undefined;
  }

  async put(key: string, ttlDays: number, v: unknown): Promise<void> {
    const entry = { v, exp: this.now() + ttlDays * 86_400_000 };
    this.mem.set(key, entry);
    await this.store?.set(key, entry).catch(() => undefined);
  }

  /** Devuelve el valor guardado o lo carga una sola vez aunque lo pidan varias partes a la vez. */
  async get<T>(key: string, ttlDays: number, load: () => Promise<T>): Promise<T> {
    const t = this.now();
    const hit = this.mem.get(key);
    if (hit && hit.exp > t) return hit.v as T;
    const running = this.inflight.get(key);
    if (running) return running as Promise<T>;
    const p = (async () => {
      try {
        const stored = await this.store?.get(key).catch(() => undefined);
        if (stored && stored.exp > t) {
          this.mem.set(key, stored);
          return stored.v as T;
        }
        const v = await load();
        const entry = { v, exp: t + ttlDays * 86_400_000 };
        this.mem.set(key, entry);
        await this.store?.set(key, entry).catch(() => undefined);
        return v;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }
}

export const cache = new Cache();
