import { EventEmitter } from '../utils/EventEmitter';
import { GunDataProvider } from '../data/GunDataProvider';
import { NetworkGraph, PeerInfo, TopologyAnalysis } from '../Types';
import { Logger } from '../Logger';
import { ErrorHandler } from '../ui/ErrorHandler';

export class PeerManager extends EventEmitter {
  private gunDataProvider: GunDataProvider;
  private peers: Map<string, PeerInfo> = new Map();
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor(gunDataProvider: GunDataProvider) {
    super();
    this.gunDataProvider = gunDataProvider;
    this.logger = Logger.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.setupGunListeners();
  }

  generateNetworkGraph(): NetworkGraph {
    const graph: NetworkGraph = {
      nodes: [],
      edges: []
    };

    this.peers.forEach((peer, peerId) => {
      graph.nodes.push({ id: peerId, data: peer });
    });

    // For simplicity, we're assuming all peers are connected to each other
    // In a real implementation, you'd need to determine actual connections
    this.peers.forEach((peer, peerId) => {
      this.peers.forEach((otherPeer, otherPeerId) => {
        if (peerId !== otherPeerId) {
          graph.edges.push({ source: peerId, target: otherPeerId });
        }
      });
    });

    return graph;
  }

  analyzeTopology(): TopologyAnalysis {
    const graph = this.generateNetworkGraph();
    const analysis: TopologyAnalysis = {
      totalPeers: graph.nodes.length,
      totalConnections: graph.edges.length,
      averageConnections: graph.edges.length / graph.nodes.length,
      centralPeers: this.findCentralPeers(graph)
    };
    return analysis;
  }

  private findCentralPeers(graph: NetworkGraph): string[] {
    // This is a simple implementation. In a real-world scenario,
    // you might want to use more sophisticated network analysis algorithms.
    const connectionCounts = new Map<string, number>();
    graph.edges.forEach(edge => {
      connectionCounts.set(edge.source, (connectionCounts.get(edge.source) || 0) + 1);
      connectionCounts.set(edge.target, (connectionCounts.get(edge.target) || 0) + 1);
    });

    const averageConnections = graph.edges.length / graph.nodes.length;
    return Array.from(connectionCounts.entries())
      .filter(([_, count]) => count > averageConnections)
      .map(([peerId, _]) => peerId);
  }

  async measureLatency(peerId: string): Promise<number> {
    const startTime = Date.now();
    try {
      await this.sendToPeer(peerId, { type: 'PING' });
      const endTime = Date.now();
      return endTime - startTime;
    } catch (error) {
      this.logger.error('Failed to measure latency', 'PeerManager', { peerId, error });
      return -1;
    }
  }

  connectToPeer(peerId: string, peerUrl: string): void {
    // Gun doesn't provide a direct method to connect to a specific peer
    // Instead, we'll just add the peer to our local list and start listening to it
    this.addPeer(peerId, peerUrl);
    this.gunDataProvider.gun.get(`messages/${peerId}`).on(() => {});
    this.emit('peerConnected', { id: peerId, url: peerUrl });
  }

  disconnectFromPeer(peerId: string): void {
    // Gun doesn't provide a direct method to disconnect from a specific peer
    // Instead, we'll remove the peer from our local list and stop listening to it
    this.removePeer(peerId);
    this.gunDataProvider.gun.get(`messages/${peerId}`).off();
    this.emit('peerDisconnected', { id: peerId });
  }

  sendToPeer(peerId: string, message: any): void {
    this.sendMessage(peerId, message);
  }

  broadcast(message: any): void {
    this.broadcastMessage(message);
  }

  getCurrentPeerId(): string {
    const publicKey = this.getCurrentPeerPublicKey();
    return publicKey || 'anonymous';
  }

  executeInPeerContext(peerId: string, callback: (peer: any) => void): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      try {
        callback(peer);
      } catch (error) {
        this.errorHandler.handleError(error as Error, 'PeerManager.executeInPeerContext');
      }
    } else {
      this.logger.warn('Peer not found', 'PeerManager', { peerId });
    }
  }

  private setupGunListeners(): void {
    this.gunDataProvider.gun.on('hi', this.handlePeerConnected.bind(this));
    this.gunDataProvider.gun.on('bye', this.handlePeerDisconnected.bind(this));
  }

  /**
   * Handles a new peer connection
   * @param peer The connected peer
   */
  private handlePeerConnected(peer: any): void {
    const peerId = peer.id;
    const peerUrl = peer.url;
    this.addPeer(peerId, peerUrl);
    this.logger.info('Peer connected', 'PeerManager', { peerId, peerUrl });
    this.emit('peerConnected', { id: peerId, url: peerUrl });
  }

  /**
   * Handles a peer disconnection
   * @param peer The disconnected peer
   */
  private handlePeerDisconnected(peer: any): void {
    const peerId = peer.id;
    this.removePeer(peerId);
    this.logger.info('Peer disconnected', 'PeerManager', { peerId });
    this.emit('peerDisconnected', { id: peerId });
  }

  /**
   * Adds a new peer to the connected peers list
   * @param peerId The ID of the peer
   * @param peerUrl The URL of the peer
   */
  private addPeer(peerId: string, peerUrl: string): void {
    this.peers.set(peerId, { id: peerId, url: peerUrl, lastSeen: Date.now() });
    this.logger.info('Peer added', 'PeerManager', { peerId, peerUrl });
  }

  /**
   * Removes a peer from the connected peers list
   * @param peerId The ID of the peer to remove
   */
  private removePeer(peerId: string): void {
    this.peers.delete(peerId);
    this.logger.info('Peer removed', 'PeerManager', { peerId });
  }

  /**
   * Gets the latency for a specific peer
   * @param peerId The ID of the peer
   * @returns The latency in milliseconds, or -1 if the peer is not found
   */
  getPeerLatency(peerId: string): number {
    const peer = this.peers.get(peerId);
    if (peer) {
      return Date.now() - peer.lastSeen;
    }
    return -1;
  }

  /**
   * Gets the IDs of all connected peers
   * @returns An array of peer IDs
   */
  getConnectedPeerIds(): string[] {
    return Array.from(this.peers.keys());
  }

  /**
   * Gets information about all connected peers
   * @returns An array of PeerInfo objects
   */
  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  /**
   * Sends a message to a specific peer
   * @param peerId The ID of the peer
   * @param message The message to send
   */
  sendMessage(peerId: string, message: any): void {
    try {
      this.gunDataProvider.gun.get(`messages/${peerId}`).set(message);
      this.logger.debug('Message sent to peer', 'PeerManager', { peerId, message });
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PeerManager.sendMessage');
    }
  }

  /**
   * Broadcasts a message to all connected peers
   * @param message The message to broadcast
   */
  broadcastMessage(message: any): void {
    this.gunDataProvider.gun.get('broadcast').set(message);
    this.logger.debug('Message broadcasted', 'PeerManager', { message });
  }

  /**
   * Listens for messages from a specific peer
   * @param peerId The ID of the peer to listen to
   * @param callback The function to call when a message is received
   */
  listenToPeer(peerId: string, callback: (message: any) => void): void {
    this.gunDataProvider.gun.get(`messages/${peerId}`).on(callback);
  }

  /**
   * Listens for broadcast messages
   * @param callback The function to call when a broadcast message is received
   */
  listenToBroadcasts(callback: (message: any) => void): void {
    this.gunDataProvider.gun.get('broadcast').on(callback);
  }

  /**
   * Authenticates the current peer
   * @param alias The alias for the peer
   * @param password The password for authentication
   * @returns A promise that resolves when authentication is complete
   */
  async authenticate(alias: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gunDataProvider.gun.user().auth(alias, password, (ack: any) => {
        if (ack.err) {
          this.logger.error('Authentication failed', 'PeerManager', ack.err);
          reject(new Error(ack.err));
        } else {
          this.logger.info('Authentication successful', 'PeerManager', { alias });
          resolve();
        }
      });
    });
  }

  /**
   * Creates a new peer account
   * @param alias The alias for the new peer
   * @param password The password for the new peer
   * @returns A promise that resolves when account creation is complete
   */
  async createAccount(alias: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gunDataProvider.gun.user().create(alias, password, (ack: any) => {
        if (ack.err) {
          this.logger.error('Account creation failed', 'PeerManager', ack.err);
          reject(new Error(ack.err));
        } else {
          this.logger.info('Account created successfully', 'PeerManager', { alias });
          resolve();
        }
      });
    });
  }

  /**
   * Gets the current authenticated peer's public key
   * @returns The public key of the current peer, or null if not authenticated
   */
  getCurrentPeerPublicKey(): string | null {
    const user = this.gunDataProvider.gun.user();
    return user.is ? user.is.pub : null;
  }

  /**
   * Stops the PeerManager and cleans up resources
   */
  stop(): void {
    // Gun will automatically handle peer disconnections
    this.peers.clear();
    this.logger.info('PeerManager stopped', 'PeerManager');
    this.emit('stopped');
  }

}