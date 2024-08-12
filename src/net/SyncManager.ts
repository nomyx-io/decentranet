import { EventEmitter } from '../utils/EventEmitter';
import { GunDataProvider } from '../data/GunDataProvider';
import { SyncStatus, SyncPriority, SchemaDefinition } from '../Types';
import { Logger } from '../Logger';
import { ErrorHandler } from '../ui/ErrorHandler';
import { DistributedState } from '../data/DistributedState';

const priorityValues: { [key in SyncPriority]: number } = {
  [SyncPriority.Low]: 0,
  [SyncPriority.Normal]: 1,
  [SyncPriority.High]: 2
};

const priorityLabels: { [key: number]: SyncPriority } = {
  0: SyncPriority.Low,
  1: SyncPriority.Normal,
  2: SyncPriority.High
};

// PriorityQueue implementation
class PriorityQueue<T> {
  private elements: { priority: SyncPriority, value: T }[] = [];

  enqueue(value: T, priority: SyncPriority): void {
    this.elements.push({ priority, value });
    this.elements.sort((a, b) => priorityValues[a.priority] - priorityValues[b.priority]);
  }

  dequeue(): T | undefined {
    return this.elements.shift()?.value;
  }

  updatePriority(value: T, priority: SyncPriority): void {
    const index = this.elements.findIndex((element) => element.value === value);
    if (index !== -1) {
      this.elements[index].priority = priority;
      this.elements.sort((a, b) => priorityValues[a.priority] - priorityValues[b.priority]);
    }
  }

  remove(value: T): void {
    this.elements = this.elements.filter((element) => element.value !== value);
  }

  isEmpty(): boolean {
    return this.elements.length === 0;
  }
}

export class SyncManager extends EventEmitter {
  private gunDataProvider: GunDataProvider;
  private syncStatus: Map<string, SyncStatus> = new Map();
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private distributedStates: Map<string, DistributedState<any>> = new Map();
  private syncQueue: PriorityQueue<string> = new PriorityQueue();
  private isSyncing: boolean = false;
  private maxRetries: number = 3;

  constructor(gunDataProvider: GunDataProvider) {
    super();
    this.gunDataProvider = gunDataProvider;
    this.logger = Logger.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
  }

  /**
   * Starts synchronization for a given path
   * @param path The path to synchronize
   * @param priority The priority of the sync operation
   */
  startSync(path: string, priority: SyncPriority = SyncPriority.Normal): void {
    if (this.syncStatus.has(path)) {
      this.logger.warn('Sync already started for path', 'SyncManager', { path });
      return;
    }

    const status: SyncStatus = {
      lastSyncTime: Date.now(),
      pendingChanges: 0,
      priority,
      isPaused: false
    };
    this.syncStatus.set(path, status);
    this.syncQueue.enqueue(path, priority);

    this.gunDataProvider.onUpdate(path, (data) => {
      this.handleUpdate(path, data);
    });

    this.logger.info('Sync started for path', 'SyncManager', { path, priority });
    this.emit('syncStarted', { path, priority });

    this.processSyncQueue();
  }

  /**
   * Stops synchronization for a given path
   * @param path The path to stop synchronizing
   */
  stopSync(path: string): void {
    if (!this.syncStatus.has(path)) {
      this.logger.warn('Sync not started for path', 'SyncManager', { path });
      return;
    }

    this.gunDataProvider.offUpdate(path, this.handleUpdate.bind(this) as any);
    this.syncStatus.delete(path);
    this.syncQueue.remove(path);

    this.logger.info('Sync stopped for path', 'SyncManager', { path });
    this.emit('syncStopped', { path });
  }

  getSyncedPaths(): string[] {
    return Array.from(this.syncStatus.keys());
  }

  /**
   * Gets the sync status for a given path
   * @param path The path to get the status for
   * @returns The sync status or undefined if not found
   */
  getSyncStatus(path: string): SyncStatus | undefined {
    return this.syncStatus.get(path);
  }

  /**
   * Gets the distributed state for a given path
   * @param path The path to get the state for
   * @returns The distributed state or null if not found
   */
  getDistributedState<T>(path: string): DistributedState<any> | null {
    return this.distributedStates.get(path) || null;
  }

  /**
   * Handles updates from the GunDataProvider
   * @param path The path that was updated
   * @param data The updated data
   */
  private handleUpdate(path: string, data: any): void {
    const status = this.syncStatus.get(path);
    if (!status || status.isPaused) return;

    status.lastSyncTime = Date.now();
    status.pendingChanges++;

    this.emit('dataUpdated', { path, data });

    this.syncQueue.updatePriority(path, status.priority);
    this.processSyncQueue();

    this.logger.debug('Data updated', 'SyncManager', { path, pendingChanges: status.pendingChanges });
  }

  /**
   * Processes the sync queue
   */
  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing) return;

    this.isSyncing = true;
    while (!this.syncQueue.isEmpty()) {
      const path = this.syncQueue.dequeue();
      if (path) {
        await this.processPendingChanges(path);
      }
    }
    this.isSyncing = false;
  }

  /**
   * Processes pending changes for a given path
   * @param path The path to process changes for
   */
  private async processPendingChanges(path: string): Promise<void> {
    const status = this.syncStatus.get(path);
    if (!status) return;

    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        const data = await this.gunDataProvider.get(path);
        const state = this.getDistributedState(path);
        if (state) {
          await state.update(data);
        }
        
        status.pendingChanges--;
        status.lastSyncTime = Date.now();
        this.syncStatus.set(path, status);
        this.emit('syncCompleted', { path, status });
        break;
      } catch (error) {
        retries++;
        this.logger.warn(`Sync failed for path, retrying (${retries}/${this.maxRetries})`, 'SyncManager', { path, error });
        if (retries >= this.maxRetries) {
          this.errorHandler.handleError(error as Error, 'SyncManager.processPendingChanges');
          this.emit('syncError', { path, error });
        }
      }
    }
  }
  
  fetchStateFromPeers<T>(path: string): Promise<T | null> {
    return this.gunDataProvider.get(path);
  }

  syncState<T extends object>(path: string, schema: SchemaDefinition): DistributedState<T> {
    if (this.distributedStates.has(path)) {
      throw new Error(`State already synced for path: ${path}`);
    }

    const state = new DistributedState<T>(this.gunDataProvider, path, schema);
    this.distributedStates.set(path, state);
    this.startSync(path);
    return state;
  }

  persistState<T>(path: string, schema: SchemaDefinition): DistributedState<any> {
    if (this.distributedStates.has(path)) {
      throw new Error(`State already synced for path: ${path}`);
    }

    const state = new DistributedState<any>(this.gunDataProvider, path, schema);
    this.distributedStates.set(path, state);
    return state;
  }

  loadPersistedState<T>(path: string): Promise<T | null> {
    return this.gunDataProvider.get(path);
  }

  /**
   * Forces synchronization for all paths
   */
  async forceSyncAll(): Promise<void> {
    const paths = Array.from(this.syncStatus.keys());
    for (const path of paths) {
      await this.forceSync(path);
    }
    this.logger.info('Forced sync completed for all paths', 'SyncManager');
    this.emit('forceSyncAllCompleted');
  }

  /**
   * Forces synchronization for a given path
   * @param path The path to force sync
   */
  async forceSync(path: string): Promise<void> {
    if (!this.syncStatus.has(path)) {
      throw new Error(`Sync not started for path: ${path}`);
    }

    try {
      const data = await this.gunDataProvider.get(path);
      const state = this.getDistributedState(path);
      if (state) {
        await state.update(data);
      }
      
      const status = this.syncStatus.get(path)!;
      status.lastSyncTime = Date.now();
      status.pendingChanges = 0;
      this.syncStatus.set(path, status);

      this.emit('syncCompleted', { path, status });
      this.logger.info('Forced sync completed for path', 'SyncManager', { path });
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'SyncManager.forceSync');
      this.emit('syncError', { path, error });
      throw error;
    }
  }

  /**
   * Gets the total count of pending changes across all paths
   * @returns The total count of pending changes
   */
  getPendingChangesCount(): number {
    let totalPendingChanges = 0;
    for (const status of this.syncStatus.values()) {
      totalPendingChanges += status.pendingChanges;
    }
    return totalPendingChanges;
  }

  /**
   * Checks if any sync operation is in progress
   * @returns True if any sync is in progress, false otherwise
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Pauses synchronization for a given path
   * @param path The path to pause synchronization for
   */
  pauseSync(path: string): void {
    const status = this.syncStatus.get(path);
    if (status) {
      status.isPaused = true;
      this.syncStatus.set(path, status);
      this.logger.info('Sync paused for path', 'SyncManager', { path });
      this.emit('syncPaused', { path });
    }
  }

  /**
   * Resumes synchronization for a given path
   * @param path The path to resume synchronization for
   */
  resumeSync(path: string): void {
    const status = this.syncStatus.get(path);
    if (status) {
      status.isPaused = false;
      this.syncStatus.set(path, status);
      this.logger.info('Sync resumed for path', 'SyncManager', { path });
      this.emit('syncResumed', { path });
    }
  }

  stop(): void {
    for (const path of this.syncStatus.keys()) {
      this.stopSync(path);

      this.distributedStates.delete(path);

      this.logger.info('Sync stopped for path', 'SyncManager', { path });

      this.syncStatus.clear();
      this.syncQueue = new PriorityQueue();

      this.isSyncing = false;

      this.logger.info('SyncManager stopped', 'SyncManager');
      this.emit('stopped');

      this.removeAllListeners();

      this.logger.info('SyncManager destroyed', 'SyncManager');
    }
  }

}