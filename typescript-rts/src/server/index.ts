import { GameServer } from './GameServer';

// Configuration
const config = {
  gridWidth: 20,
  gridHeight: 20,
  port: parseInt(process.env.PORT || '8080'),
  maxPlayers: parseInt(process.env.MAX_PLAYERS || '4')
};

console.log('Starting Hexagonal RTS Game Server...');
console.log('Configuration:', config);

// Create and start the game server
const gameServer = new GameServer(
  config.gridWidth,
  config.gridHeight,
  config.port,
  config.maxPlayers
);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT. Shutting down gracefully...');
  gameServer.shutdown();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM. Shutting down gracefully...');
  gameServer.shutdown();
  process.exit(0);
});

// Log server stats periodically
setInterval(() => {
  const stats = gameServer.getGameStats();
  console.log(`[${new Date().toISOString()}] Server Stats:`, stats);
}, 60000); // Every minute

console.log(`Server is running on port ${config.port}`);
console.log('Press Ctrl+C to stop the server');

export { gameServer };
