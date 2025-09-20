import { GameState, GameAction, Player, Unit } from '../core/GameState';
import { ServerNetworkManager } from './ServerNetworkManager';
import { NetworkMessage } from '../network/NetworkManager';

export class GameServer {
  private gameState: GameState;
  private networkManager: ServerNetworkManager;
  private gameId: string;
  private maxPlayers: number;

  constructor(gridWidth: number = 20, gridHeight: number = 20, port: number = 8080, maxPlayers: number = 4) {
    this.gameState = new GameState(gridWidth, gridHeight);
    this.networkManager = new ServerNetworkManager(port);
    this.gameId = this.generateGameId();
    this.maxPlayers = maxPlayers;
    
    this.setupEventHandlers();
    console.log(`Game server started with ID: ${this.gameId}`);
  }

  private setupEventHandlers(): void {
    // Handle client connections
    this.networkManager.on('clientConnected', ({ clientId }: { clientId: string }) => {
      console.log(`Client connected: ${clientId}`);
      
      // Send current game state to new client
      this.networkManager.sendGameState(this.gameState.getSnapshot(), clientId);
    });

    this.networkManager.on('clientDisconnected', ({ clientId }: { clientId: string }) => {
      console.log(`Client disconnected: ${clientId}`);
      
      // Find and remove player associated with this client
      const connection = this.networkManager.getConnections().get(clientId);
      if (connection && connection.playerId) {
        this.removePlayer(connection.playerId);
      }
    });

    // Handle game actions from clients
    this.networkManager.on('gameAction', (message: NetworkMessage, clientId: string) => {
      const action = message.data as GameAction;
      
      // Validate that the action comes from the correct client
      const connection = this.networkManager.getConnections().get(clientId);
      if (!connection || connection.playerId !== action.playerId) {
        console.warn(`Invalid action from client ${clientId}: player mismatch`);
        return;
      }

      // Execute the action
      const success = this.gameState.executeAction(action);
      
      if (success) {
        // Broadcast the action to all clients
        this.networkManager.broadcastMessage({
          type: 'gameAction',
          data: action,
          timestamp: Date.now()
        });

        // Send updated game state
        this.broadcastGameState();
      } else {
        // Send error back to client
        this.networkManager.sendMessage({
          type: 'gameAction',
          data: { error: 'Action failed', action },
          timestamp: Date.now()
        }, clientId);
      }
    });

    // Handle player join requests
    this.networkManager.on('playerJoin', (message: NetworkMessage, clientId: string) => {
      const playerData = message.data;
      
      if (this.gameState.getPlayers().size >= this.maxPlayers) {
        this.networkManager.sendMessage({
          type: 'playerJoin',
          data: { error: 'Game is full' },
          timestamp: Date.now()
        }, clientId);
        return;
      }

      const player: Player = {
        id: playerData.playerId || this.generatePlayerId(),
        name: playerData.name || `Player ${this.gameState.getPlayers().size + 1}`,
        color: playerData.color || this.getNextPlayerColor(),
        isActive: true,
        resources: { gold: 100, wood: 50, stone: 25 }
      };

      this.gameState.addPlayer(player);
      this.networkManager.setClientPlayerId(clientId, player.id);

      // Confirm player join
      this.networkManager.sendMessage({
        type: 'playerJoin',
        data: { player, success: true },
        timestamp: Date.now()
      }, clientId);

      // Broadcast to other players
      this.networkManager.broadcastMessage({
        type: 'playerJoin',
        data: { player },
        timestamp: Date.now()
      });

      console.log(`Player joined: ${player.name} (${player.id})`);

      // Auto-start game if we have enough players
      if (this.gameState.getPlayers().size >= 2 && this.gameState.getSnapshot().gamePhase === 'setup') {
        this.startGame();
      }
    });

    // Handle game state events
    this.gameState.on('gameStarted', () => {
      this.spawnInitialUnits();
      this.broadcastGameState();
    });

    this.gameState.on('gameEnded', ({ winner }: { winner: string }) => {
      console.log(`Game ended. Winner: ${winner}`);
      this.broadcastGameState();
    });

    this.gameState.on('turnEnded', () => {
      this.broadcastGameState();
    });
  }

  private generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generatePlayerId(): string {
    return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getNextPlayerColor(): string {
    const colors = ['#FF0000', '#0000FF', '#00FF00', '#FFFF00', '#FF00FF', '#00FFFF'];
    const playerCount = this.gameState.getPlayers().size;
    return colors[playerCount % colors.length];
  }

  private startGame(): void {
    try {
      this.gameState.startGame();
      console.log('Game started');
    } catch (error) {
      console.error('Failed to start game:', error);
    }
  }

  private spawnInitialUnits(): void {
    const players = Array.from(this.gameState.getPlayers().values());
    const grid = this.gameState.getGrid();
    
    // Spawn starting units for each player in corners
    const spawnPositions = [
      { q: 1, r: 1 },
      { q: grid.getWidth() - 2, r: 1 },
      { q: 1, r: grid.getHeight() - 2 },
      { q: grid.getWidth() - 2, r: grid.getHeight() - 2 }
    ];

    players.forEach((player, index) => {
      if (index < spawnPositions.length) {
        const position = spawnPositions[index];
        
        // Spawn a basic warrior unit
        const unit: Unit = {
          id: `unit_${player.id}_${Date.now()}`,
          playerId: player.id,
          type: 'warrior',
          position,
          health: 100,
          maxHealth: 100,
          movementRange: 3,
          attackRange: 1,
          attackDamage: 25,
          hasActed: false,
          hasMoved: false
        };

        this.gameState.addUnit(unit);
      }
    });
  }

  private removePlayer(playerId: string): void {
    this.gameState.removePlayer(playerId);
    
    // Broadcast player removal
    this.networkManager.broadcastMessage({
      type: 'playerLeave',
      data: { playerId },
      timestamp: Date.now()
    });

    this.broadcastGameState();
  }

  private broadcastGameState(): void {
    this.networkManager.sendGameState(this.gameState.getSnapshot());
  }

  /**
   * Get current game statistics
   */
  getGameStats(): any {
    const snapshot = this.gameState.getSnapshot();
    return {
      gameId: this.gameId,
      playerCount: snapshot.players.size,
      unitCount: snapshot.units.size,
      buildingCount: snapshot.buildings.size,
      turn: snapshot.turn,
      currentPlayer: snapshot.currentPlayerId,
      gamePhase: snapshot.gamePhase,
      connectedClients: this.networkManager.getConnectedClientCount()
    };
  }

  /**
   * Force start the game (admin command)
   */
  forceStartGame(): boolean {
    if (this.gameState.getPlayers().size < 1) {
      return false;
    }
    
    try {
      this.startGame();
      return true;
    } catch (error) {
      console.error('Failed to force start game:', error);
      return false;
    }
  }

  /**
   * Reset the game
   */
  resetGame(): void {
    // Create new game state
    const grid = this.gameState.getGrid();
    this.gameState = new GameState(grid.getWidth(), grid.getHeight(), grid.getHexSize());
    
    // Re-setup event handlers
    this.setupEventHandlers();
    
    // Broadcast reset to all clients
    this.networkManager.broadcastMessage({
      type: 'gameState',
      data: this.gameState.getSnapshot(),
      timestamp: Date.now()
    });

    console.log('Game reset');
  }

  /**
   * Shutdown the server
   */
  shutdown(): void {
    console.log('Shutting down game server...');
    this.networkManager.close();
  }
}
