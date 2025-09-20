import { HexCoordinate, HexGrid } from './HexGrid';

export interface Unit {
  id: string;
  playerId: string;
  type: string;
  position: HexCoordinate;
  health: number;
  maxHealth: number;
  movementRange: number;
  attackRange: number;
  attackDamage: number;
  hasActed: boolean;
  hasMoved: boolean;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  resources: { [key: string]: number };
}

export interface Tile {
  coordinate: HexCoordinate;
  terrain: string;
  movementCost: number;
  isBlocked: boolean;
  unitId?: string;
  buildingId?: string;
}

export interface Building {
  id: string;
  playerId: string;
  type: string;
  position: HexCoordinate;
  health: number;
  maxHealth: number;
  isConstructed: boolean;
}

export interface GameAction {
  id: string;
  playerId: string;
  type: 'move' | 'attack' | 'build' | 'endTurn' | 'spawn';
  timestamp: number;
  data: any;
}

export interface GameStateSnapshot {
  turn: number;
  currentPlayerId: string;
  players: Map<string, Player>;
  units: Map<string, Unit>;
  buildings: Map<string, Building>;
  tiles: Map<string, Tile>;
  actionHistory: GameAction[];
  gamePhase: 'setup' | 'playing' | 'ended';
  winner?: string;
}

export class GameState {
  private grid: HexGrid;
  private turn: number = 1;
  private currentPlayerIndex: number = 0;
  private players: Map<string, Player> = new Map();
  private units: Map<string, Unit> = new Map();
  private buildings: Map<string, Building> = new Map();
  private tiles: Map<string, Tile> = new Map();
  private actionHistory: GameAction[] = [];
  private gamePhase: 'setup' | 'playing' | 'ended' = 'setup';
  private winner?: string;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(gridWidth: number, gridHeight: number, hexSize: number = 1) {
    this.grid = new HexGrid(gridWidth, gridHeight, hexSize);
    this.initializeTiles();
  }

  /**
   * Initialize all tiles on the grid
   */
  private initializeTiles(): void {
    for (let q = 0; q < this.grid.getWidth(); q++) {
      for (let r = 0; r < this.grid.getHeight(); r++) {
        const coordinate: HexCoordinate = { q, r };
        const tile: Tile = {
          coordinate,
          terrain: 'grass',
          movementCost: 1,
          isBlocked: false
        };
        this.tiles.set(this.grid.coordToKey(coordinate), tile);
      }
    }
  }

  /**
   * Add a player to the game
   */
  addPlayer(player: Player): void {
    this.players.set(player.id, player);
    this.emit('playerAdded', { player });
  }

  /**
   * Remove a player from the game
   */
  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      // Remove all units and buildings belonging to this player
      this.removePlayerAssets(playerId);
      this.emit('playerRemoved', { playerId, player });
    }
  }

  /**
   * Remove all units and buildings belonging to a player
   */
  private removePlayerAssets(playerId: string): void {
    // Remove units
    for (const [unitId, unit] of this.units) {
      if (unit.playerId === playerId) {
        this.removeUnit(unitId);
      }
    }

    // Remove buildings
    for (const [buildingId, building] of this.buildings) {
      if (building.playerId === playerId) {
        this.removeBuilding(buildingId);
      }
    }
  }

  /**
   * Start the game
   */
  startGame(): void {
    if (this.players.size < 2) {
      throw new Error('Need at least 2 players to start the game');
    }
    this.gamePhase = 'playing';
    this.emit('gameStarted', { turn: this.turn, currentPlayerId: this.getCurrentPlayerId() });
  }

  /**
   * Get current player ID
   */
  getCurrentPlayerId(): string {
    const playerIds = Array.from(this.players.keys());
    return playerIds[this.currentPlayerIndex] || '';
  }

  /**
   * Get current player
   */
  getCurrentPlayer(): Player | undefined {
    return this.players.get(this.getCurrentPlayerId());
  }

  /**
   * Add a unit to the game
   */
  addUnit(unit: Unit): boolean {
    const tileKey = this.grid.coordToKey(unit.position);
    const tile = this.tiles.get(tileKey);
    
    if (!tile || tile.unitId || tile.isBlocked) {
      return false; // Position is occupied or invalid
    }

    this.units.set(unit.id, unit);
    tile.unitId = unit.id;
    this.emit('unitAdded', { unit });
    return true;
  }

  /**
   * Remove a unit from the game
   */
  removeUnit(unitId: string): boolean {
    const unit = this.units.get(unitId);
    if (!unit) return false;

    const tileKey = this.grid.coordToKey(unit.position);
    const tile = this.tiles.get(tileKey);
    if (tile) {
      delete tile.unitId;
    }

    this.units.delete(unitId);
    this.emit('unitRemoved', { unitId, unit });
    return true;
  }

  /**
   * Move a unit to a new position
   */
  moveUnit(unitId: string, newPosition: HexCoordinate): boolean {
    const unit = this.units.get(unitId);
    if (!unit || unit.hasMoved) return false;

    const distance = this.grid.distance(unit.position, newPosition);
    if (distance > unit.movementRange) return false;

    const newTileKey = this.grid.coordToKey(newPosition);
    const newTile = this.tiles.get(newTileKey);
    if (!newTile || newTile.unitId || newTile.isBlocked) return false;

    // Clear old position
    const oldTileKey = this.grid.coordToKey(unit.position);
    const oldTile = this.tiles.get(oldTileKey);
    if (oldTile) {
      delete oldTile.unitId;
    }

    // Set new position
    unit.position = newPosition;
    unit.hasMoved = true;
    newTile.unitId = unitId;

    this.emit('unitMoved', { unitId, oldPosition: this.grid.keyToCoord(oldTileKey), newPosition });
    return true;
  }

  /**
   * Attack with a unit
   */
  attackUnit(attackerId: string, targetId: string): boolean {
    const attacker = this.units.get(attackerId);
    const target = this.units.get(targetId);
    
    if (!attacker || !target || attacker.hasActed) return false;

    const distance = this.grid.distance(attacker.position, target.position);
    if (distance > attacker.attackRange) return false;

    target.health -= attacker.attackDamage;
    attacker.hasActed = true;

    this.emit('unitAttacked', { attackerId, targetId, damage: attacker.attackDamage });

    if (target.health <= 0) {
      this.removeUnit(targetId);
    }

    return true;
  }

  /**
   * Add a building to the game
   */
  addBuilding(building: Building): boolean {
    const tileKey = this.grid.coordToKey(building.position);
    const tile = this.tiles.get(tileKey);
    
    if (!tile || tile.buildingId || tile.unitId || tile.isBlocked) {
      return false;
    }

    this.buildings.set(building.id, building);
    tile.buildingId = building.id;
    this.emit('buildingAdded', { building });
    return true;
  }

  /**
   * Remove a building from the game
   */
  removeBuilding(buildingId: string): boolean {
    const building = this.buildings.get(buildingId);
    if (!building) return false;

    const tileKey = this.grid.coordToKey(building.position);
    const tile = this.tiles.get(tileKey);
    if (tile) {
      delete tile.buildingId;
    }

    this.buildings.delete(buildingId);
    this.emit('buildingRemoved', { buildingId, building });
    return true;
  }

  /**
   * End current player's turn
   */
  endTurn(): void {
    // Reset unit actions for current player
    const currentPlayerId = this.getCurrentPlayerId();
    for (const unit of this.units.values()) {
      if (unit.playerId === currentPlayerId) {
        unit.hasActed = false;
        unit.hasMoved = false;
      }
    }

    // Move to next player
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.size;
    
    // If we've cycled through all players, increment turn
    if (this.currentPlayerIndex === 0) {
      this.turn++;
    }

    this.emit('turnEnded', { 
      turn: this.turn, 
      currentPlayerId: this.getCurrentPlayerId(),
      previousPlayerId: currentPlayerId 
    });

    // Check for win conditions
    this.checkWinConditions();
  }

  /**
   * Check if game has ended
   */
  private checkWinConditions(): void {
    const playersWithUnits = new Set<string>();
    
    for (const unit of this.units.values()) {
      playersWithUnits.add(unit.playerId);
    }

    if (playersWithUnits.size <= 1) {
      this.gamePhase = 'ended';
      this.winner = playersWithUnits.values().next().value;
      this.emit('gameEnded', { winner: this.winner });
    }
  }

  /**
   * Execute a game action
   */
  executeAction(action: GameAction): boolean {
    if (action.playerId !== this.getCurrentPlayerId()) {
      return false; // Not this player's turn
    }

    let success = false;

    switch (action.type) {
      case 'move':
        success = this.moveUnit(action.data.unitId, action.data.position);
        break;
      case 'attack':
        success = this.attackUnit(action.data.attackerId, action.data.targetId);
        break;
      case 'endTurn':
        this.endTurn();
        success = true;
        break;
      // Add more action types as needed
    }

    if (success) {
      this.actionHistory.push(action);
      this.emit('actionExecuted', { action });
    }

    return success;
  }

  /**
   * Get current game state snapshot
   */
  getSnapshot(): GameStateSnapshot {
    return {
      turn: this.turn,
      currentPlayerId: this.getCurrentPlayerId(),
      players: new Map(this.players),
      units: new Map(this.units),
      buildings: new Map(this.buildings),
      tiles: new Map(this.tiles),
      actionHistory: [...this.actionHistory],
      gamePhase: this.gamePhase,
      winner: this.winner
    };
  }

  /**
   * Get the hex grid
   */
  getGrid(): HexGrid {
    return this.grid;
  }

  /**
   * Get all units
   */
  getUnits(): Map<string, Unit> {
    return new Map(this.units);
  }

  /**
   * Get all buildings
   */
  getBuildings(): Map<string, Building> {
    return new Map(this.buildings);
  }

  /**
   * Get all players
   */
  getPlayers(): Map<string, Player> {
    return new Map(this.players);
  }

  /**
   * Get tile at coordinate
   */
  getTile(coordinate: HexCoordinate): Tile | undefined {
    return this.tiles.get(this.grid.coordToKey(coordinate));
  }

  /**
   * Event system
   */
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
