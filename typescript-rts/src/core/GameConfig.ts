export interface UnitTemplate {
  type: string;
  name: string;
  health: number;
  movementRange: number;
  attackRange: number;
  attackDamage: number;
  cost: { [resource: string]: number };
  description: string;
}

export interface BuildingTemplate {
  type: string;
  name: string;
  health: number;
  cost: { [resource: string]: number };
  produces?: { [resource: string]: number };
  unitsProduced?: string[];
  description: string;
}

export interface TerrainTemplate {
  type: string;
  name: string;
  movementCost: number;
  isBlocked: boolean;
  defensiveBonus?: number;
  color: string;
}

export interface GameConfig {
  gridWidth: number;
  gridHeight: number;
  maxPlayers: number;
  turnTimeLimit?: number;
  startingResources: { [resource: string]: number };
  victoryConditions: {
    eliminateAllEnemies: boolean;
    controlPoints?: number;
    resourceGoal?: { [resource: string]: number };
  };
  units: UnitTemplate[];
  buildings: BuildingTemplate[];
  terrains: TerrainTemplate[];
}

export const DefaultGameConfig: GameConfig = {
  gridWidth: 20,
  gridHeight: 20,
  maxPlayers: 4,
  turnTimeLimit: 120000, // 2 minutes
  startingResources: {
    gold: 100,
    wood: 50,
    stone: 25
  },
  victoryConditions: {
    eliminateAllEnemies: true
  },
  units: [
    {
      type: 'warrior',
      name: 'Warrior',
      health: 100,
      movementRange: 3,
      attackRange: 1,
      attackDamage: 25,
      cost: { gold: 20 },
      description: 'Basic melee fighter with balanced stats'
    },
    {
      type: 'archer',
      name: 'Archer',
      health: 60,
      movementRange: 2,
      attackRange: 3,
      attackDamage: 20,
      cost: { gold: 25, wood: 10 },
      description: 'Ranged unit effective at distance'
    },
    {
      type: 'mage',
      name: 'Mage',
      health: 40,
      movementRange: 2,
      attackRange: 2,
      attackDamage: 35,
      cost: { gold: 40, stone: 15 },
      description: 'Magical unit with high damage but low health'
    }
  ],
  buildings: [
    {
      type: 'barracks',
      name: 'Barracks',
      health: 200,
      cost: { gold: 50, wood: 25 },
      unitsProduced: ['warrior'],
      description: 'Trains warrior units'
    },
    {
      type: 'archery_range',
      name: 'Archery Range',
      health: 150,
      cost: { gold: 60, wood: 40 },
      unitsProduced: ['archer'],
      description: 'Trains archer units'
    },
    {
      type: 'tower',
      name: 'Mage Tower',
      health: 120,
      cost: { gold: 80, stone: 30 },
      unitsProduced: ['mage'],
      description: 'Trains mage units'
    },
    {
      type: 'mine',
      name: 'Gold Mine',
      health: 100,
      cost: { wood: 30 },
      produces: { gold: 10 },
      description: 'Generates gold each turn'
    }
  ],
  terrains: [
    {
      type: 'grass',
      name: 'Grassland',
      movementCost: 1,
      isBlocked: false,
      color: '#4CAF50'
    },
    {
      type: 'forest',
      name: 'Forest',
      movementCost: 2,
      isBlocked: false,
      defensiveBonus: 10,
      color: '#2E7D32'
    },
    {
      type: 'mountain',
      name: 'Mountain',
      movementCost: 3,
      isBlocked: false,
      defensiveBonus: 20,
      color: '#795548'
    },
    {
      type: 'water',
      name: 'Water',
      movementCost: 0,
      isBlocked: true,
      color: '#2196F3'
    }
  ]
};
