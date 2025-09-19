import { GameStateSnapshot, GameAction } from './GameState';
import { Logger, GameError, ErrorCodes } from './ErrorHandling';

export interface GameSave {
  id: string;
  name: string;
  timestamp: Date;
  gameState: GameStateSnapshot;
  metadata: {
    version: string;
    playerCount: number;
    turnNumber: number;
    gamePhase: string;
    mapSize: { width: number; height: number };
  };
}

export interface SavedGameInfo {
  id: string;
  name: string;
  timestamp: Date;
  metadata: GameSave['metadata'];
}

export class GamePersistence {
  private static readonly SAVE_VERSION = '1.0.0';
  private static readonly STORAGE_KEY_PREFIX = 'hex_rts_save_';
  private static logger = Logger.getInstance();

  /**
   * Save game state to storage
   */
  static async saveGame(gameState: GameStateSnapshot, saveName: string): Promise<string> {
    try {
      const saveId = this.generateSaveId();
      const save: GameSave = {
        id: saveId,
        name: saveName,
        timestamp: new Date(),
        gameState: this.cloneGameState(gameState),
        metadata: {
          version: this.SAVE_VERSION,
          playerCount: gameState.players.size,
          turnNumber: gameState.turn,
          gamePhase: gameState.gamePhase,
          mapSize: {
            width: this.extractGridWidth(gameState),
            height: this.extractGridHeight(gameState)
          }
        }
      };

      await this.writeSaveToStorage(saveId, save);
      this.logger.info(`Game saved successfully: ${saveName} (ID: ${saveId})`);
      return saveId;
    } catch (error) {
      const gameError = new GameError(
        `Failed to save game: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.SERIALIZATION_ERROR
      );
      this.logger.error('Save operation failed', 'GamePersistence', error);
      throw gameError;
    }
  }

  /**
   * Load game state from storage
   */
  static async loadGame(saveId: string): Promise<GameStateSnapshot> {
    try {
      const save = await this.readSaveFromStorage(saveId);

      if (!save) {
        throw new GameError('Save file not found', ErrorCodes.INVALID_ACTION);
      }

      if (!this.isValidSave(save)) {
        throw new GameError('Invalid save file format', ErrorCodes.SERIALIZATION_ERROR);
      }

      if (save.metadata.version !== this.SAVE_VERSION) {
        this.logger.warn(`Loading save from different version: ${save.metadata.version}`);
      }

      this.logger.info(`Game loaded successfully: ${save.name} (ID: ${saveId})`);
      return this.deserializeGameState(save.gameState);
    } catch (error) {
      if (error instanceof GameError) {
        throw error;
      }

      const gameError = new GameError(
        `Failed to load game: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ErrorCodes.SERIALIZATION_ERROR
      );
      this.logger.error('Load operation failed', 'GamePersistence', error);
      throw gameError;
    }
  }

  /**
   * Get list of all saved games
   */
  static async getSavedGames(): Promise<SavedGameInfo[]> {
    try {
      const saves: SavedGameInfo[] = [];

      if (typeof window !== 'undefined' && window.localStorage) {
        // Browser environment
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(this.STORAGE_KEY_PREFIX)) {
            const saveData = localStorage.getItem(key);
            if (saveData) {
              const save = JSON.parse(saveData) as GameSave;
              saves.push({
                id: save.id,
                name: save.name,
                timestamp: new Date(save.timestamp),
                metadata: save.metadata
              });
            }
          }
        }
      } else {
        // Node.js environment - would require file system operations
        this.logger.warn('File system save/load not implemented for Node.js environment');
      }

      return saves.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
      this.logger.error('Failed to retrieve saved games list', 'GamePersistence', error);
      return [];
    }
  }

  /**
   * Delete a saved game
   */
  static async deleteSave(saveId: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const key = this.STORAGE_KEY_PREFIX + saveId;
        if (localStorage.getItem(key)) {
          localStorage.removeItem(key);
          this.logger.info(`Save deleted: ${saveId}`);
          return true;
        }
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to delete save: ${saveId}`, 'GamePersistence', error);
      return false;
    }
  }

  /**
   * Export save as JSON string
   */
  static exportSave(save: GameSave): string {
    return JSON.stringify(save, null, 2);
  }

  /**
   * Import save from JSON string
   */
  static importSave(saveJson: string): GameSave {
    try {
      const save = JSON.parse(saveJson) as GameSave;
      if (!this.isValidSave(save)) {
        throw new GameError('Invalid save file format', ErrorCodes.SERIALIZATION_ERROR);
      }
      return save;
    } catch (error) {
      throw new GameError(
        `Failed to import save: ${error instanceof Error ? error.message : 'Invalid JSON'}`,
        ErrorCodes.SERIALIZATION_ERROR
      );
    }
  }

  private static generateSaveId(): string {
    return `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static async writeSaveToStorage(saveId: string, save: GameSave): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = this.STORAGE_KEY_PREFIX + saveId;
      localStorage.setItem(key, JSON.stringify(save));
    } else {
      // Node.js file system operations would go here
      throw new Error('File system operations not implemented');
    }
  }

  private static async readSaveFromStorage(saveId: string): Promise<GameSave | null> {
    if (typeof window !== 'undefined' && window.localStorage) {
      const key = this.STORAGE_KEY_PREFIX + saveId;
      const saveData = localStorage.getItem(key);
      return saveData ? JSON.parse(saveData) : null;
    } else {
      // Node.js file system operations would go here
      throw new Error('File system operations not implemented');
    }
  }

  private static cloneGameState(gameState: GameStateSnapshot): GameStateSnapshot {
    return {
      turn: gameState.turn,
      currentPlayerId: gameState.currentPlayerId,
      players: new Map(Array.from(gameState.players.entries())),
      units: new Map(Array.from(gameState.units.entries())),
      buildings: new Map(Array.from(gameState.buildings.entries())),
      tiles: new Map(Array.from(gameState.tiles.entries())),
      actionHistory: [...gameState.actionHistory],
      gamePhase: gameState.gamePhase,
      winner: gameState.winner
    };
  }

  private static deserializeGameState(serializedState: any): GameStateSnapshot {
    return {
      turn: serializedState.turn,
      currentPlayerId: serializedState.currentPlayerId,
      players: new Map(serializedState.players),
      units: new Map(serializedState.units),
      buildings: new Map(serializedState.buildings),
      tiles: new Map(serializedState.tiles),
      actionHistory: serializedState.actionHistory,
      gamePhase: serializedState.gamePhase,
      winner: serializedState.winner
    };
  }

  private static isValidSave(save: any): save is GameSave {
    return save &&
           typeof save.id === 'string' &&
           typeof save.name === 'string' &&
           save.timestamp &&
           save.gameState &&
           save.metadata;
  }

  private static extractGridWidth(gameState: GameStateSnapshot): number {
    let maxQ = 0;
    for (const [key] of gameState.tiles) {
      const [q] = key.split(',').map(Number);
      maxQ = Math.max(maxQ, q);
    }
    return maxQ + 1;
  }

  private static extractGridHeight(gameState: GameStateSnapshot): number {
    let maxR = 0;
    for (const [key] of gameState.tiles) {
      const [, r] = key.split(',').map(Number);
      maxR = Math.max(maxR, r);
    }
    return maxR + 1;
  }
}
