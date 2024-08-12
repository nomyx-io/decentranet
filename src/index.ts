// Core
export { Component } from './core/Component';
export { DecentralizedApp } from './core/DecentralizedApp';
export { MultiContextObject } from './core/MultiContextObject';
export { PluginSystem } from './core/PluginSystem';
export { ContextRouter } from './core/ContextRouter';
export { ComponentRegistry } from './core/ComponentRegistry';

// UI
export { ReactiveUI } from './ui/ReactiveUI';

// Data
export { DistributedState } from './data/DistributedState';
export { GunDataProvider } from './data/GunDataProvider';
export { GunNode } from './data/GunNode';
export { GunQuery } from './data/GunQuery';
export { IndexedDBAdapter } from './data/IndexedDBAdapter';
export { TypedSchema } from './data/TypedSchema';

// Auth
export { AuthManager } from './auth/AuthManager';
export { CryptoUtils } from './auth/CryptoUtils';
export { SEA } from './auth/SEA';

// Net
export { NetworkMonitor } from './net/NetworkMonitor';
export { PeerManager } from './net/PeerManager';
export { SyncManager } from './net/SyncManager';
export { WebRTCAdapter } from './net/WebRTCAdapter';

// Utils
export { EventEmitter } from './utils/EventEmitter';
export { ConfigManager } from './utils/ConfigManager';
export * from './utils/Decorators';
export * from './utils/Constants';

// Dev
export { DevTools } from './dev/DevTools';
export { Performance } from './dev/Performance';
export { FaultInjector } from './dev/FaultInjector';

// Types
export * from './Types';

// Contexts
export { BROWSER_CONTEXT, isBrowserContext, executeInBrowserContext } from './ui/BrowserContext';
export { SERVER_CONTEXT, isServerContext, executeInServerContext } from './net/ServerContext';
export { PEER_CONTEXT, isPeerContext, executeInPeerContext } from './net/PeerContext';

// Other
export { Logger } from './Logger';
export { ErrorHandler } from './ui/ErrorHandler';
export { SandboxedEnvironment } from './env/SandboxedEnvironment';

// Constants
export const VERSION = '1.0.0'; // Replace with actual version number

// Plugin decorator
export { Plugin } from './core/PluginSystem';

// Measure decorators
export { Measure, MeasureAsync } from './dev/Performance';

// Fault injector decorator
export { InjectFault } from './dev/FaultInjector';