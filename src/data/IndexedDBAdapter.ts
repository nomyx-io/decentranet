import { Logger } from '../Logger';
import { ErrorHandler } from '../ui/ErrorHandler';

export class IndexedDBAdapter {
  private db: IDBDatabase | null = null;
  private dbName: string;
  private dbVersion: number;
  private stores: string[];
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor(dbName: string, dbVersion: number, stores: string[]) {
    this.dbName = dbName;
    this.dbVersion = dbVersion;
    this.stores = stores;
    this.logger = Logger.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        this.errorHandler.handleError(new Error('IndexedDB connection error'), 'IndexedDBAdapter');
        reject(event);
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.logger.info('IndexedDB connection established', 'IndexedDBAdapter');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        this.stores.forEach(storeName => {
          if (!this.db!.objectStoreNames.contains(storeName)) {
            this.db!.createObjectStore(storeName, { keyPath: 'id' });
            this.logger.info(`Object store '${storeName}' created`, 'IndexedDBAdapter');
          }
        });
      };
    });
  }

  async put(storeName: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onerror = (event) => {
        this.errorHandler.handleError(new Error('IndexedDB put error'), 'IndexedDBAdapter');
        reject(event);
      };

      request.onsuccess = () => {
        this.logger.debug(`Data stored in '${storeName}'`, 'IndexedDBAdapter', { id: data.id });
        resolve();
      };
    });
  }

  async get(storeName: string, id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onerror = (event) => {
        this.errorHandler.handleError(new Error('IndexedDB get error'), 'IndexedDBAdapter');
        reject(event);
      };

      request.onsuccess = () => {
        this.logger.debug(`Data retrieved from '${storeName}'`, 'IndexedDBAdapter', { id });
        resolve(request.result);
      };
    });
  }

  async delete(storeName: string, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onerror = (event) => {
        this.errorHandler.handleError(new Error('IndexedDB delete error'), 'IndexedDBAdapter');
        reject(event);
      };

      request.onsuccess = () => {
        this.logger.debug(`Data deleted from '${storeName}'`, 'IndexedDBAdapter', { id });
        resolve();
      };
    });
  }

  async getAll(storeName: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = (event) => {
        this.errorHandler.handleError(new Error('IndexedDB getAll error'), 'IndexedDBAdapter');
        reject(event);
      };

      request.onsuccess = () => {
        this.logger.debug(`All data retrieved from '${storeName}'`, 'IndexedDBAdapter');
        resolve(request.result);
      };
    });
  }

  async clear(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onerror = (event) => {
        this.errorHandler.handleError(new Error('IndexedDB clear error'), 'IndexedDBAdapter');
        reject(event);
      };

      request.onsuccess = () => {
        this.logger.debug(`All data cleared from '${storeName}'`, 'IndexedDBAdapter');
        resolve();
      };
    });
  }

  disconnect(): void {
    if (this.db) {
      this.db.close();
      this.logger.info('IndexedDB connection closed', 'IndexedDBAdapter');
    }
  }
}