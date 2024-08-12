import { EventEmitter } from '../utils/EventEmitter';
import { Logger } from '../Logger';
import { ErrorHandler } from '../ui/ErrorHandler';
import { GunDataProvider } from '../data/GunDataProvider';

interface PeerConnection {
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
}

export class WebRTCAdapter extends EventEmitter {
  private peerConnections: Map<string, PeerConnection> = new Map();
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private gunDataProvider: GunDataProvider;

  constructor(gunDataProvider: GunDataProvider) {
    super();
    this.logger = Logger.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.gunDataProvider = gunDataProvider;
    this.setupGunListeners();
  }

  private setupGunListeners(): void {
    this.gunDataProvider.gun.on('hi', this.handleNewPeer.bind(this));
    this.gunDataProvider.gun.on('bye', this.handlePeerDisconnect.bind(this));
  }

  private async handleNewPeer(peer: any): Promise<void> {
    try {
      const peerId = peer.id;
      if (!this.peerConnections.has(peerId)) {
        const offer = await this.createOffer(peerId);
        // Send offer through Gun
        this.gunDataProvider.gun.get(`webrtc/${peerId}/offer`).put(JSON.stringify(offer));
      }
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'WebRTCAdapter.handleNewPeer');
    }
  }

  private handlePeerDisconnect(peer: any): void {
    const peerId = peer.id;
    this.close(peerId);
  }

  async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.createPeerConnection(peerId);
    const offer = await peerConnection.connection.createOffer();
    await peerConnection.connection.setLocalDescription(offer);
    this.logger.debug('Offer created', 'WebRTCAdapter', { peerId });
    return offer;
  }

  async getCurrentPeerIds(): Promise<string[]> {
    return Array.from(this.peerConnections.keys());
  }

  async getCurrentPeerId(): Promise<string> {
    return this.gunDataProvider.gun.user().is?.pub || '';
  }

  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const peerConnection = this.createPeerConnection(peerId);
    await peerConnection.connection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.connection.createAnswer();
    await peerConnection.connection.setLocalDescription(answer);
    this.logger.debug('Offer handled and answer created', 'WebRTCAdapter', { peerId });
    return answer;
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      await peerConnection.connection.setRemoteDescription(new RTCSessionDescription(answer));
      this.logger.debug('Answer handled', 'WebRTCAdapter', { peerId });
    } else {
      throw new Error(`No peer connection found for peer ${peerId}`);
    }
  }

  async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      await peerConnection.connection.addIceCandidate(new RTCIceCandidate(candidate));
      this.logger.debug('ICE candidate added', 'WebRTCAdapter', { peerId });
    } else {
      throw new Error(`No peer connection found for peer ${peerId}`);
    }
  }

  sendMessage(peerId: string, message: string): void {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection && peerConnection.dataChannel.readyState === 'open') {
      peerConnection.dataChannel.send(message);
      this.logger.debug('Message sent via WebRTC', 'WebRTCAdapter', { peerId, message });
    } else {
      // Fallback to Gun if WebRTC is not available
      this.gunDataProvider.gun.get(`messages/${peerId}`).set(message);
      this.logger.debug('Message sent via Gun', 'WebRTCAdapter', { peerId, message });
    }
  }

  close(peerId: string): void {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      peerConnection.dataChannel.close();
      peerConnection.connection.close();
      this.peerConnections.delete(peerId);
      this.logger.debug('Peer connection closed', 'WebRTCAdapter', { peerId });
    }
  }

  private createPeerConnection(peerId: string): PeerConnection {
    const connection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    const dataChannel = connection.createDataChannel('dataChannel');

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate through Gun
        this.gunDataProvider.gun.get(`webrtc/${peerId}/ice`).set(JSON.stringify(event.candidate));
      }
    };

    connection.onconnectionstatechange = () => {
      this.logger.debug('Connection state changed', 'WebRTCAdapter', { 
        peerId, 
        state: connection.connectionState 
      });
      this.emit('connectionStateChange', { peerId, state: connection.connectionState });
    };

    dataChannel.onopen = () => {
      this.logger.debug('Data channel opened', 'WebRTCAdapter', { peerId });
      this.emit('dataChannelOpen', { peerId });
    };

    dataChannel.onclose = () => {
      this.logger.debug('Data channel closed', 'WebRTCAdapter', { peerId });
      this.emit('dataChannelClose', { peerId });
    };

    dataChannel.onmessage = (event) => {
      this.logger.debug('Message received via WebRTC', 'WebRTCAdapter', { peerId, message: event.data });
      this.emit('message', { peerId, message: event.data });
    };

    const peerConnection: PeerConnection = { connection, dataChannel };
    this.peerConnections.set(peerId, peerConnection);

    return peerConnection;
  }

  stop(): void {
    for (const peerId of this.peerConnections.keys()) {
      this.close(peerId);
    }
  }

  // Listen for WebRTC signaling messages from Gun
  listenForSignaling(): void {
    const currentPeerId = this.gunDataProvider.gun.user().is?.pub;
    if (!currentPeerId) {
      this.logger.error('No current peer ID available', 'WebRTCAdapter');
      return;
    }

    this.gunDataProvider.gun.get(`webrtc/${currentPeerId}/offer`).on(async (offerData: any) => {
      if (offerData) {
        const offer = JSON.parse(offerData);
        const peerId = offer.peerId; // Assume peerId is included in the offer
        const answer = await this.handleOffer(peerId, offer);
        this.gunDataProvider.gun.get(`webrtc/${peerId}/answer`).put(JSON.stringify(answer));
      }
    });

    this.gunDataProvider.gun.get(`webrtc/${currentPeerId}/answer`).on(async (answerData: any) => {
      if (answerData) {
        const answer = JSON.parse(answerData);
        const peerId = answer.peerId; // Assume peerId is included in the answer
        await this.handleAnswer(peerId, answer);
      }
    });

    this.gunDataProvider.gun.get(`webrtc/${currentPeerId}/ice`).on(async (iceData: any) => {
      if (iceData) {
        const ice = JSON.parse(iceData);
        const peerId = ice.peerId; // Assume peerId is included in the ICE candidate
        await this.addIceCandidate(peerId, ice);
      }
    });   
  }

  // Method to initiate WebRTC connection
  async initiateWebRTCConnection(peerId: string): Promise<void> {
    try {
      const offer = await this.createOffer(peerId);
      this.gunDataProvider.gun.get(`webrtc/${peerId}/offer`).put(JSON.stringify({...offer, peerId: this.getCurrentPeerId()}));
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'WebRTCAdapter.initiateWebRTCConnection');
    }
  }

   // Method to check if WebRTC is supported in the current environment
   isWebRTCSupported(): boolean {
    return 'RTCPeerConnection' in window;
  }

  // Method to get WebRTC connection state for a peer
  getConnectionState(peerId: string): RTCPeerConnectionState | null {
    const peerConnection = this.peerConnections.get(peerId);
    return peerConnection ? peerConnection.connection.connectionState : null;
  }

  // Method to restart ICE for a peer connection
  async restartIce(peerId: string): Promise<void> {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      try {
        const offer = await peerConnection.connection.createOffer({ iceRestart: true });
        await peerConnection.connection.setLocalDescription(offer);
        this.gunDataProvider.gun.get(`webrtc/${peerId}/offer`).put(JSON.stringify({...offer, peerId: this.getCurrentPeerId()}));
      } catch (error) {
        this.errorHandler.handleError(error as Error, 'WebRTCAdapter.restartIce');
      }
    } else {
      throw new Error(`No peer connection found for peer ${peerId}`);
    }
  }

  // Method to add a new data channel to an existing peer connection
  addDataChannel(peerId: string, label: string): RTCDataChannel | null {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      const dataChannel = peerConnection.connection.createDataChannel(label);
      this.setupDataChannelListeners(dataChannel, peerId);
      return dataChannel;
    }
    return null;
  }

  private setupDataChannelListeners(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.onopen = () => {
      this.logger.debug(`Data channel ${dataChannel.label} opened`, 'WebRTCAdapter', { peerId });
      this.emit('dataChannelOpen', { peerId, label: dataChannel.label });
    };

    dataChannel.onclose = () => {
      this.logger.debug(`Data channel ${dataChannel.label} closed`, 'WebRTCAdapter', { peerId });
      this.emit('dataChannelClose', { peerId, label: dataChannel.label });
    };

    dataChannel.onmessage = (event) => {
      this.logger.debug(`Message received on channel ${dataChannel.label}`, 'WebRTCAdapter', { peerId, message: event.data });
      this.emit('message', { peerId, message: event.data, channel: dataChannel.label });
    };
  }

  // Method to get all active data channels for a peer
  getDataChannels(peerId: string): RTCDataChannel[] {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      return (peerConnection.connection.sctp?.transport as any).dataChannels || [];
    }
    return [];
  }

  // Method to send a file over WebRTC
  async sendFile(peerId: string, file: File): Promise<void> {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection && peerConnection.dataChannel.readyState === 'open') {
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        peerConnection.dataChannel.send(JSON.stringify({
          type: 'file',
          name: file.name,
          data: event.target?.result
        }));
      };
      fileReader.readAsArrayBuffer(file);
    } else {
      throw new Error(`Unable to send file to peer ${peerId}`);
    }
  }

  // Method to handle received file data
  private handleFileReceive(peerId: string, fileData: any): void {
    const blob = new Blob([fileData.data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    this.emit('fileReceived', { peerId, fileName: fileData.name, url });
  }
}