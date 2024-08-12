import { Context } from '../Types';
import { PeerManager } from './PeerManager';

export const PEER_CONTEXT: Context = 'peer';

let peerManager: PeerManager | null = null;

export function initializePeerContext(manager: PeerManager): void {
  peerManager = manager;
}

export function isPeerContext(): boolean {
  return peerManager !== null;
}

export function executeInPeerContext(func: Function): any {
  if (isPeerContext()) {
    return func(peerManager);
  } else {
    throw new Error('Attempted to execute peer-specific code without an initialized PeerManager');
  }
}

export function getPeerId(): Promise<string> {
  if (!isPeerContext()) {
    throw new Error('Not in a peer context');
  }

  // Assuming PeerManager has a method to get the current peer's ID
  return Promise.resolve((peerManager as PeerManager).getCurrentPeerId());
}

export function getPeerConnections(): string[] {
  if (!isPeerContext()) {
    throw new Error('Not in a peer context');
  }

  // Assuming PeerManager has a method to get connected peer IDs
  return (peerManager as PeerManager).getConnectedPeerIds();
}

export function sendToPeer(peerId: string, data: any): void {
  if (!isPeerContext()) {
    throw new Error('Not in a peer context');
  }

  (peerManager as PeerManager).sendMessage(peerId, JSON.stringify(data));
}

export function broadcastToPeers(data: any): void {
  if (!isPeerContext()) {
    throw new Error('Not in a peer context');
  }

  (peerManager as PeerManager).broadcastMessage(JSON.stringify(data));
}

export function onPeerMessage(callback: (peerId: string, data: any) => void): void {
  if (!isPeerContext()) {
    throw new Error('Not in a peer context');
  }

  (peerManager as PeerManager).on('message', ({ peerId, message }) => {
    callback(peerId, JSON.parse(message));
  });
}

export function connectToPeer(peerId: string, peerUrl: string): void {
  if (!isPeerContext()) {
    throw new Error('Not in a peer context');
  }
  (peerManager as PeerManager).connectToPeer(peerId, peerUrl);
}

export function disconnectFromPeer(peerId: string): void {
  if (!isPeerContext()) {
    throw new Error('Not in a peer context');
  }

  (peerManager as PeerManager).disconnectFromPeer(peerId);
}

export function getPeerLatency(peerId: string): number {
  if (!isPeerContext()) {
    throw new Error('Not in a peer context');
  }

  return (peerManager as PeerManager).getPeerLatency(peerId);
}