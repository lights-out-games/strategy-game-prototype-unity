import * as WebSocket from 'ws';
import { NetworkManager, NetworkMessage, ClientConnection } from '../network/NetworkManager';

export class ServerNetworkManager extends NetworkManager {
  private server: WebSocket.Server;
  private clientSockets: Map<string, WebSocket> = new Map();

  constructor(port: number = 8080) {
    super(true);
    this.server = new WebSocket.Server({ port });
    this.setupServer();
    console.log(`WebSocket server started on port ${port}`);
  }

  private setupServer(): void {
    this.server.on('connection', (socket: WebSocket) => {
      const clientId = this.generateClientId();
      this.clientSockets.set(clientId, socket);
      this.handleClientConnect(clientId);

      socket.on('message', (data: WebSocket.Data) => {
        try {
          const message = this.deserializeMessage(data.toString());
          if (this.isValidMessage(message)) {
            this.handleIncomingMessage(message, clientId);
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      socket.on('close', () => {
        this.clientSockets.delete(clientId);
        this.handleClientDisconnect(clientId);
      });

      socket.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.handleClientDisconnect(clientId);
      });

      // Send initial connection confirmation
      this.sendMessage({
        type: 'playerJoin',
        data: { clientId },
        timestamp: Date.now()
      }, clientId);
    });

    // Start ping interval and cleanup
    this.startPingInterval();
    setInterval(() => this.cleanupConnections(), 30000);
  }

  private handleIncomingMessage(message: NetworkMessage, clientId: string): void {
    // Update last ping time
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.lastPing = Date.now();
    }

    // Handle ping/pong
    if (message.type === 'ping') {
      this.sendPong(clientId);
      return;
    }

    if (message.type === 'pong') {
      // Just update the ping time, already done above
      return;
    }

    // Handle other messages
    this.handleMessage(message, clientId);
  }

  sendMessage(message: NetworkMessage, clientId?: string): void {
    if (clientId) {
      const socket = this.clientSockets.get(clientId);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(this.serializeMessage(message));
      }
    } else {
      this.broadcastMessage(message);
    }
  }

  broadcastMessage(message: NetworkMessage): void {
    const serializedMessage = this.serializeMessage(message);
    
    for (const [clientId, socket] of this.clientSockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(serializedMessage);
      } else {
        // Clean up dead connections
        this.clientSockets.delete(clientId);
        this.handleClientDisconnect(clientId);
      }
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the number of connected clients
   */
  getConnectedClientCount(): number {
    return this.clientSockets.size;
  }

  /**
   * Kick a client from the server
   */
  kickClient(clientId: string, reason?: string): void {
    const socket = this.clientSockets.get(clientId);
    if (socket) {
      if (reason) {
        this.sendMessage({
          type: 'playerLeave',
          data: { reason },
          timestamp: Date.now()
        }, clientId);
      }
      
      socket.close();
      this.clientSockets.delete(clientId);
      this.handleClientDisconnect(clientId);
    }
  }

  /**
   * Set player ID for a client connection
   */
  setClientPlayerId(clientId: string, playerId: string): void {
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.playerId = playerId;
    }
  }

  /**
   * Get client ID by player ID
   */
  getClientIdByPlayerId(playerId: string): string | undefined {
    for (const [clientId, connection] of this.connections) {
      if (connection.playerId === playerId) {
        return clientId;
      }
    }
    return undefined;
  }

  /**
   * Send message to a specific player
   */
  sendMessageToPlayer(message: NetworkMessage, playerId: string): void {
    const clientId = this.getClientIdByPlayerId(playerId);
    if (clientId) {
      this.sendMessage(message, clientId);
    }
  }

  close(): void {
    // Close all client connections
    for (const socket of this.clientSockets.values()) {
      socket.close();
    }
    
    // Close the server
    this.server.close();
    
    // Clear connections
    this.clientSockets.clear();
    this.connections.clear();
    
    console.log('Server closed');
  }
}
