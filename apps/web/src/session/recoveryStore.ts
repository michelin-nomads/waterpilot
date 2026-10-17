import type { SessionPatch, SessionState } from './sessionState';

/**
 * A small, owner-scoped recovery record kept on this device (IndexedDB): the last
 * server copy of the session's inputs and any edits not yet acknowledged. It never holds
 * credentials, tokens or source data, only what the user entered into their own session.
 */
export interface RecoveryRecord {
  /** `${uid}:${tabId}`: each tab keeps its own unsent edits. */
  key: string;
  uid: string;
  accountKind: 'guest' | 'permanent';
  sessionId: string;
  base: SessionState;
  pending: SessionPatch;
  /** When the oldest unsent edit was made; null when nothing is pending. */
  editedAt: number | null;
  writtenAt: number;
  expiresAt: number;
}

export interface RecoveryStore {
  put(record: RecoveryRecord): Promise<void>;
  forUid(uid: string): Promise<RecoveryRecord[]>;
  delete(key: string): Promise<void>;
  deleteUid(uid: string): Promise<void>;
  /** Remove expired records (abandoned guests, old devices). Returns how many went. */
  deleteExpired(now: number): Promise<number>;
}

/** Records expire a week after their last write, guests and accounts alike. */
export const RECOVERY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const DB_NAME = 'waterpilot-recovery';
const STORE = 'sessions';

export class MemoryRecoveryStore implements RecoveryStore {
  readonly records = new Map<string, RecoveryRecord>();

  async put(record: RecoveryRecord) {
    this.records.set(record.key, structuredClone(record));
  }
  async forUid(uid: string) {
    return [...this.records.values()].filter((r) => r.uid === uid).map((r) => structuredClone(r));
  }
  async delete(key: string) {
    this.records.delete(key);
  }
  async deleteUid(uid: string) {
    for (const [key, record] of this.records) if (record.uid === uid) this.records.delete(key);
  }
  async deleteExpired(now: number) {
    let removed = 0;
    for (const [key, record] of this.records) {
      if (record.expiresAt <= now) {
        this.records.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

export class IndexedDbRecoveryStore implements RecoveryStore {
  private db: Promise<IDBDatabase> | null = null;

  constructor(private readonly factory: IDBFactory) {}

  private open(): Promise<IDBDatabase> {
    this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = this.factory.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('uid', 'uid');
        store.createIndex('expiresAt', 'expiresAt');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    }).catch((error: unknown) => {
      this.db = null;
      throw error;
    });
    return this.db;
  }

  private async run<T>(
    mode: IDBTransactionMode,
    work: (store: IDBObjectStore) => Promise<T>,
  ): Promise<T> {
    const tx = (await this.open()).transaction(STORE, mode);
    const result = await work(tx.objectStore(STORE));
    await done(tx);
    return result;
  }

  put(record: RecoveryRecord) {
    return this.run('readwrite', async (store) => {
      store.put(record);
    });
  }

  forUid(uid: string) {
    return this.run('readonly', (store) =>
      request(store.index('uid').getAll(uid) as IDBRequest<RecoveryRecord[]>),
    );
  }

  delete(key: string) {
    return this.run('readwrite', async (store) => {
      store.delete(key);
    });
  }

  deleteUid(uid: string) {
    return this.run('readwrite', async (store) => {
      const keys = await request(store.index('uid').getAllKeys(uid));
      keys.forEach((key) => store.delete(key));
    });
  }

  deleteExpired(now: number) {
    return this.run('readwrite', async (store) => {
      const keys = await request(store.index('expiresAt').getAllKeys(IDBKeyRange.upperBound(now)));
      keys.forEach((key) => store.delete(key));
      return keys.length;
    });
  }
}

/**
 * Wraps a store so a failing IndexedDB (private browsing, blocked storage, quota) degrades
 * to "no recovery on this device" instead of breaking planning.
 */
export class TolerantRecoveryStore implements RecoveryStore {
  constructor(
    private readonly inner: RecoveryStore,
    private readonly fallback: RecoveryStore = new MemoryRecoveryStore(),
  ) {}

  private async attempt<T>(work: (s: RecoveryStore) => Promise<T>): Promise<T> {
    try {
      return await work(this.inner);
    } catch {
      return work(this.fallback);
    }
  }

  put(record: RecoveryRecord) {
    return this.attempt((s) => s.put(record));
  }
  forUid(uid: string) {
    return this.attempt((s) => s.forUid(uid));
  }
  delete(key: string) {
    return this.attempt((s) => s.delete(key));
  }
  deleteUid(uid: string) {
    return this.attempt((s) => s.deleteUid(uid));
  }
  deleteExpired(now: number) {
    return this.attempt((s) => s.deleteExpired(now));
  }
}

export function browserRecoveryStore(): RecoveryStore {
  const factory = typeof indexedDB === 'undefined' ? null : indexedDB;
  return factory
    ? new TolerantRecoveryStore(new IndexedDbRecoveryStore(factory))
    : new MemoryRecoveryStore();
}
