import { GunDataProviderOptions } from '../Types';
import getGun from './Gun';
import { GunNode } from './GunNode';
import { GunQuery } from './GunQuery';
import { Logger } from '../Logger';
import { ErrorHandler } from '../ui/ErrorHandler';
import { EventEmitter } from '../utils/EventEmitter';

export class GunDataProvider extends EventEmitter {
  public gun: any;
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor(options: GunDataProviderOptions = {}) {
    super();
    this.gun = getGun(options);
    this.logger = Logger.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.gun.on('error', (error: any) => {
      this.errorHandler.handleError(error, 'GunDataProvider');
    });
  }

  getNode<T>(path: string): GunNode<T> {
    return new GunNode<T>(this.gun, path);
  }

  createQuery<T>(path: string): GunQuery<T> {
    const node = this.getNode<T>(path);
    return new GunQuery<T>(node);
  }

  async put(path: string, data: any): Promise<void> {
    const node = this.getNode(path);
    await node.put(data);
    this.logger.debug('Data put successful', 'GunDataProvider', { path, data });
  }

  async get(path: string): Promise<any> {
    const node = this.getNode(path);
    const data = await node.get();
    this.logger.debug('Data retrieved', 'GunDataProvider', { path, data });
    return data;
  }

  async set(path: string, data: any): Promise<void> {
    const node = this.getNode(path);
    await node.set(data);
    this.logger.debug('Data set successful', 'GunDataProvider', { path, data });
  }

  onUpdate(path: string, callback: (data: any) => void): void {
    const node = this.getNode(path);
    node.on('update', ({ data }) => {
      callback(data);
    });
    this.logger.debug('Update listener added', 'GunDataProvider', { path });
  }

  offUpdate(path: string, callback: (data: any) => void): void {
    const node = this.getNode(path);
    node.off('update', callback);
    this.logger.debug('Update listener removed', 'GunDataProvider', { path });
  }

  async createUser(username: string, password: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.gun.user().create(username, password, (ack: any) => {
        if (ack.err) {
          this.errorHandler.handleError(new Error(ack.err), 'GunDataProvider.createUser');
          reject(ack.err);
        } else {
          this.logger.info('User created', 'GunDataProvider', { username });
          resolve(ack);
        }
      });
    });
  }

  async login(username: string, password: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.gun.user().auth(username, password, (ack: any) => {
        if (ack.err) {
          this.errorHandler.handleError(new Error(ack.err), 'GunDataProvider.login');
          reject(ack.err);
        } else {
          this.logger.info('User logged in', 'GunDataProvider', { username });
          resolve(ack);
        }
      });
    });
  }

  logout(): void {
    this.gun.user().leave();
    this.logger.info('User logged out', 'GunDataProvider');
  }

  getCurrentUser(): any {
    return this.gun.user().is;
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  generateUuid(): string {
    return this.gun.user().text.random(24);
  }

  getServerTime(): Promise<number> {
    return new Promise((resolve) => {
      this.gun.time((time: any) => {
        resolve(time);
      });
    });
  }
}