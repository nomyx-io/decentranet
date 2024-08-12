import { LogLevel, LogEntry } from './Types';
import { DEFAULT_LOG_LEVEL } from './utils/Constants';

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];

  private constructor() {
    this.logLevel = DEFAULT_LOG_LEVEL;
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private log(level: LogLevel, message: string, context?: string, data?: any): void {
    if (this.shouldLog(level)) {
      const logEntry: LogEntry = {
        level,
        message,
        timestamp: Date.now(),
        context,
        data
      };
      this.logs.push(logEntry);
      console[level](
        `[${new Date(logEntry.timestamp).toISOString()}] [${level.toUpperCase()}]${context ? ` [${context}]` : ''}: ${message}`,
        data ? data : ''
      );
    }
  }

  debug(message: string, context?: string, data?: any): void {
    this.log('debug', message, context, data);
  }

  info(message: string, context?: string, data?: any): void {
    this.log('info', message, context, data);
  }

  warn(message: string, context?: string, data?: any): void {
    this.log('warn', message, context, data);
  }

  error(message: string, context?: string, data?: any): void {
    this.log('error', message, context, data);
  }

  getLogs(): LogEntry[] {
    return this.logs;
  }

  clearLogs(): void {
    this.logs = [];
  }

  exportLogs(): string {
    return JSON.stringify(this.logs);
  }

  importLogs(logsJson: string): void {
    try {
      const importedLogs = JSON.parse(logsJson);
      if (Array.isArray(importedLogs)) {
        this.logs = importedLogs;
      } else {
        throw new Error('Invalid log format');
      }
    } catch (error) {
      console.error('Failed to import logs:', error);
    }
  }
}