/**
 * Keeps photos on the phone (IndexedDB) until they are uploaded, so nothing is lost
 * when the signal drops or the page is reloaded. All functions fail silently.
 */

const DB_NAME = "voltcheck";
const STORE = "pending-photos";

export interface QueuedPhoto {
  id: string;
  leadId: string;
  fieldKey: string;
  blob: Blob;
  at: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" }).createIndex("leadId", "leadId");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const request = fn(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queuePut(item: Omit<QueuedPhoto, "at">) {
  try {
    await run("readwrite", (s) => s.put({ ...item, at: Date.now() }));
  } catch {
    // IndexedDB not available (private mode): upload still runs normally
  }
}

export async function queueDelete(id: string) {
  try {
    await run("readwrite", (s) => s.delete(id));
  } catch {
    // ignore
  }
}

export async function queueList(leadId: string): Promise<QueuedPhoto[]> {
  try {
    return await run("readonly", (s) => s.index("leadId").getAll(leadId) as IDBRequest<QueuedPhoto[]>);
  } catch {
    return [];
  }
}
