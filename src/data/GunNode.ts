import { EventEmitter } from '../utils/EventEmitter';
import { Logger } from '../Logger';
import { ErrorHandler } from '../ui/ErrorHandler';

export class GunNode<T = any> extends EventEmitter {
  private node: any;
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor(gun: any, path: string) {
    super();
    this.node = gun.get(path);
    this.logger = Logger.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.setupListeners();
  }

  private setupListeners(): void {
    this.node.on((data: any, key: any) => {
      this.emit('update', { data, key });
    });
  }

  async put(data: Partial<T>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.node.put(data, (ack: any) => {
        if (ack.err) {
          this.errorHandler.handleError(new Error(ack.err), 'GunNode.put');
          reject(ack.err);
        } else {
          this.logger.debug('Data put successful', 'GunNode', { data });
          resolve();
        }
      });
    });
  }

  async get(): Promise<T | null> {
    return new Promise((resolve) => {
      this.node.once((data: any) => {
        if (data) {
          this.logger.debug('Data retrieved', 'GunNode', { data });
          resolve(data as T);
        } else {
          resolve(null);
        }
      });
    });
  }

  async set(data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      this.node.set(data, (ack: any) => {
        if (ack.err) {
          this.errorHandler.handleError(new Error(ack.err), 'GunNode.set');
          reject(ack.err);
        } else {
          this.logger.debug('Data set successful', 'GunNode', { data });
          resolve();
        }
      });
    });
  }

  map(): GunNode<T> {
    return new GunNode<T>(this.node.map() as any, '');
  }

  async each(callback: (data: T, key: string) => void | Promise<void>): Promise<void> {
    return new Promise((resolve) => {
      this.node.map().once(async (data: any, key: any) => {
        await callback(data as T, key);
      }).then(() => {
        this.logger.debug('Each operation completed', 'GunNode');
        resolve();
      });
    });
  }

  on(event: 'update', listener: (data: { data: T, key: string }) => void): void;
  on(event: string, listener: (...args: any[]) => void): void {
    super.on(event, listener);
  }

  off(event: 'update', listener: (data: { data: T, key: string }) => void): void;
  off(event: string, listener: (...args: any[]) => void): void {
    super.off(event, listener);
  }
}