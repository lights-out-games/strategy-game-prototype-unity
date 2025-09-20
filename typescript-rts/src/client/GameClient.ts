import { GameState, GameAction, Player, Unit, GameStateSnapshot } from '../core/GameState';
import { ClientNetworkManager } from './ClientNetworkManager';
import { NetworkMessage } from '../network/NetworkManager';
import { HexCoordinate } from '../core/HexGrid';

export class GameClient {
  private gameState: GameState;
  private networkManager: ClientNetworkManager;
  private playerId: string | null = null;
  private playerName: string;
  private isConnected: boolean = false;

  constructor(playerName: string, serverUrl: string = 'ws://localhost:8080') {
    this.playerName = playerName;
    this.gameState = new GameState(20, 20); // Default size, will be updated from server
    this.networkManager = new ClientNetworkManager(serverUrl);
    
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle connection events
    this.networkManager.on('clientConnected', () => {
      this.isConnected = true;
      this.emit('connected', {});
      
      // Join the game automatically
      this.networkManager.joinGame(this.playerName);
    });

    this.networkManager.on('disconnected', () => {
      this.isConnected = false;
      this.emit('disconnected', {});
    });

    this.networkManager.on('connectionFailed', ({ attempts }: { attempts: number }) => {
      this.emit('connectionFailed', { attempts });
    });

    // Handle game state updates from server
    this.networkManager.on('gameState', (message: NetworkMessage) => {
      const serverGameState = message.data as GameStateSnapshot;
      this.updateGameStateFromServer(serverGameState);
      this.emit('gameStateUpdated', { gameState: this.gameState.getSnapshot() });
    });

    // Handle game actions from server
    this.networkManager.on('gameAction', (message: NetworkMessage) => {
      const action = message.data as GameAction;
      
      // Apply the action to local game state
      this.gameState.executeAction(action);
      this.emit('actionExecuted', { action });
    });

    // Handle player join/leave events
    this.networkManager.on('playerJoin', (message: NetworkMessage) => {
      const data = message.data;
      
      if (data.success && data.player) {
        // This is our player join confirmation
        if (data.player.name === this.playerName) {
          this.playerId = data.player.id;
          this.emit('playerJoined', { player: data.player, isLocalPlayer: true });
        } else {
          this.emit('playerJoined', { player: data.player, isLocalPlayer: false });
        }
      } else if (data.error) {
        this.emit('joinError', { error: data.error });
      }
    });

    this.networkManager.on('playerLeave', (message: NetworkMessage) => {
      const { playerId } = message.data;
      this.emit('playerLeft', { playerId });
    });
  }

  /**
   * Connect to the game server
   */
  async connect(): Promise<void> {
    try {
      await this.networkManager.connect();
      this.networkManager.startHeartbeat();
    } catch (error) {
      console.error('Failed to connect to server:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the server
   */
  disconnect(): void {
    if (this.isConnected) {
      this.networkManager.leaveGame();
    }
    this.networkManager.close();
  }

  /**
   * Update local game state from server
   */
  private updateGameStateFromServer(serverState: GameStateSnapshot): void {
    // Create new game state with server data
    const grid = this.gameState.getGrid();
    this.gameState = new GameState(grid.getWidth(), grid.getHeight(), grid.getHexSize());
    
    // Add players
    for (const player of serverState.players.values()) {
      this.gameState.addPlayer(player);
    }

    // Add units
    for (const unit of serverState.units.values()) {
      this.gameState.addUnit(unit);
    }

    // Add buildings
    for (const building of serverState.buildings.values()) {
      this.gameState.addBuilding(building);
    }

    // Update game phase and turn info
    if (serverState.gamePhase === 'playing') {
      this.gameState.startGame();
    }
  }

  /**
   * Move a unit
   */
  moveUnit(unitId: string, newPosition: HexCoordinate): boolean {
    if (!this.playerId || !this.isConnected) {
      return false;
    }

    const unit = this.gameState.getUnits().get(unitId);
    if (!unit || unit.playerId !== this.playerId) {
      return false;
    }

    const action: GameAction = {
      id: this.generateActionId(),
      playerId: this.playerId,
      type: 'move',
      timestamp: Date.now(),
      data: {
        unitId,
        position: newPosition
      }
    };

    this.networkManager.sendGameAction(action);
    return true;
  }

  /**
   * Attack with a unit
   */
  attackUnit(attackerId: string, targetId: string): boolean {
    if (!this.playerId || !this.isConnected) {
      return false;
    }

    const attacker = this.gameState.getUnits().get(attackerId);
    if (!attacker || attacker.playerId !== this.playerId) {
      return false;
    }

    const action: GameAction = {
      id: this.generateActionId(),
      playerId: this.playerId,
      type: 'attack',
      timestamp: Date.now(),
      data: {
        attackerId,
        targetId
      }
    };

    this.networkManager.sendGameAction(action);
    return true;
  }

  /**
   * End current turn
   */
  endTurn(): boolean {
    if (!this.playerId || !this.isConnected) {
      return false;
    }

    const currentPlayerId = this.gameState.getCurrentPlayerId();
    if (currentPlayerId !== this.playerId) {
      return false; // Not our turn
    }

    const action: GameAction = {
      id: this.generateActionId(),
      playerId: this.playerId,
      type: 'endTurn',
      timestamp: Date.now(),
      data: {}
    };

    this.networkManager.sendGameAction(action);
    return true;
  }

  /**
   * Get current game state
   */
  getGameState(): GameStateSnapshot {
    return this.gameState.getSnapshot();
  }

  /**
   * Get local player ID
   */
  getPlayerId(): string | null {
    return this.playerId;
  }

  /**
   * Get local player
   */
  getLocalPlayer(): Player | undefined {
    if (!this.playerId) return undefined;
    return this.gameState.getPlayers().get(this.playerId);
  }

  /**
   * Check if it's the local player's turn
   */
  isMyTurn(): boolean {
    return this.playerId === this.gameState.getCurrentPlayerId();
  }

  /**
   * Get units belonging to local player
   */
  getMyUnits(): Unit[] {
    if (!this.playerId) return [];
    
    return Array.from(this.gameState.getUnits().values())
      .filter(unit => unit.playerId === this.playerId);
  }

  /**
   * Get valid moves for a unit
   */
  getValidMoves(unitId: string): HexCoordinate[] {
    const unit = this.gameState.getUnits().get(unitId);
    if (!unit) return [];

    const grid = this.gameState.getGrid();
    const possibleMoves = grid.getHexesInRange(unit.position, unit.movementRange);
    
    // Filter out occupied positions
    return possibleMoves.filter(pos => {
      const tile = this.gameState.getTile(pos);
      return tile && !tile.unitId && !tile.isBlocked;
    });
  }

  /**
   * Get valid attack targets for a unit
   */
  getValidTargets(unitId: string): Unit[] {
    const unit = this.gameState.getUnits().get(unitId);
    if (!unit) return [];

    const grid = this.gameState.getGrid();
    const attackRange = grid.getHexesInRange(unit.position, unit.attackRange);
    
    return Array.from(this.gameState.getUnits().values())
      .filter(target => 
        target.playerId !== unit.playerId &&
        attackRange.some(pos => 
          pos.q === target.position.q && pos.r === target.position.r
        )
      );
  }

  /**
   * Check connection status
   */
  getConnectionStatus(): string {
    return this.networkManager.getConnectionState();
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `action_${this.playerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Event system
   */
  private eventListeners: Map<string, Function[]> = new Map();

  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
}
