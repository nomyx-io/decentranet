declare module '@nomyx/decentranet' {
  import { EventEmitter } from 'events';

  export type Context = 'browser' | 'server' | 'peer';

  export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

  export type SyncPriority = 'low' | 'normal' | 'high';

  export interface ComponentMetadata {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    tags: string[];
    dependencies: { [key: string]: string };
    acl: AccessControlList;
    signature: string;
  }

  export interface AccessControlList {
    type: 'public' | 'private' | 'shared';
    allowedUsers?: string[];
  }

  export interface ComponentPackage {
    metadata: ComponentMetadata;
    code: string;
    state?: any;
    schema?: SchemaDefinition;
  }

  export interface EncryptedComponentPackage {
    metadata: string;
    code: string;
    state?: string;
    encryptedKey: { [userPubKey: string]: string };
  }

  export interface ComponentInstance {
    component: Component<any, any>;
    state: DistributedState<any>;
  }

  export interface ComponentUpdateEvent {
    id: string;
    version: string;
    changes: string[];
  }

  export interface GunDataProviderOptions {
    peers?: string[];
    localStorage?: boolean;
    radisk?: boolean;
    multicast?: boolean;
  }

  export interface AuthCredentials {
    username: string;
    password: string;
  }

  export interface User {
    alias: string;
    pub: string;
  }

  export interface EncryptedData {
    ct: string;
    iv: string;
    s: string;
  }

  export interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: number;
    context?: string;
    data?: any;
  }

  export interface PeerInfo {
    id: string;
    url: string;
    lastSeen: number;
  }

  export interface SyncStatus {
    lastSyncTime: number;
    pendingChanges: number;
    priority: SyncPriority;
    isPaused: boolean;
  }

  export interface PluginMetadata {
    name: string;
    version: string;
    description: string;
    author: string;
  }

  export interface Plugin {
    metadata: PluginMetadata;
    initialize: () => Promise<void>;
    destroy: () => Promise<void>;
  }

  export interface SchemaDefinition {
    [key: string]: 'string' | 'number' | 'boolean' | 'object' | 'array' | SchemaDefinition;
  }

  export interface QueryOptions {
    limit?: number;
    skip?: number;
    sort?: {[key: string]: 'asc' | 'desc'};
  }

  export interface NetworkStats {
    peers: number;
    inbound: number;
    outbound: number;
    latency: number;
  }

  export type Unsubscribe = () => void;

  export interface ErrorInfo {
    code: string;
    message: string;
    stack?: string;
    context?: string;
  }

  export type ErrorCategory = 'TYPE_ERROR' | 'REFERENCE_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
  export type ErrorHandlingStrategy = (error: Error, errorInfo: ErrorInfo) => void;

  export interface ErrorReportingConfig {
    endpoint: string;
  }

  export interface ContextState {
    active: boolean;
    data: Record<string, any>;
    context: Context;
  }

  export interface ContextTransition {
    from: Context;
    to: Context;
  }

  export interface RouteContext {
    path: string;
    params: RouteParams;
    data?: any;
    context: Context;
    peerManager: PeerManager;
  }

  export interface Middleware {
    (context: RouteContext): Promise<void>;
  }

  export interface RouteOptions {
    auth?: boolean;
    middleware?: Middleware[];
  }

  export interface RouteConfig {
    handler: RouteHandler;
    options: RouteOptions;
  }

  export interface RouteParams {
    [key: string]: string;
  }

  export type RouteHandler = (context: RouteContext) => Promise<any> | any;

  // ComponentState
  export interface ComponentState {
    [key: string]: any;
  }

  // ComponentProps
  export interface ComponentProps {
    [key: string]: any;
  }

  export class Component<S extends ComponentState, P extends ComponentProps> extends MultiContextObject {
    protected ui: ReactiveUI;
    protected state: DistributedState<S>;
    public props: P;
    protected peerManager: PeerManager;
    protected syncManager: SyncManager;

    constructor(
      contexts: Context[],
      dataProvider: GunDataProvider,
      schema: SchemaDefinition,
      initialState: S,
      props: P,
      peerManager: PeerManager,
      syncManager: SyncManager
    );

    render(): string;
    publish(registry: ComponentRegistry, currentUserPair: any, schema: SchemaDefinition): Promise<void>;
    onMount(): void;
    onUnmount(): void;
    onUpdate(prevProps: any, prevState: any): void;
    protected setState(newState: Partial<S>, broadcast?: boolean): void;
    update(): void;
    mount(element: HTMLElement): void;
    unmount(): void;
    updateProps(newProps: Partial<P>): void;

    static load(
      address: string,
      registry: ComponentRegistry,
      userPair: any,
      dataProvider: GunDataProvider,
      syncManager: SyncManager,
      schema: SchemaDefinition
    ): Promise<ComponentInstance | null>;
  }

  export class ComponentRegistry extends EventEmitter {
    constructor(gun: GunDataProvider);

    getComponent(address: string, userPair: any): Promise<ComponentPackage | null>;
    getComponentSchema(address: string, userPair: any): Promise<any>;
    searchComponents(query: string, limit?: number): Promise<ComponentMetadata[]>;
    publishComponent(component: ComponentPackage, currentUserPair: any): Promise<void>;
    updateComponentAccess(componentId: string, newAcl: AccessControlList, currentUserPair: any): Promise<void>;
  }

  export class DecentralizedApp extends MultiContextObject {
    constructor(gun: GunDataProvider);

    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    getAuthManager(): AuthManager;
    getSyncManager(): SyncManager;
    getPeerManager(): PeerManager;
    getPluginSystem(): PluginSystem;
    getContextRouter(): ContextRouter;
    getDevTools(): DevTools;
    getDataProvider(): GunDataProvider;
    createDistributedState<T extends Object>(initialState: T, path: string, schema: SchemaDefinition): DistributedState<T>;
    route(path: string, data?: any): Promise<any>;
    broadcastRoute(path: string, data?: any): Promise<any[]>;
    executeInPeer(peerId: string, func: Function): Promise<any>;
    onPeerMessage(callback: (peerId: string, message: any) => void): void;
    broadcastToPeers(message: any): void;
    getCurrentUserPair(): any;
    publishComponent(component: Component<any, any>, schema: SchemaDefinition): Promise<void>;
    loadComponent(address: string, schema: SchemaDefinition): Promise<ComponentInstance | null>;
    searchComponents(query: string, limit?: number): Promise<ComponentMetadata[]>;
    getLoadedComponent(address: string): ComponentInstance | undefined;
    unloadComponent(address: string): Promise<void>;
  }

  export class MultiContextObject extends EventEmitter {
    constructor(contexts: Context[]);

    isValidContext(context: Context): boolean;
    getCurrentContext(): Context;
    getContextState(context: Context): ContextState | undefined;
    setContextData(context: Context, key: string, value: any): void;
    getContextData(context: Context, key: string): any;
    switchContext(newContext: Context): Promise<void>;
    executeInContext<T>(context: Context, func: () => Promise<T> | T): Promise<T>;
    executeInAllContexts<T>(func: (context: Context) => Promise<T> | T): Promise<Map<Context, T>>;
    executeInMultipleContexts<T>(contexts: Context[], func: (context: Context) => Promise<T> | T): Promise<Map<Context, T>>;
    onContextActivated(callback: (context: Context) => void): void;
    onContextDeactivated(callback: (context: Context) => void): void;
    onBeforeContextSwitch(callback: (transition: ContextTransition) => void): void;
    onAfterContextSwitch(callback: (transition: ContextTransition) => void): void;
    withContext<T>(context: Context, func: () => Promise<T> | T): Promise<T>;
    isContextActive(context: Context): boolean;
    getActiveContexts(): Context[];
    broadcastToActiveContexts<T>(func: (context: Context) => Promise<T> | T): Promise<Map<Context, T>>;
  }

  export class PluginSystem extends EventEmitter {
    registerPlugin(plugin: Plugin): Promise<void>;
    unregisterPlugin(pluginName: string): Promise<void>;
    getPlugin(pluginName: string): Plugin | undefined;
    getAllPlugins(): Plugin[];
    registerHook(hookName: string, callback: Function): void;
    unregisterHook(hookName: string, callback: Function): void;
    broadcastToPlugins(event: string, ...args: any[]): void;
    executeHook(hookName: string, ...args: any[]): Promise<any[]>;
    initializeAllPlugins(): Promise<void>;
    destroyAllPlugins(): Promise<void>;
    isPluginRegistered(pluginName: string): boolean;
    getPluginMetadata(pluginName: string): PluginMetadata | undefined;
    getAllPluginMetadata(): PluginMetadata[];
    reloadPlugin(pluginName: string): Promise<void>;
    getHooks(): string[];
    clearHooks(): void;
  }

  export class ContextRouter extends EventEmitter {
    constructor(peerManager: PeerManager);

    addRoute(path: string, context: Context, handler: RouteHandler, options?: RouteOptions): void;
    use(middleware: Middleware): void;
    route(path: string, multiContextObject: MultiContextObject, data?: any): Promise<any>;
    broadcastRoute(path: string, multiContextObject: MultiContextObject, data?: any): Promise<any[]>;
    routeToPeer(peerId: string, path: string, data?: any): Promise<any>;
    getRoutes(): Map<string, Map<Context, RouteConfig>>;
    clearRoutes(): void;
    removeRoute(path: string, context?: Context): void;
  }

  export class VNode {
    constructor(tag: string, props: Record<string, any>, children: VNode[], key?: string);
    static create(tag: string, props: Record<string, any>, children: VNode[], key?: string): VNode;
  }

  export class ReactiveUI extends EventEmitter {
    constructor();

    mount(element: HTMLElement): void;
    unmount(): void;
    update(newVDOM: VNode): void;
    getComponentInstance(id: string): Component<any, any> | undefined;
    updateComponentProps(id: string, newProps: any): void;
  }

  export class DistributedState<T extends object> extends EventEmitter {
    constructor(gunDataProvider: GunDataProvider, path: string, schema: SchemaDefinition);

    get(): Promise<T>;
    set(data: Partial<T>): Promise<void>;
    update(updater: (currentState: T) => Partial<T>): Promise<void>;
    subscribe(listener: (state: T, oldState: T) => void): Unsubscribe;
    getSchema(): SchemaDefinition;
    validate(data: any): boolean;
    reset(): Promise<void>;
    getId(): string;
    transaction(transactionFn: (currentState: T) => Partial<T>): Promise<void>;
    getCurrentState(): T;
    refresh(): Promise<void>;
  }

  export class GunDataProvider extends EventEmitter {
    constructor(options?: GunDataProviderOptions);

    getNode<T>(path: string): GunNode<T>;
    createQuery<T>(path: string): GunQuery<T>;
    put(path: string, data: any): Promise<void>;
    get(path: string): Promise<any>;
    set(path: string, data: any): Promise<void>;
    onUpdate(path: string, callback: (data: any) => void): void;
    offUpdate(path: string, callback: (data: any) => void): void;
    createUser(username: string, password: string): Promise<any>;
    login(username: string, password: string): Promise<any>;
    logout(): void;
    getCurrentUser(): any;
    isAuthenticated(): boolean;
    generateUuid(): string;
    getServerTime(): Promise<number>;
  }

  export class GunNode<T = any> extends EventEmitter {
    constructor(gun: any, path: string);

    put(data: Partial<T>): Promise<void>;
    get(): Promise<T | null>;
    set(data: T): Promise<void>;
    map(): GunNode<T>;
    each(callback: (data: T, key: string) => void | Promise<void>): Promise<void>;
  }

  export class GunQuery<T> {
    constructor(node: GunNode<T>);

    find(predicate: (item: T) => boolean, options?: QueryOptions): Promise<T[]>;
    findOne(predicate: (item: T) => boolean): Promise<T | null>;
    count(predicate?: (item: T) => boolean): Promise<number>;
    update(predicate: (item: T) => boolean, updateFn: (item: T) => Partial<T>): Promise<number>;
    delete(predicate: (item: T) => boolean): Promise<number>;
    map<R>(mapper: (item: T) => R): GunQuery<R>;
    filter(predicate: (item: T) => boolean): GunQuery<T>;
  }

  export class IndexedDBAdapter {
    constructor(dbName: string, dbVersion: number, stores: string[]);

    connect(): Promise<void>;
    put(storeName: string, data: any): Promise<void>;
    get(storeName: string, id: string): Promise<any>;
    delete(storeName: string, id: string): Promise<void>;
    getAll(storeName: string): Promise<any[]>;
    clear(storeName: string): Promise<void>;
    disconnect(): void;
  }

  export class TypedSchema {
    constructor(schema: SchemaDefinition);

    validate(data: any): boolean;
    cast(data: any): any;
    getDefaultValue(): any;
  }

  export class AuthManager extends EventEmitter {
    constructor(gunDataProvider: GunDataProvider);

    register(credentials: AuthCredentials): Promise<User>;
    login(credentials: AuthCredentials): Promise<User>;
    logout(): void;
    getCurrentUser(): User | null;
    isAuthenticated(): boolean;
    changePassword(currentPassword: string, newPassword: string): Promise<void>;
    resetPassword(username: string, resetToken: string, newPassword: string): Promise<void>;
    requestPasswordReset(username: string): Promise<void>;
  }

  export class CryptoUtils {
    static encrypt(data: string, key?: string): Promise<EncryptedData>;
    static decrypt(encryptedData: EncryptedData): Promise<string>;
    static hash(data: string): Promise<string>;
    static generateRandomId(length?: number): string;
  }

  export class SEA {
    static pair(): Promise<any>;
    static encrypt(data: any, pair: any): Promise<string>;
    static decrypt(encryptedData: string, pair: any): Promise<any>;
    static sign(data: any, pair: any): Promise<string>;
    static verify(signedData: string, pair: any): Promise<any>;
    static work(data: string, salt: string, options?: any): Promise<string>;
    static certify(certificants: string | string[], policy: any, authority: any, expiry?: number, cb?: any): Promise<string>;
    static recall(props: any, cb?: any): Promise<any>;
    static secret(key: any, pair: any, cb?: any): Promise<string>;
    static derive(passphrase: string, salt?: string, options?: any): Promise<{ epriv: string; epub: string }>;
    static authenticateUser(alias: string, password: string): Promise<any>;
    static createUser(alias: string, password: string): Promise<any>;
  }

  export class NetworkMonitor extends EventEmitter {
    constructor(gunDataProvider: GunDataProvider, checkInterval?: number, pingEndpoint?: string);

    getStats(): NetworkStats;
    isNetworkOnline(): boolean;
    setCheckInterval(interval: number): void;
    stopMonitoring(): void;
    destroy(): void;
    simulateLatency(latency: number): void;
    setBandwidthLimit(limit: number | null): void;
    getPeerInfo(): PeerInfo[];
    setPingEndpoint(endpoint: string): void;
  }

  export class NetworkGraph {
    nodes: { id: string; label: string; group: number }[];
    edges: { from: string; to: string }[];
  }

  export class TopologyAnalysis {
    averageDegree: number;
    averageClusteringCoefficient: number;
    averageShortestPath: number;
    diameter: number;
    density: number;
    connectedComponents: number;
  }
  
  export class PeerManager extends EventEmitter {
    constructor(gunDataProvider: GunDataProvider);

    generateNetworkGraph(): NetworkGraph;
    analyzeTopology(): TopologyAnalysis;
    measureLatency(peerId: string): Promise<number>;
    connectToPeer(peerId: string, peerUrl: string): void;
    disconnectFromPeer(peerId: string): void;
    sendToPeer(peerId: string, message: any): void;
    broadcast(message: any): void;
    getCurrentPeerId(): string;
    executeInPeerContext(peerId: string, callback: (peer: any) => void): void;
    getPeerLatency(peerId: string): number;
    getConnectedPeerIds(): string[];
    getPeers(): PeerInfo[];
    sendMessage(peerId: string, message: any): void;
    broadcastMessage(message: any): void;
    listenToPeer(peerId: string, callback: (message: any) => void): void;
    listenToBroadcasts(callback: (message: any) => void): void;
    authenticate(alias: string, password: string): Promise<void>;
    createAccount(alias: string, password: string): Promise<void>;
    getCurrentPeerPublicKey(): string | null;
    stop(): void;
  }

  export class SyncManager extends EventEmitter {
    constructor(gunDataProvider: GunDataProvider);

    startSync(path: string, priority?: SyncPriority): void;
    stopSync(path: string): void;
    getSyncedPaths(): string[];
    getSyncStatus(path: string): SyncStatus | undefined;
    getDistributedState<T>(path: string): DistributedState<any> | null;
    fetchStateFromPeers<T>(path: string): Promise<T | null>;
    syncState<T extends object>(path: string, schema: SchemaDefinition): DistributedState<T>;
    persistState<T>(path: string, schema: SchemaDefinition): DistributedState<any>;
    loadPersistedState<T>(path: string): Promise<T | null>;
    forceSyncAll(): Promise<void>;
    forceSync(path: string): Promise<void>;
    getPendingChangesCount(): number;
    isSyncInProgress(): boolean;
    pauseSync(path: string): void;
    resumeSync(path: string): void;
    stop(): void;
  }

  export class WebRTCAdapter extends EventEmitter {
    constructor(gunDataProvider: GunDataProvider);

    createOffer(peerId: string): Promise<RTCSessionDescriptionInit>;
    getCurrentPeerIds(): Promise<string[]>;
    getCurrentPeerId(): Promise<string>;
    handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit>;
    handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void>;
    addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void>;
    sendMessage(peerId: string, message: string): void;
    close(peerId: string): void;
    listenForSignaling(): void;
    initiateWebRTCConnection(peerId: string): Promise<void>;
    isWebRTCSupported(): boolean;
    getConnectionState(peerId: string): RTCPeerConnectionState | null;
    restartIce(peerId: string): Promise<void>;
    addDataChannel(peerId: string, label: string): RTCDataChannel | null;
    getDataChannels(peerId: string): RTCDataChannel[];
    sendFile(peerId: string, file: File): Promise<void>;
  }

  export class DevTools extends EventEmitter {
    constructor(
      logger: Logger,
      networkMonitor: NetworkMonitor,
      peerManager: PeerManager,
      syncManager: SyncManager,
      pluginSystem: PluginSystem,
      gunDataProvider: GunDataProvider,
      authManager: AuthManager,
      contextRouter: ContextRouter
    );

    getLogs(filter?: { level?: string; context?: string }): LogEntry[];
    getNetworkStats(): NetworkStats;
    getPeers(): PeerInfo[];
    getSyncStatus(): { path: string; status: SyncStatus }[];
    inspectDistributedState(statePath: string): DistributedState<any> | null;
    monitorStateChanges(statePath: string, callback: (newState: any) => void): Unsubscribe;
    generateNetworkGraph(): NetworkGraph;
    analyzeNetworkTopology(): TopologyAnalysis;
    measurePeerLatency(peerId: string): Promise<number>;
    startPerformanceProfile(label: string): void;
    stopPerformanceProfile(label: string): any;
    injectFault(faultType: string, options: any): void;
    simulatePeerDisconnection(peerId: string): void;
    simulateNetworkLatency(latency: number): void;
    startRecording(): void;
    stopRecording(): any[];
    replayEvents(events: any[]): void;
    getLoadedPlugins(): Plugin[];
    inspectPlugin(pluginName: string): Plugin | undefined;
    inspectGunData(path: string): Promise<any>;
    getCurrentUser(): User | null;
    getRoutes(): Map<string, Map<Context, RouteConfig>>;
    clearLogs(): void;
    exportDevToolsState(): any;
    importDevToolsState(state: any): void;
    enableRemoteDebugging(port: number): void;
    sendRemoteCommand(command: string, params: any): Promise<any>;
  }

  export class Logger {
    static getInstance(): Logger;
    setLogLevel(level: LogLevel): void;
    debug(message: string, context?: string, data?: any): void;
    info(message: string, context?: string, data?: any): void;
    warn(message: string, context?: string, data?: any): void;
    error(message: string, context?: string, data?: any): void;
    getLogs(): LogEntry[];
    clearLogs(): void;
    exportLogs(): string;
    importLogs(logsJson: string): void;
  }

  export class ErrorHandler {
    static getInstance(): ErrorHandler;
    handleError(error: Error, context?: string): void;
    handleAsyncError<T>(promise: Promise<T>, context?: string): Promise<T>;
    registerGlobalErrorHandlers(): void;
    setStrategy(category: ErrorCategory, strategy: ErrorHandlingStrategy): void;
    configureErrorReporting(config: ErrorReportingConfig): void;
    attemptErrorRecovery(error: Error): boolean;
  }

  export class Performance extends EventEmitter {
    startTiming(label: string): void;
    endTiming(label: string): number;
    recordMetric(name: string, value: number): void;
    trackMemoryUsage(interval?: number): () => void;
    getTimings(label: string): { start: number; end: number; duration: number }[];
    getMetric(name: string): { count: number; total: number; min: number; max: number; average: number } | undefined;
    getAllMetrics(): Map<string, { count: number; total: number; min: number; max: number; average: number }>;
    clearTimings(): void;
    clearMetrics(): void;
    generateReport(): string;
    measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T>;
    measure<T>(label: string, fn: () => T): T;
    startProfiling(label: string): void;
    endProfiling(label: string): void;
  }

  export class FaultInjector extends EventEmitter {
    addFault(name: string, config: { probability: number; type: string; details?: any }): void;
    removeFault(name: string): void;
    injectFault(name: string, options?: any): Promise<void>;
    getAllFaults(): { name: string; config: { probability: number; type: string; details?: any } }[];
    clearAllFaults(): void;
    injectRandomFault(): Promise<void>;
    setGlobalFaultProbability(probability: number): void;
  }

  export class SandboxedEnvironment {
    constructor();
    evaluate(code: string): any;
    runFunction(func: Function, ...args: any[]): any;
    setGlobal(key: string, value: any): void;
    getGlobal(key: string): any;
  }

  export function contextMethod(context: Context): MethodDecorator;
  export function multiContext(...contexts: Context[]): MethodDecorator;
  export function logMethod(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor;
  export function retry(maxAttempts?: number, delay?: number): MethodDecorator;
  export function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor;
  export function debounce(delay?: number): MethodDecorator;
  export function throttle(limit?: number): MethodDecorator;

  export const BROWSER_CONTEXT: Context;
  export const SERVER_CONTEXT: Context;
  export const PEER_CONTEXT: Context;

  export function isBrowserContext(): boolean;
  export function executeInBrowserContext(func: Function): any;
  export function isServerContext(): boolean;
  export function executeInServerContext(func: Function): any;
  export function isPeerContext(): boolean;
  export function executeInPeerContext(func: Function): any;
}