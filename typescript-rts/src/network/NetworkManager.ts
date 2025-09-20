import { GameAction, GameStateSnapshot } from '../core/GameState';

export interface NetworkMessage {
  type: 'gameAction' | 'gameState' | 'playerJoin' | 'playerLeave' | 'ping' | 'pong';
  data: any;
  timestamp: number;
  playerId?: string;
}

export interface ClientConnection {
  id: string;
  playerId?: string;
  isConnected: boolean;
  lastPing: number;
}

export abstract class NetworkManager {
  protected connections: Map<string, ClientConnection> = new Map();
  protected messageHandlers: Map<string, Function[]> = new Map();
  protected isServer: boolean;

  constructor(isServer: boolean = false) {
    this.isServer = isServer;
  }

  /**
   * Send a message to a specific client or all clients
   */
  abstract sendMessage(message: NetworkMessage, clientId?: string): void;

  /**
   * Broadcast a message to all connected clients
   */
  abstract broadcastMessage(message: NetworkMessage): void;

  /**
   * Handle incoming messages
   */
  protected handleMessage(message: NetworkMessage, clientId: string): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message, clientId));
    }
  }

  /**
   * Register a message handler
   */
  on(messageType: string, handler: Function): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
  }

  /**
   * Remove a message handler
   */
  off(messageType: string, handler: Function): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get all connected clients
   */
  getConnections(): Map<string, ClientConnection> {
    return new Map(this.connections);
  }

  /**
   * Check if a client is connected
   */
  isClientConnected(clientId: string): boolean {
    const connection = this.connections.get(clientId);
    return connection ? connection.isConnected : false;
  }

  /**
   * Send game action to server or clients
   */
  sendGameAction(action: GameAction, clientId?: string): void {
    const message: NetworkMessage = {
      type: 'gameAction',
      data: action,
      timestamp: Date.now(),
      playerId: action.playerId
    };
    this.sendMessage(message, clientId);
  }

  /**
   * Send game state update
   */
  sendGameState(gameState: GameStateSnapshot, clientId?: string): void {
    const message: NetworkMessage = {
      type: 'gameState',
      data: gameState,
      timestamp: Date.now()
    };
    
    if (clientId) {
      this.sendMessage(message, clientId);
    } else {
      this.broadcastMessage(message);
    }
  }

  /**
   * Send ping to check connection
   */
  sendPing(clientId?: string): void {
    const message: NetworkMessage = {
      type: 'ping',
      data: {},
      timestamp: Date.now()
    };
    
    if (clientId) {
      this.sendMessage(message, clientId);
    } else {
      this.broadcastMessage(message);
    }
  }

  /**
   * Send pong response
   */
  sendPong(clientId: string): void {
    const message: NetworkMessage = {
      type: 'pong',
      data: {},
      timestamp: Date.now()
    };
    this.sendMessage(message, clientId);
  }

  /**
   * Start ping interval to check connections
   */
  protected startPingInterval(intervalMs: number = 30000): void {
    setInterval(() => {
      this.sendPing();
    }, intervalMs);
  }

  /**
   * Clean up disconnected clients
   */
  protected cleanupConnections(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds timeout

    for (const [clientId, connection] of this.connections) {
      if (now - connection.lastPing > timeout) {
        this.handleClientDisconnect(clientId);
      }
    }
  }

  /**
   * Handle client disconnect
   */
  protected handleClientDisconnect(clientId: string): void {
    const connection = this.connections.get(clientId);
    if (connection) {
      connection.isConnected = false;
      this.emit('clientDisconnected', { clientId, connection });
    }
  }

  /**
   * Handle client connect
   */
  protected handleClientConnect(clientId: string): void {
    const connection: ClientConnection = {
      id: clientId,
      isConnected: true,
      lastPing: Date.now()
    };
    
    this.connections.set(clientId, connection);
    this.emit('clientConnected', { clientId, connection });
  }

  /**
   * Emit events
   */
  protected emit(event: string, data: any): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  /**
   * Serialize message for transmission
   */
  protected serializeMessage(message: NetworkMessage): string {
    return JSON.stringify(message);
  }

  /**
   * Deserialize message from transmission
   */
  protected deserializeMessage(data: string): NetworkMessage {
    return JSON.parse(data);
  }

  /**
   * Validate message format
   */
  protected isValidMessage(message: any): message is NetworkMessage {
    return message &&
           typeof message.type === 'string' &&
           message.data !== undefined &&
           typeof message.timestamp === 'number';
  }

  /**
   * Close all connections and cleanup
   */
  abstract close(): void;
}
