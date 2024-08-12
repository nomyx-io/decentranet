import { GunDataProvider } from '../data/GunDataProvider';
import { AuthManager } from '../auth/AuthManager';
import { SyncManager } from '../net/SyncManager';
import { PeerManager } from '../net/PeerManager';
import { PluginSystem } from './PluginSystem';
import { ContextRouter } from './ContextRouter';
import { DevTools } from '../dev/DevTools';
import { Logger } from '../Logger';
import { NetworkMonitor } from '../net/NetworkMonitor';
import { MultiContextObject } from './MultiContextObject';
import { BROWSER_CONTEXT, SERVER_CONTEXT, PEER_CONTEXT } from '../utils/Constants';
import { DistributedState } from '../data/DistributedState';
import { Component } from './Component';
import { ComponentRegistry } from './ComponentRegistry';
import { ComponentMetadata, ComponentInstance, ComponentUpdateEvent, SchemaDefinition } from '../Types';

export class DecentralizedApp extends MultiContextObject {
  private gunDataProvider: GunDataProvider;
  private authManager: AuthManager;
  private syncManager: SyncManager;
  private peerManager: PeerManager;
  private pluginSystem: PluginSystem;
  private contextRouter: ContextRouter;
  private devTools: DevTools;
  public logger: Logger;
  private networkMonitor: NetworkMonitor;
  private componentRegistry: ComponentRegistry;
  private loadedComponents: Map<string, ComponentInstance> = new Map();

  constructor(gun: GunDataProvider) {
    super([BROWSER_CONTEXT, SERVER_CONTEXT, PEER_CONTEXT]);
    this.logger = Logger.getInstance();
    this.gunDataProvider = gun;
    this.authManager = new AuthManager(this.gunDataProvider);
    this.syncManager = new SyncManager(this.gunDataProvider);
    this.peerManager = new PeerManager(this.gunDataProvider);
    this.pluginSystem = new PluginSystem();
    this.contextRouter = new ContextRouter(this.peerManager);
    this.networkMonitor = new NetworkMonitor(this.gunDataProvider);
    this.devTools = new DevTools(this.logger, this.networkMonitor, this.peerManager, this.syncManager, this.pluginSystem, this.gunDataProvider, this.authManager, this.contextRouter);
    this.componentRegistry = new ComponentRegistry(this.gunDataProvider);
    this.setupUpdateListeners();
  }

  getDataProvider(): GunDataProvider {
    return this.gunDataProvider;
  }

  getCurrentUserPair(): any {
    return this.authManager.getCurrentUser();
  }

  async publishComponent(component: Component<any, any>, schema: SchemaDefinition): Promise<void> {
    const currentUserPair = this.getCurrentUserPair();
    await component.publish(this.componentRegistry, currentUserPair, schema);
  }

  async loadComponent(address: string, schema: SchemaDefinition): Promise<ComponentInstance | null> {
    const userPair = this.getCurrentUserPair();
    const componentInstance = await Component.load(address, this.componentRegistry, userPair, this.gunDataProvider, this.syncManager, schema);
    if (componentInstance) {
      this.loadedComponents.set(address, componentInstance);
      await componentInstance.component.onMount();
    }
    return componentInstance;
  }

  async searchComponents(query: string, limit: number = 10): Promise<ComponentMetadata[]> {
    return this.componentRegistry.searchComponents(query, limit);
  }

  getLoadedComponent(address: string): ComponentInstance | undefined {
    return this.loadedComponents.get(address);
  }

  async unloadComponent(address: string): Promise<void> {
    const componentInstance = this.loadedComponents.get(address);
    if (componentInstance) {
      await componentInstance.component.onUnmount();
      this.loadedComponents.delete(address);
    }
  }

  private setupUpdateListeners(): void {
    this.componentRegistry.on('componentUpdate', this.handleComponentUpdate.bind(this));
  }

  private async handleComponentUpdate(event: ComponentUpdateEvent): Promise<void> {
    const loadedComponent = this.loadedComponents.get(event.id);
    if (loadedComponent) {
      const userPair = this.getCurrentUserPair();
      const updatedComponent = await Component.load(event.id, this.componentRegistry, userPair, this.gunDataProvider, this.syncManager, loadedComponent.state.getSchema());
      if (updatedComponent) {
        const prevProps = loadedComponent.component.props;
        const prevState = await loadedComponent.state.get();
        await this.unloadComponent(event.id);
        this.loadedComponents.set(event.id, updatedComponent);
        await updatedComponent.component.onUpdate(prevProps, prevState);
      }
    }
  }

  async initialize(): Promise<void> {
    await this.executeInAllContexts(async () => {
      await this.pluginSystem.broadcastToPlugins('onAppInitialize', this);
    });
  }

  async start(): Promise<void> {
    await this.initialize();
    this.logger.info('DecentralizedApp started', 'DecentralizedApp');
    this.emit('appStarted');
  }

  async stop(): Promise<void> {
    await this.executeInAllContexts(async () => {
      await this.peerManager.stop();
      await this.syncManager.stop();
      await this.pluginSystem.broadcastToPlugins('onAppStop', this);
    });
    this.logger.info('DecentralizedApp stopped', 'DecentralizedApp');
    this.emit('appStopped');
  }

  getAuthManager(): AuthManager {
    return this.authManager;
  }

  getSyncManager(): SyncManager {
    return this.syncManager;
  }

  getPeerManager(): PeerManager {
    return this.peerManager;
  }

  getPluginSystem(): PluginSystem {
    return this.pluginSystem;
  }

  getContextRouter(): ContextRouter {
    return this.contextRouter;
  }

  getDevTools(): DevTools {
    return this.devTools;
  }

  createDistributedState<T extends Object>(initialState: T, path: string, schema: SchemaDefinition): DistributedState<T> {
    return new DistributedState<T>(this.gunDataProvider, path, schema, initialState);
  }

  async route(path: string, data?: any): Promise<any> {
    return this.contextRouter.route(path, this, data);
  }

  async broadcastRoute(path: string, data?: any): Promise<any[]> {
    return this.contextRouter.broadcastRoute(path, this, data);
  }

  async executeInPeer(peerId: string, func: Function): Promise<any> {
    return this.peerManager.executeInPeerContext(peerId, func as any);
  }

  onPeerMessage(callback: (peerId: string, message: any) => void): void {
    this.peerManager.on('message', callback);
  }

  broadcastToPeers(message: any): void {
    this.peerManager.broadcast(message);
  }
}