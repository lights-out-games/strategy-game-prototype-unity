export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: string;
  data?: any;
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (level <= this.logLevel) {
      const entry: LogEntry = {
        timestamp: new Date(),
        level,
        message,
        context,
        data
      };

      this.logs.push(entry);

      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }

      this.output(entry);
    }
  }

  private output(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level];
    const context = entry.context ? `[${entry.context}]` : '';
    const message = `${timestamp} ${levelStr} ${context} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(message, entry.data || '');
        break;
      case LogLevel.WARN:
        console.warn(message, entry.data || '');
        break;
      case LogLevel.INFO:
        console.info(message, entry.data || '');
        break;
      case LogLevel.DEBUG:
        console.debug(message, entry.data || '');
        break;
    }
  }

  error(message: string, context?: string, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  debug(message: string, context?: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export class GameError extends Error {
  public readonly code: string;
  public readonly playerId?: string;
  public readonly actionId?: string;

  constructor(message: string, code: string, playerId?: string, actionId?: string) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.playerId = playerId;
    this.actionId = actionId;
  }
}

export enum ErrorCodes {
  INVALID_ACTION = 'INVALID_ACTION',
  INVALID_POSITION = 'INVALID_POSITION',
  INSUFFICIENT_RESOURCES = 'INSUFFICIENT_RESOURCES',
  UNIT_NOT_FOUND = 'UNIT_NOT_FOUND',
  BUILDING_NOT_FOUND = 'BUILDING_NOT_FOUND',
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  NOT_PLAYERS_TURN = 'NOT_PLAYERS_TURN',
  UNIT_ALREADY_ACTED = 'UNIT_ALREADY_ACTED',
  UNIT_ALREADY_MOVED = 'UNIT_ALREADY_MOVED',
  TARGET_OUT_OF_RANGE = 'TARGET_OUT_OF_RANGE',
  POSITION_OCCUPIED = 'POSITION_OCCUPIED',
  GAME_NOT_STARTED = 'GAME_NOT_STARTED',
  GAME_ALREADY_ENDED = 'GAME_ALREADY_ENDED',
  MAX_PLAYERS_REACHED = 'MAX_PLAYERS_REACHED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR'
}

export function createGameError(code: ErrorCodes, message: string, playerId?: string, actionId?: string): GameError {
  return new GameError(message, code, playerId, actionId);
}

export function isGameError(error: any): error is GameError {
  return error instanceof GameError;
}

export class ErrorHandler {
  private static logger = Logger.getInstance();

  static handle(error: Error | GameError, context?: string): void {
    if (isGameError(error)) {
      this.logger.error(
        `Game Error: ${error.message}`,
        context,
        {
          code: error.code,
          playerId: error.playerId,
          actionId: error.actionId,
          stack: error.stack
        }
      );
    } else {
      this.logger.error(
        `Unexpected Error: ${error.message}`,
        context,
        {
          name: error.name,
          stack: error.stack
        }
      );
    }
  }

  static handleAsync(promise: Promise<any>, context?: string): void {
    promise.catch(error => this.handle(error, context));
  }
}
