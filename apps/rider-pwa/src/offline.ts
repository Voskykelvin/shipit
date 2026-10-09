export interface PodSubmission {
  orderId: string;
  riderId: string;
  submissionId: string;
  recipientName: string;
  paymentChannel: 'MPESA_STK' | 'CASH' | 'PREPAID';
  amountCollectedKes: number;
  mpesaReceiptNumber?: string;
  signatureUrl?: string;
  photoUrl?: string;
  gpsLat?: number;
  gpsLng?: number;
}

export interface QueuedPod {
  submissionId: string;
  userId: string;
  queuedAt: string;
  payload: PodSubmission;
  lastError?: string;
}

interface CachedTasks<T> {
  userId: string;
  cachedAt: string;
  value: T;
}

const DATABASE_NAME = 'shipit-rider-offline';
const DATABASE_VERSION = 1;
const OUTBOX_STORE = 'pod-outbox';
const TASKS_STORE = 'tasks';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const outbox = database.createObjectStore(OUTBOX_STORE, { keyPath: 'submissionId' });
      outbox.createIndex('userId', 'userId');
      database.createObjectStore(TASKS_STORE, { keyPath: 'userId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local rider storage.'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local rider storage request failed.'));
  });
}

async function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(storeName, mode);
    const completed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Local rider storage transaction failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Local rider storage transaction was aborted.'));
    });
    const result = await requestResult(action(transaction.objectStore(storeName)));
    await completed;
    return result;
  } finally {
    database.close();
  }
}

export async function saveTasks<T>(userId: string, value: T): Promise<void> {
  await transact(TASKS_STORE, 'readwrite', (store) =>
    store.put({ userId, cachedAt: new Date().toISOString(), value }),
  );
}

export async function loadTasks<T>(userId: string): Promise<CachedTasks<T> | undefined> {
  return transact(TASKS_STORE, 'readonly', (store) => store.get(userId));
}

export async function listQueuedPods(userId: string): Promise<QueuedPod[]> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(OUTBOX_STORE, 'readonly');
    const result = await requestResult(transaction.objectStore(OUTBOX_STORE).index('userId').getAll(userId));
    return result.sort((left, right) => left.queuedAt.localeCompare(right.queuedAt)) as QueuedPod[];
  } finally {
    database.close();
  }
}

export async function saveQueuedPod(entry: QueuedPod): Promise<void> {
  await transact(OUTBOX_STORE, 'readwrite', (store) => store.put(entry));
}

export async function deleteQueuedPod(submissionId: string): Promise<void> {
  await transact(OUTBOX_STORE, 'readwrite', (store) => store.delete(submissionId));
}
