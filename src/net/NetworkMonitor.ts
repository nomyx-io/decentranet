import { EventEmitter } from '../utils/EventEmitter';
import { NetworkStats, PeerInfo } from '../Types';
import { Logger } from '../Logger';
import { GunDataProvider } from '../data/GunDataProvider';

export class NetworkMonitor extends EventEmitter {
  private isOnline: boolean;
  private stats: NetworkStats;
  private checkInterval: number;
  private baseInterval: number;
  private maxInterval: number;
  private currentInterval: number;
  private intervalId: NodeJS.Timeout | null = null;
  private logger: Logger;
  private gunDataProvider: GunDataProvider;
  private lastInboundBytes: number = 0;
  private lastOutboundBytes: number = 0;
  private lastCheckTime: number = Date.now();
  private latencyHistory: number[] = [];
  private pingEndpoint: string;
  private bandwidthLimit: number | null = null;

  /**
   * Creates a new NetworkMonitor instance
   * @param gunDataProvider The GunDataProvider instance
   * @param checkInterval The initial check interval in milliseconds
   * @param pingEndpoint The endpoint to use for ping checks
   */
  constructor(gunDataProvider: GunDataProvider, checkInterval: number = 5000, pingEndpoint: string = '/ping') {
    super();
    this.isOnline = navigator.onLine;
    this.stats = {
      peers: 0,
      inbound: 0,
      outbound: 0,
      latency: 0
    };
    this.baseInterval = checkInterval;
    this.maxInterval = checkInterval * 60; // Max interval of 5 minutes
    this.currentInterval = checkInterval;
    this.checkInterval = checkInterval;
    this.logger = Logger.getInstance();
    this.gunDataProvider = gunDataProvider;
    this.pingEndpoint = pingEndpoint;
    this.init();
  }

  private init(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    this.startMonitoring();
  }

  private handleOnline = (): void => {
    this.isOnline = true;
    this.currentInterval = this.baseInterval; // Reset to base interval when online
    this.emit('connectionChange', true);
    this.logger.info('Network connection established', 'NetworkMonitor');
  };

  private handleOffline = (): void => {
    this.isOnline = false;
    this.emit('connectionChange', false);
    this.logger.warn('Network connection lost', 'NetworkMonitor');
  };

  private startMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(this.checkNetwork, this.currentInterval);
  }

  private checkNetwork = async (): Promise<void> => {
    try {
      const start = Date.now();
      const response = await fetch(this.pingEndpoint, { method: 'GET' });
      const latency = Date.now() - start;

      if (response.ok) {
        this.updateStats({
          latency: this.calculateRollingAverageLatency(latency),
          peers: this.getPeerCount(),
          inbound: this.getInboundTraffic(),
          outbound: this.getOutboundTraffic()
        });
        this.currentInterval = this.baseInterval; // Reset interval on successful check
      } else {
        throw new Error('Network check failed');
      }
    } catch (error) {
      this.logger.error('Network check error', 'NetworkMonitor', error);
      this.emit('error', error);
      this.incrementCheckInterval(); // Increase interval on failure
    }
    this.startMonitoring(); // Restart monitoring with potentially new interval
  };

  private incrementCheckInterval(): void {
    this.currentInterval = Math.min(this.currentInterval * 2, this.maxInterval);
    this.logger.debug(`Check interval increased to ${this.currentInterval}ms`, 'NetworkMonitor');
  }

  private calculateRollingAverageLatency(newLatency: number): number {
    this.latencyHistory.push(newLatency);
    if (this.latencyHistory.length > 10) {
      this.latencyHistory.shift();
    }
    return Math.round(this.latencyHistory.reduce((a, b) => a + b) / this.latencyHistory.length);
  }

  private updateStats(newStats: NetworkStats): void {
    this.stats = newStats;
    this.emit('statsUpdate', this.stats);
    this.logger.debug('Network stats updated', 'NetworkMonitor', this.stats);
  }

  private getPeerCount(): number {
    // Get the number of connected peers from Gun
    const peers = this.gunDataProvider.gun._.opt.peers;
    return Object.keys(peers).length;
  }

  private getInboundTraffic(): number {
    const currentBytes = this.gunDataProvider.gun._.graph['>'] || 0;
    const bytesReceived = currentBytes - this.lastInboundBytes;
    this.lastInboundBytes = currentBytes;
    
    const elapsedTime = (Date.now() - this.lastCheckTime) / 1000; // Convert to seconds
    this.lastCheckTime = Date.now();
    
    // Calculate bytes per second
    return Math.round(bytesReceived / elapsedTime);
  }

  private getOutboundTraffic(): number {
    const currentBytes = this.gunDataProvider.gun._.graph['<'] || 0;
    const bytesSent = currentBytes - this.lastOutboundBytes;
    this.lastOutboundBytes = currentBytes;
    
    const elapsedTime = (Date.now() - this.lastCheckTime) / 1000; // Convert to seconds
    this.lastCheckTime = Date.now();
    
    // Calculate bytes per second
    return Math.round(bytesSent / elapsedTime);
  }

  /**
   * Gets the current network stats
   * @returns The current NetworkStats
   */
  public getStats(): NetworkStats {
    return { ...this.stats };
  }

  /**
   * Checks if the network is currently online
   * @returns True if online, false otherwise
   */
  public isNetworkOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Sets the check interval
   * @param interval The new check interval in milliseconds
   */
  public setCheckInterval(interval: number): void {
    this.baseInterval = interval;
    this.currentInterval = interval;
    this.maxInterval = interval * 60;
    this.startMonitoring();
  }

  /**
   * Stops the network monitoring
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Cleans up the NetworkMonitor instance
   */
  public destroy(): void {
    this.stopMonitoring();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    this.logger.info('NetworkMonitor destroyed', 'NetworkMonitor');
  }

  /**
   * Simulates network latency
   * @param latency The latency to simulate in milliseconds
   */
  public simulateLatency(latency: number): void {
    this.updateStats({
      ...this.stats,
      latency
    });
  }

  /**
   * Sets a bandwidth limit for simulation purposes
   * @param limit The bandwidth limit in bytes per second, or null to remove the limit
   */
  public setBandwidthLimit(limit: number | null): void {
    this.bandwidthLimit = limit;
    this.logger.info(`Bandwidth limit set to ${limit ? limit + ' bytes/s' : 'unlimited'}`, 'NetworkMonitor');
  }

  /**
   * Gets detailed information about connected peers
   * @returns An array of PeerInfo objects
   */
  public getPeerInfo(): PeerInfo[] {
    const gunPeers = this.gunDataProvider.gun._.opt.peers;
    return Object.entries(gunPeers).map(([id, peer]: [string, any]) => ({
      id,
      url: peer.url,
      lastSeen: peer.lastSeen || Date.now()
    }));
  }

  /**
   * Sets a custom ping endpoint
   * @param endpoint The new ping endpoint
   */
  public setPingEndpoint(endpoint: string): void {
    this.pingEndpoint = endpoint;
    this.logger.info(`Ping endpoint set to ${endpoint}`, 'NetworkMonitor');
  }
}