import { GameState, Player, Unit, Building } from '../core/GameState';
import { HexGrid } from '../core/HexGrid';

describe('GameState', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState(10, 10);
  });

  describe('Player Management', () => {
    test('should add player to game', () => {
      const player: Player = {
        id: 'player1',
        name: 'Test Player',
        color: '#ff0000',
        isActive: true,
        resources: { gold: 100 }
      };

      gameState.addPlayer(player);
      const players = gameState.getPlayers();

      expect(players.has('player1')).toBe(true);
      expect(players.get('player1')?.name).toBe('Test Player');
    });

    test('should remove player from game', () => {
      const player: Player = {
        id: 'player1',
        name: 'Test Player',
        color: '#ff0000',
        isActive: true,
        resources: { gold: 100 }
      };

      gameState.addPlayer(player);
      gameState.removePlayer('player1');

      expect(gameState.getPlayers().has('player1')).toBe(false);
    });

    test('should start game with minimum players', () => {
      const player1: Player = {
        id: 'player1',
        name: 'Player 1',
        color: '#ff0000',
        isActive: true,
        resources: { gold: 100 }
      };

      const player2: Player = {
        id: 'player2',
        name: 'Player 2',
        color: '#00ff00',
        isActive: true,
        resources: { gold: 100 }
      };

      gameState.addPlayer(player1);
      gameState.addPlayer(player2);

      expect(() => gameState.startGame()).not.toThrow();
      expect(gameState.getSnapshot().gamePhase).toBe('playing');
    });

    test('should not start game with insufficient players', () => {
      const player: Player = {
        id: 'player1',
        name: 'Solo Player',
        color: '#ff0000',
        isActive: true,
        resources: { gold: 100 }
      };

      gameState.addPlayer(player);

      expect(() => gameState.startGame()).toThrow('Need at least 2 players to start the game');
    });
  });

  describe('Unit Management', () => {
    beforeEach(() => {
      const player: Player = {
        id: 'player1',
        name: 'Test Player',
        color: '#ff0000',
        isActive: true,
        resources: { gold: 100 }
      };
      gameState.addPlayer(player);
    });

    test('should add unit to valid position', () => {
      const unit: Unit = {
        id: 'unit1',
        playerId: 'player1',
        type: 'warrior',
        position: { q: 0, r: 0 },
        health: 100,
        maxHealth: 100,
        movementRange: 3,
        attackRange: 1,
        attackDamage: 25,
        hasActed: false,
        hasMoved: false
      };

      const result = gameState.addUnit(unit);

      expect(result).toBe(true);
      expect(gameState.getUnits().has('unit1')).toBe(true);
    });

    test('should not add unit to occupied position', () => {
      const unit1: Unit = {
        id: 'unit1',
        playerId: 'player1',
        type: 'warrior',
        position: { q: 0, r: 0 },
        health: 100,
        maxHealth: 100,
        movementRange: 3,
        attackRange: 1,
        attackDamage: 25,
        hasActed: false,
        hasMoved: false
      };

      const unit2: Unit = {
        id: 'unit2',
        playerId: 'player1',
        type: 'archer',
        position: { q: 0, r: 0 },
        health: 60,
        maxHealth: 60,
        movementRange: 2,
        attackRange: 3,
        attackDamage: 20,
        hasActed: false,
        hasMoved: false
      };

      gameState.addUnit(unit1);
      const result = gameState.addUnit(unit2);

      expect(result).toBe(false);
      expect(gameState.getUnits().has('unit2')).toBe(false);
    });

    test('should move unit within range', () => {
      const unit: Unit = {
        id: 'unit1',
        playerId: 'player1',
        type: 'warrior',
        position: { q: 0, r: 0 },
        health: 100,
        maxHealth: 100,
        movementRange: 3,
        attackRange: 1,
        attackDamage: 25,
        hasActed: false,
        hasMoved: false
      };

      gameState.addUnit(unit);
      const result = gameState.moveUnit('unit1', { q: 2, r: 0 });

      expect(result).toBe(true);
      expect(gameState.getUnits().get('unit1')?.position).toEqual({ q: 2, r: 0 });
      expect(gameState.getUnits().get('unit1')?.hasMoved).toBe(true);
    });

    test('should not move unit beyond range', () => {
      const unit: Unit = {
        id: 'unit1',
        playerId: 'player1',
        type: 'warrior',
        position: { q: 0, r: 0 },
        health: 100,
        maxHealth: 100,
        movementRange: 2,
        attackRange: 1,
        attackDamage: 25,
        hasActed: false,
        hasMoved: false
      };

      gameState.addUnit(unit);
      const result = gameState.moveUnit('unit1', { q: 5, r: 0 });

      expect(result).toBe(false);
      expect(gameState.getUnits().get('unit1')?.position).toEqual({ q: 0, r: 0 });
    });

    test('should handle unit combat', () => {
      const attacker: Unit = {
        id: 'attacker',
        playerId: 'player1',
        type: 'warrior',
        position: { q: 0, r: 0 },
        health: 100,
        maxHealth: 100,
        movementRange: 3,
        attackRange: 2,
        attackDamage: 30,
        hasActed: false,
        hasMoved: false
      };

      const target: Unit = {
        id: 'target',
        playerId: 'player2',
        type: 'archer',
        position: { q: 1, r: 0 },
        health: 40,
        maxHealth: 60,
        movementRange: 2,
        attackRange: 3,
        attackDamage: 20,
        hasActed: false,
        hasMoved: false
      };

      // Add second player for target
      const player2: Player = {
        id: 'player2',
        name: 'Player 2',
        color: '#00ff00',
        isActive: true,
        resources: { gold: 100 }
      };
      gameState.addPlayer(player2);

      gameState.addUnit(attacker);
      gameState.addUnit(target);

      const result = gameState.attackUnit('attacker', 'target');

      expect(result).toBe(true);
      expect(gameState.getUnits().get('attacker')?.hasActed).toBe(true);
      expect(gameState.getUnits().has('target')).toBe(false); // Target should be destroyed
    });
  });

  describe('Turn Management', () => {
    beforeEach(() => {
      const player1: Player = {
        id: 'player1',
        name: 'Player 1',
        color: '#ff0000',
        isActive: true,
        resources: { gold: 100 }
      };

      const player2: Player = {
        id: 'player2',
        name: 'Player 2',
        color: '#00ff00',
        isActive: true,
        resources: { gold: 100 }
      };

      gameState.addPlayer(player1);
      gameState.addPlayer(player2);
      gameState.startGame();
    });

    test('should advance turn correctly', () => {
      const initialPlayer = gameState.getCurrentPlayerId();
      gameState.endTurn();
      const nextPlayer = gameState.getCurrentPlayerId();

      expect(nextPlayer).not.toBe(initialPlayer);
    });

    test('should reset unit actions on turn end', () => {
      const unit: Unit = {
        id: 'unit1',
        playerId: gameState.getCurrentPlayerId(),
        type: 'warrior',
        position: { q: 0, r: 0 },
        health: 100,
        maxHealth: 100,
        movementRange: 3,
        attackRange: 1,
        attackDamage: 25,
        hasActed: true,
        hasMoved: true
      };

      gameState.addUnit(unit);
      gameState.endTurn();
      gameState.endTurn(); // Return to original player

      const updatedUnit = gameState.getUnits().get('unit1');
      expect(updatedUnit?.hasActed).toBe(false);
      expect(updatedUnit?.hasMoved).toBe(false);
    });
  });

  describe('Building Management', () => {
    beforeEach(() => {
      const player: Player = {
        id: 'player1',
        name: 'Test Player',
        color: '#ff0000',
        isActive: true,
        resources: { gold: 100 }
      };
      gameState.addPlayer(player);
    });

    test('should add building to valid position', () => {
      const building: Building = {
        id: 'building1',
        playerId: 'player1',
        type: 'barracks',
        position: { q: 5, r: 5 },
        health: 200,
        maxHealth: 200,
        isConstructed: true
      };

      const result = gameState.addBuilding(building);

      expect(result).toBe(true);
      expect(gameState.getBuildings().has('building1')).toBe(true);
    });

    test('should not add building to occupied position', () => {
      const unit: Unit = {
        id: 'unit1',
        playerId: 'player1',
        type: 'warrior',
        position: { q: 5, r: 5 },
        health: 100,
        maxHealth: 100,
        movementRange: 3,
        attackRange: 1,
        attackDamage: 25,
        hasActed: false,
        hasMoved: false
      };

      const building: Building = {
        id: 'building1',
        playerId: 'player1',
        type: 'barracks',
        position: { q: 5, r: 5 },
        health: 200,
        maxHealth: 200,
        isConstructed: true
      };

      gameState.addUnit(unit);
      const result = gameState.addBuilding(building);

      expect(result).toBe(false);
      expect(gameState.getBuildings().has('building1')).toBe(false);
    });
  });

  describe('Game State Snapshots', () => {
    test('should create valid snapshot', () => {
      const player: Player = {
        id: 'player1',
        name: 'Test Player',
        color: '#ff0000',
        isActive: true,
        resources: { gold: 100 }
      };

      gameState.addPlayer(player);
      const snapshot = gameState.getSnapshot();

      expect(snapshot.players.has('player1')).toBe(true);
      expect(snapshot.gamePhase).toBe('setup');
      expect(snapshot.turn).toBe(1);
      expect(Array.isArray(snapshot.actionHistory)).toBe(true);
    });
  });
});

describe('HexGrid', () => {
  let grid: HexGrid;

  beforeEach(() => {
    grid = new HexGrid(10, 10);
  });

  test('should calculate distance correctly', () => {
    const distance = grid.distance({ q: 0, r: 0 }, { q: 3, r: 2 });
    expect(distance).toBe(3);
  });

  test('should find valid neighbors', () => {
    const neighbors = grid.getNeighbors({ q: 5, r: 5 });
    expect(neighbors).toHaveLength(6);

    // Check that all neighbors are within grid bounds
    neighbors.forEach(neighbor => {
      expect(grid.isValidCoordinate(neighbor)).toBe(true);
    });
  });

  test('should find hexes in range', () => {
    const hexesInRange = grid.getHexesInRange({ q: 5, r: 5 }, 2);

    // Should include center hex and all hexes within 2 steps
    expect(hexesInRange.length).toBeGreaterThan(1);

    // All hexes should be within specified range
    hexesInRange.forEach(hex => {
      expect(grid.distance({ q: 5, r: 5 }, hex)).toBeLessThanOrEqual(2);
    });
  });

  test('should validate coordinates correctly', () => {
    expect(grid.isValidCoordinate({ q: 0, r: 0 })).toBe(true);
    expect(grid.isValidCoordinate({ q: 9, r: 9 })).toBe(true);
    expect(grid.isValidCoordinate({ q: -1, r: 0 })).toBe(false);
    expect(grid.isValidCoordinate({ q: 10, r: 0 })).toBe(false);
    expect(grid.isValidCoordinate({ q: 0, r: 10 })).toBe(false);
  });

  test('should find path between points', () => {
    const path = grid.findPath({ q: 0, r: 0 }, { q: 3, r: 3 });

    expect(path.length).toBeGreaterThan(0);
    expect(path[0]).toEqual({ q: 0, r: 0 });
    expect(path[path.length - 1]).toEqual({ q: 3, r: 3 });
  });

  test('should handle path with obstacles', () => {
    const obstacles = new Set(['1,1', '2,1', '1,2']);
    const path = grid.findPath({ q: 0, r: 0 }, { q: 3, r: 3 }, obstacles);

    // Path should not go through obstacles
    path.forEach(hex => {
      const key = grid.coordToKey(hex);
      expect(obstacles.has(key)).toBe(false);
    });
  });

  test('should convert coordinates to keys and back', () => {
    const coord = { q: 5, r: 7 };
    const key = grid.coordToKey(coord);
    const backToCoord = grid.keyToCoord(key);

    expect(backToCoord).toEqual(coord);
  });

  test('should convert hex to pixel coordinates', () => {
    const pixel = grid.hexToPixel({ q: 1, r: 1 });

    expect(typeof pixel.x).toBe('number');
    expect(typeof pixel.y).toBe('number');
    expect(pixel.x).toBeGreaterThan(0);
    expect(pixel.y).toBeGreaterThan(0);
  });
});
