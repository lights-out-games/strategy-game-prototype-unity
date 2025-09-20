import { NetworkManager, NetworkMessage } from '../network/NetworkManager';

export class ClientNetworkManager extends NetworkManager {
  private socket: WebSocket | null = null;
  private serverUrl: string;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;

  constructor(serverUrl: string = 'ws://localhost:8080') {
    super(false);
    this.serverUrl = serverUrl;
  }

  /**
   * Connect to the game server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(this.serverUrl);

        this.socket.onopen = () => {
          console.log('Connected to game server');
          this.reconnectAttempts = 0;
          this.handleClientConnect('self');
          resolve();
        };

        this.socket.onmessage = (event) => {
          try {
            const message = this.deserializeMessage(event.data);
            if (this.isValidMessage(message)) {
              this.handleMessage(message, 'server');
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.socket.onclose = (event) => {
          console.log('Disconnected from game server');
          this.handleDisconnect();
          
          if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
          }
        };

        this.socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect to the server
   */
  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`);
    
    setTimeout(() => {
      this.connect().catch(() => {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('Max reconnection attempts reached');
          this.emit('connectionFailed', { attempts: this.reconnectAttempts });
        }
      });
    }, delay);
  }

  /**
   * Handle disconnect event
   */
  private handleDisconnect(): void {
    this.socket = null;
    this.emit('disconnected', {});
  }

  /**
   * Send a message to the server
   */
  sendMessage(message: NetworkMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(this.serializeMessage(message));
    } else {
      console.warn('Cannot send message: not connected to server');
    }
  }

  /**
   * Broadcast message (same as sendMessage for client)
   */
  broadcastMessage(message: NetworkMessage): void {
    this.sendMessage(message);
  }

  /**
   * Join the game as a player
   */
  joinGame(playerName: string, playerId?: string): void {
    const message: NetworkMessage = {
      type: 'playerJoin',
      data: {
        name: playerName,
        playerId: playerId
      },
      timestamp: Date.now()
    };
    
    this.sendMessage(message);
  }

  /**
   * Leave the game
   */
  leaveGame(): void {
    const message: NetworkMessage = {
      type: 'playerLeave',
      data: {},
      timestamp: Date.now()
    };
    
    this.sendMessage(message);
  }

  /**
   * Check if connected to server
   */
  isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  getConnectionState(): string {
    if (!this.socket) return 'disconnected';
    
    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'connected';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'unknown';
    }
  }

  /**
   * Close connection to server
   */
  close(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.connections.clear();
    console.log('Client disconnected');
  }

  /**
   * Send ping to server
   */
  ping(): void {
    this.sendPing();
  }

  /**
   * Handle ping from server
   */
  protected handleMessage(message: NetworkMessage, clientId: string): void {
    if (message.type === 'ping') {
      this.sendPong('server');
      return;
    }

    if (message.type === 'pong') {
      // Update connection info
      const connection = this.connections.get('server');
      if (connection) {
        connection.lastPing = Date.now();
      }
      return;
    }

    // Call parent handler for other message types
    super.handleMessage(message, clientId);
  }

  /**
   * Set up automatic ping to server
   */
  startHeartbeat(intervalMs: number = 30000): void {
    setInterval(() => {
      if (this.isConnected()) {
        this.ping();
      }
    }, intervalMs);
  }
}
