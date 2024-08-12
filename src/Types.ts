export type Context = 'browser' | 'server' | 'peer';
import { Component } from './core/Component';
import { DistributedState } from './data/DistributedState';

export type VNodeType = string | Function;

export interface VNodeProps {
 [key: string]: any;
}

export interface VNode {
 type: VNodeType;
 props: VNodeProps;
 component?: Function;
 children: (VNode | string)[];
 key?: string | number;
 tag?: string;
}

export type PatchType = 'CREATE' | 'UPDATE' | 'REPLACE' | 'REMOVE' | 'REORDER';

export interface Patch {
 type: PatchType;
 node?: VNode;
 index?: number;
 props?: VNodeProps;
 from?: number;
 to?: number;
}

export interface NetworkGraph {
  nodes: { id: string; data: PeerInfo }[];
  edges: { source: string; target: string }[];
}

export interface TopologyAnalysis {
  totalPeers: number;
  totalConnections: number;
  averageConnections: number;
  centralPeers: string[];
}

export interface ErrorInfo {
  code: string;
  message: string;
  stack?: string | undefined;
  context?: string | undefined;
}
// Add these to your Types.ts file if not already present
export type ErrorCategory = 'TYPE_ERROR' | 'REFERENCE_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR';
export type ErrorHandlingStrategy = (error: Error, errorInfo: ErrorInfo) => void;
export interface ErrorReportingConfig {
  endpoint: string;
}

export interface ContextSwitch {
  from: Context;
  to: Context;
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

export interface ComponentMetadata {
  id: string; // Unique identifier for the component
  name: string;
  version: string;
  author: string;
  description: string;
  tags: string[];
  dependencies: { [key: string]: string };
  acl: AccessControlList;
  signature: string; // Digital signature of the component
}

// Types.ts
export type RouteHandler = (context: RouteContext) => Promise<any> | any;

export interface PeerManager {
  sendToPeer(peerId: string, message: any): void;
  broadcast(message: any): void;
}

export interface RouteContext {
  path: string;
  params: RouteParams;
  data?: any;
  context: Context;
  peerManager: PeerManager;
}

export interface Middleware {
  (context: any): Promise<void>;
}

export interface RouteOptions {
  auth?: boolean;
  middleware?: Middleware[];
}

export interface RouteConfig {
  handler: RouteHandler;
  options: RouteOptions;
}

export interface RouteMatch {
  routeConfig: Map<Context, RouteConfig>;
  params: RouteParams;
}

export interface RouteParams {
  [key: string]: string;
}

export interface AccessControlList {
  type: 'public' | 'private' | 'shared';
  allowedUsers?: string[]; // Public keys of allowed users
}

export interface ComponentPackage {
  metadata: any;
  code: string;
  state?: any;
  schema?: SchemaDefinition;
}

export interface ComponentState {
  [key: string]: any;
}

export interface ComponentProps {
  [key: string]: any;
}

export interface PeerMessage {
  type: string;
  data: any;
}

export interface EncryptedComponentPackage {
  metadata: string; // Encrypted JSON string
  code: string; // Encrypted code
  state?: string; // Encrypted initial state
  encryptedKey: { [userPubKey: string]: string }; // Encrypted symmetric key for each allowed user
}

export interface ComponentInstance {
  component: Component<any, any>;
  state: DistributedState<any>;
}

export interface ComponentUpdateEvent {
  id: string;
  version: string;
  changes: string[]; // List of changes in the new version
}

export interface GunDataProviderOptions {
  peers?: string[];
  localStorage?: boolean;
  radisk?: boolean;
  multicast?: boolean;
}

export interface MultiContextObjectOptions {
  id: string;
  type: string;
  contexts: Context[];
}

export interface DecoratorOptions {
  context?: Context;
  name?: string;
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
  ct: string; // ciphertext
  iv: string; // initialization vector
  s: string;  // salt
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

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

export enum SyncPriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high'
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

export interface ComponentConfig {
  name: string;
  template: string;
  styles?: string;
}

export interface RouteDefinition {
  path: string;
  component: any;
  children?: RouteDefinition[];
}

export interface ErrorInfo {
  code: string;
  message: string;
  stack?: string;
  context?: string | undefined;
}