import { GunDataProvider } from '../data/GunDataProvider';
import { EventEmitter } from '../utils/EventEmitter';
import { TypedSchema } from './TypedSchema';
import { SchemaDefinition } from '../Types';

export class DistributedState<T extends object> extends EventEmitter {
  private gunDataProvider: GunDataProvider;
  private path: string;
  private schema: TypedSchema;
  private state: T;

  constructor(gunDataProvider: GunDataProvider, path: string, schema: SchemaDefinition, initialState?: T) {
    super();
    this.gunDataProvider = gunDataProvider;
    this.path = path;
    this.schema = new TypedSchema(schema);
    this.state = this.schema.getDefaultValue() as T;
    if (initialState) {
      this.state = { ...this.state, ...initialState };
    }
    this.setupListeners();
  }

  private setupListeners(): void {
    this.gunDataProvider.onUpdate(this.path, (data: any) => {
      const validData = this.schema.cast(data);
      this.updateState(validData);
    });
  }

  private updateState(newState: Partial<T>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };
    this.emit('stateChanged', this.state, oldState);
  }

  async get(): Promise<T> {
    const data = await this.gunDataProvider.get(this.path);
    return this.schema.cast(data) as T;
  }

  async set(data: Partial<T>): Promise<void> {
    const validData = this.schema.cast(data);
    await this.gunDataProvider.put(this.path, validData);
    this.updateState(validData);
  }

  async update(updater: (currentState: T) => Partial<T>): Promise<void> {
    const currentState = await this.get();
    const updates = updater(currentState);
    await this.set(updates);
  }

  subscribe(listener: (state: T, oldState: T) => void): () => void {
    this.on('stateChanged', listener);
    return () => this.off('stateChanged', listener);
  }

  getSchema(): SchemaDefinition {
    return this.schema.schema;
  }

  validate(data: any): boolean {
    return this.schema.validate(data);
  }

  async reset(): Promise<void> {
    const defaultState = this.schema.getDefaultValue() as T;
    return this.set(defaultState);
  }

  getId(): string {
    return this.path;
  }

  async transaction(transactionFn: (currentState: T) => Partial<T>): Promise<void> {
    const currentState = await this.get();
    const updates = transactionFn(currentState);
    await this.set(updates);
  }

  // New method to get the current state synchronously
  getCurrentState(): T {
    return { ...this.state };
  }

  // New method to set state without emitting events (for internal use)
  setStateQuiet(newState: Partial<T>): void {
    this.state = { ...this.state, ...newState };
  }

  // New method to force a refresh from the data provider
  async refresh(): Promise<void> {
    const data = await this.gunDataProvider.get(this.path);
    const validData = this.schema.cast(data) as T;
    this.setStateQuiet(validData);
    this.emit('stateChanged', this.state, {});
  }
}