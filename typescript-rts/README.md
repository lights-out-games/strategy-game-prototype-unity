# Hexagonal RTS Game State Manager

A TypeScript-based multiplayer real-time strategy game engine designed for hexagonal grid maps, similar to tabletop tactical RPGs. This system can run both on the server and in the browser environment.

## Features

### 🎮 Core Game Mechanics
- **Turn-based Strategy**: Complete turn management system with player phases
- **Hexagonal Grid**: Full hex coordinate system with distance calculations and pathfinding
- **Unit Management**: Units with movement, attack, and health systems
- **Building System**: Constructible buildings with unique properties
- **Resource Management**: Multi-resource economy system
- **Combat System**: Range-based attack mechanics with damage calculation

### 🌐 Network Architecture
- **Client-Server Model**: Authoritative server with client prediction
- **WebSocket Communication**: Real-time multiplayer synchronization
- **Event-Driven Architecture**: Reactive game state updates
- **Connection Management**: Handle player joins, leaves, and reconnections

### 🔧 Technical Features
- **Universal TypeScript**: Runs on Node.js server and in browser
- **A* Pathfinding**: Intelligent unit movement with obstacle avoidance
- **Event System**: Extensible event handling for game state changes
- **State Snapshots**: Complete game state serialization and restoration
- **Action Validation**: Server-side action validation and replay system

## Project Structure

```
typescript-rts/
├── src/
│   ├── core/              # Core game logic
│   │   ├── GameState.ts   # Main game state manager
│   │   └── HexGrid.ts     # Hexagonal grid utilities
│   ├── server/            # Server-side components
│   │   ├── GameServer.ts  # Main game server
│   │   ├── ServerNetworkManager.ts
│   │   └── index.ts       # Server entry point
│   ├── client/            # Client-side components
│   │   ├── GameClient.ts  # Game client interface
│   │   └── ClientNetworkManager.ts
│   └── network/           # Shared network utilities
│       └── NetworkManager.ts
├── dist/                  # Compiled output
├── package.json
├── tsconfig.json
└── webpack.config.js      # Browser build configuration
```

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Modern web browser for client testing

### Installation
```bash
cd typescript-rts
npm install
```

### Development Commands
```bash
# Build the project
npm run build

# Start the server
npm run dev:server

# Start client development server
npm run dev:client

# Build and start production server
npm run build && npm start

# Run tests
npm test

# Lint code
npm run lint
```

### Basic Usage

#### Server Setup
```typescript
import { GameServer } from './src/server/GameServer';

const server = new GameServer(20, 20, 8080, 4); // grid 20x20, port 8080, max 4 players
```

#### Client Connection
```typescript
import { GameClient } from './src/client/GameClient';

const client = new GameClient('ws://localhost:8080');
client.connect('PlayerName');
```

## Game Concepts

### Hexagonal Coordinates
Uses axial coordinate system (q, r) with cube coordinate conversion for calculations:
- **Distance**: Manhattan distance in cube coordinates
- **Neighbors**: 6 adjacent hexes per tile
- **Pathfinding**: A* algorithm with obstacle avoidance

### Game Flow
1. **Setup Phase**: Players join, initial units/buildings placed
2. **Playing Phase**: Turn-based gameplay with actions
3. **End Phase**: Victory conditions checked, game concludes

### Actions System
All player actions go through validation:
- `move`: Move unit within range
- `attack`: Attack enemy unit within range
- `build`: Construct building at location
- `spawn`: Create new unit from building
- `endTurn`: Pass turn to next player

### Event System
React to game events:
```typescript
gameState.on('unitMoved', (data) => {
  console.log(`Unit ${data.unitId} moved to ${data.newPosition.q}, ${data.newPosition.r}`);
});

gameState.on('gameEnded', (data) => {
  console.log(`Game won by player: ${data.winner}`);
});
```

## API Reference

### GameState Methods
- `addPlayer(player)`: Add player to game
- `addUnit(unit)`: Place unit on grid
- `moveUnit(unitId, position)`: Move unit to new hex
- `attackUnit(attackerId, targetId)`: Execute combat
- `executeAction(action)`: Process validated action
- `getSnapshot()`: Get complete game state
- `endTurn()`: Advance to next player's turn

### HexGrid Methods
- `distance(a, b)`: Calculate hex distance
- `getNeighbors(hex)`: Get adjacent hexes
- `findPath(start, goal)`: A* pathfinding
- `getHexesInRange(center, range)`: Get hexes within range
- `hexToPixel(hex)`: Convert to screen coordinates

## Configuration

Server configuration via environment variables:
- `PORT`: Server port (default: 8080)
- `MAX_PLAYERS`: Maximum players per game (default: 4)

Game parameters can be customized during GameState initialization:
```typescript
const gameState = new GameState(
  30,    // grid width
  30,    // grid height
  1.5    // hex size
);
```

## Contributing

1. Follow existing TypeScript patterns and naming conventions
2. Add tests for new features
3. Use ESLint for code formatting
4. Update documentation for API changes

## License

MIT License - see LICENSE file for details
