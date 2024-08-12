import { ReactiveUI } from '../ui/ReactiveUI';
import { MultiContextObject } from './MultiContextObject';
import { Context, ComponentState, ComponentProps, PeerMessage, ComponentInstance, ComponentPackage, SchemaDefinition } from '../Types';
import { DistributedState } from '../data/DistributedState';
import { PeerManager } from '../net/PeerManager';
import { SyncManager } from '../net/SyncManager';
import { Logger } from '../Logger';
import { EventEmitter } from '../utils/EventEmitter';
import { ComponentRegistry } from './ComponentRegistry';
import { GunDataProvider } from '../data/GunDataProvider';
import { SandboxedEnvironment } from '../env/SandboxedEnvironment';

export abstract class Component<S extends ComponentState, P extends ComponentProps> extends MultiContextObject {
  protected ui: ReactiveUI;
  protected state: DistributedState<S>;
  public props: P;
  protected peerManager: PeerManager;
  protected syncManager: SyncManager;
  protected logger: Logger;
  private eventEmitter: EventEmitter;
  private childComponents: Map<string, Component<any, any>> = new Map();
  private metadata: any = {};
  private stateUnsubscribe: (() => void) | null = null;

  constructor(
    contexts: Context[],
    dataProvider: GunDataProvider,
    schema: SchemaDefinition,
    initialState: S,
    props: P,
    peerManager: PeerManager,
    syncManager: SyncManager
  ) {
    super(contexts);
    this.ui = new ReactiveUI();
    this.props = props; 
    this.peerManager = peerManager;
    this.syncManager = syncManager;
    this.state = new DistributedState<S>(dataProvider, this.getPath(), schema);
    this.state.set(initialState);
    this.logger = Logger.getInstance();
    this.eventEmitter = new EventEmitter();

    this.setupStateSubscription();
    this.setupPeerMessageHandler();
  }

  private getPath(): string {
    return `${this.constructor.name}/${this.state.getId()}`;
  }
  
  private setupStateSubscription(): void {
    this.stateUnsubscribe = this.state.subscribe(this.handleStateChange.bind(this));
  }

  private setupPeerMessageHandler(): void {
    this.peerManager.on('message', this.handlePeerMessage.bind(this));
  }

  abstract render(): string;

  async publish(registry: ComponentRegistry, currentUserPair: any, schema: SchemaDefinition): Promise<void> {
    const code = this.serialize();
    const componentPackage: ComponentPackage = {
      metadata: this.metadata,
      code,
      state: await this.state.get(),
      schema
    };
    await registry.publishComponent(componentPackage, currentUserPair);
  }

  static async load(
    address: string,
    registry: ComponentRegistry,
    userPair: any,
    dataProvider: GunDataProvider,
    syncManager: SyncManager,
    schema: SchemaDefinition
  ): Promise<ComponentInstance | null> {
    const componentPackage = await registry.getComponent(address, userPair);
    if (!componentPackage) return null;

    const { metadata, code, state, schema: componentSchema } = componentPackage;
    const parsed = JSON.parse(code);

    const sandboxedEnv = new SandboxedEnvironment();
    const componentClass = sandboxedEnv.evaluate(`
      (class extends Component {
        constructor(metadata, state) {
          super(metadata, state);
          ${Object.entries(parsed.methods).map(([name, func]) => `this.${name} = ${func};`).join('\n')}
        }

        render() {
          return (${parsed.render})();
        }
      })
    `);

    const component = new componentClass(metadata, state);
    const distributedState = new DistributedState(dataProvider, `${address}/state`, componentSchema || schema);
    await distributedState.set(state);

    return { component, state: distributedState };
  }

  private serialize(): string {
    return JSON.stringify({
      metadata: this.metadata,
      render: this.render.toString(),
      methods: Object.getOwnPropertyNames(Object.getPrototypeOf(this))
        .filter(name => name !== 'constructor' && typeof (this as any)[name] === 'function')
        .reduce((acc, name) => ({ ...acc, [name]: (this as any)[name].toString() }), {})
    });
  }
  
  // Add methods for component lifecycle management
  onMount() {}
  onUnmount() {}
  onUpdate(prevProps: any, prevState: any) {}

  protected setState(newState: Partial<S>, broadcast: boolean = true): void {
    this.state.update(
      (state: S) => ({ ...state, ...newState }),
    );
  }

  private handleStateChange(newState: S): void {
    this.update();
    this.eventEmitter.emit('stateChanged', newState);
  }

  protected handlePeerMessage(message: PeerMessage): void {
    // Override this method in subclasses to handle peer messages
  }

  update(): void {
    this.ui.update(this.render() as any);
  }

  mount(element: HTMLElement): void {
    this.ui.mount(element);
    this.update();
    this.onMount();
  }

  unmount(): void {
    this.ui.unmount();
    if (this.stateUnsubscribe) {
      this.stateUnsubscribe();
    }
    this.peerManager.off('message', this.handlePeerMessage);
    this.onUnmount();
  }

  updateProps(newProps: Partial<P>): void {
    const oldProps = { ...this.props };
    this.props = { ...this.props, ...newProps };
    this.update();
    this.onUpdate(oldProps, this.state.getCurrentState());
  }

  // Child component management
  protected registerChildComponent(key: string, component: Component<any, any>): void {
    this.childComponents.set(key, component);
  }

  protected getChildComponent(key: string): Component<any, any> | undefined {
    return this.childComponents.get(key);
  }

  protected removeChildComponent(key: string): void {
    const component = this.childComponents.get(key);
    if (component) {
      component.unmount();
      this.childComponents.delete(key);
    }
  }

  // Event handling
  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.on(event, listener);
  }

  public off(event: string, listener: (...args: any[]) => void): void {
    this.eventEmitter.off(event, listener);
  }

  public emit(event: string, ...args: any[]): void {
    this.eventEmitter.emit(event, ...args);
  }

  // Peer-to-peer methods
  public sendToPeer(peerId: string, message: any): void {
    this.peerManager.sendToPeer(peerId, message);
  }

  public broadcastToPeers(message: any): void {
    this.peerManager.broadcast(message);
  }

  // Distributed state methods
  public syncState(): void {
    this.syncManager.syncState(this.state.getId(), this.state.getCurrentState());
  }

  public async fetchStateFromPeers(): Promise<void> {
    const peerState = await this.syncManager.fetchStateFromPeers(this.state.getId());
    if (peerState) {
      await this.state.set(peerState);
    }
  }

  // Context-aware method execution
  public executeInContext(context: Context, method: () => any): Promise<any> {
    return super.executeInContext(context, method.bind(this));
  }

  // Utility methods
  protected log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any): void {
    this.logger[level](message, this.constructor.name, data);
  }

  // State persistence
  protected async saveState(): Promise<void> {
    const currentState = await this.state.get();
    await this.syncManager.persistState(this.state.getId(), currentState);
  }

  protected async loadState(): Promise<void> {
    const loadedState = await this.syncManager.loadPersistedState(this.state.getId());
    if (loadedState) {
      await this.state.set(loadedState as S);
    }
  }

  // Dynamic imports for code splitting
  protected async importComponent(path: string): Promise<typeof Component> {
    return import(path).then(module => module.default);
  }

  // Error boundary
  protected catchError(error: Error): void {
    this.log('error', 'Error caught in component', error);
    // Implement error handling logic here
  }
}