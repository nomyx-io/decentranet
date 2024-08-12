import { GunNode } from './GunNode';
import { QueryOptions } from '../Types';
import { Logger } from '../Logger';

export class GunQuery<T> {
  private node: GunNode<T>;
  private logger: Logger;

  constructor(node: GunNode<T>) {
    this.node = node;
    this.logger = Logger.getInstance();
  }

  async find(predicate: (item: T) => boolean, options: QueryOptions = {}): Promise<T[]> {
    const result: T[] = [];
    let count = 0;
    let skipped = 0;

    await this.node.each((item, key) => {
      if (predicate(item)) {
        if (options.skip && skipped < options.skip) {
          skipped++;
          return;
        }
        result.push(item);
        count++;
        if (options.limit && count >= options.limit) {
          return;
        }
      }
    });

    if (options.sort) {
      const [key, order] = Object.entries(options.sort)[0];
      result.sort((a: any, b: any) => {
        if (a[key] < b[key]) return order === 'asc' ? -1 : 1;
        if (a[key] > b[key]) return order === 'asc' ? 1 : -1;
        return 0;
      });
    }

    this.logger.debug('Query executed', 'GunQuery', { 
      resultCount: result.length, 
      options 
    });

    return result;
  }

  async findOne(predicate: (item: T) => boolean): Promise<T | null> {
    let result: T | null = null;

    await this.node.each((item: T, key: string) => {
      if (result) {
        return;
      }
      if (predicate(item)) {
        result = item;
        return;
      }
    });

    this.logger.debug('FindOne query executed', 'GunQuery', { 
      found: result !== null 
    });

    return result;
  }

  async count(predicate?: (item: T) => boolean): Promise<number> {
    let count = 0;

    await this.node.each((item) => {
      if (!predicate || predicate(item)) {
        count++;
      }
    });

    this.logger.debug('Count query executed', 'GunQuery', { count });

    return count;
  }

  async update(predicate: (item: T) => boolean, updateFn: (item: T) => Partial<T>): Promise<number> {
    let updatedCount = 0;

    await this.node.each(async (item, key) => {
      if (predicate(item)) {
        const updates = updateFn(item);
        await this.node.put({ ...item, ...updates });
        updatedCount++;
      }
    });

    this.logger.debug('Update query executed', 'GunQuery', { 
      updatedCount 
    });

    return updatedCount;
  }

  async delete(predicate: (item: T) => boolean): Promise<number> {
    let deletedCount = 0;

    await this.node.each(async (item, key) => {
      if (predicate(item)) {
        await this.node.put(null as any);
        deletedCount++;
      }
    });

    this.logger.debug('Delete query executed', 'GunQuery', { 
      deletedCount 
    });

    return deletedCount;
  }

  map<R>(mapper: (item: T) => R): GunQuery<R> {
    const mappedNode = new GunNode<R>(this.node as any, '');
    return new GunQuery<R>(mappedNode);
  }

  filter(predicate: (item: T) => boolean): GunQuery<T> {
    const filteredNode = new GunNode<T>(this.node as any, '');
    return new GunQuery<T>(filteredNode);
  }
}