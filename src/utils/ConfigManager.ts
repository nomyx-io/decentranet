import { EventEmitter } from '../utils/EventEmitter';
import { Logger } from '../Logger';
import { STORAGE_PREFIX } from '../utils/Constants';

export class ConfigManager extends EventEmitter {
  private static instance: ConfigManager;
  private config: { [key: string]: any } = {};
  private logger: Logger;

  private constructor() {
    super();
    this.logger = Logger.getInstance();
    this.loadConfig();
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadConfig(): void {
    const storedConfig = localStorage.getItem(`${STORAGE_PREFIX}config`);
    if (storedConfig) {
      try {
        this.config = JSON.parse(storedConfig);
      } catch (error) {
        this.logger.error('Failed to parse stored config', 'ConfigManager', error);
      }
    }
  }

  private saveConfig(): void {
    localStorage.setItem(`${STORAGE_PREFIX}config`, JSON.stringify(this.config));
  }

  get(key: string, defaultValue?: any): any {
    return this.config.hasOwnProperty(key) ? this.config[key] : defaultValue;
  }

  set(key: string, value: any): void {
    this.config[key] = value;
    this.saveConfig();
    this.emit('configChanged', { key, value });
  }

  remove(key: string): void {
    if (this.config.hasOwnProperty(key)) {
      delete this.config[key];
      this.saveConfig();
      this.emit('configChanged', { key, value: undefined });
    }
  }

  clear(): void {
    this.config = {};
    this.saveConfig();
    this.emit('configCleared');
  }

  getAll(): { [key: string]: any } {
    return { ...this.config };
  }

  setMultiple(configs: { [key: string]: any }): void {
    Object.assign(this.config, configs);
    this.saveConfig();
    Object.keys(configs).forEach(key => {
      this.emit('configChanged', { key, value: configs[key] });
    });
  }

  has(key: string): boolean {
    return this.config.hasOwnProperty(key);
  }

  subscribe(callback: (config: { [key: string]: any }) => void): () => void {
    const listener = () => callback(this.getAll());
    this.on('configChanged', listener);
    return () => this.off('configChanged', listener);
  }

  validate(schema: { [key: string]: any }): boolean {
    for (const [key, value] of Object.entries(schema)) {
      if (!this.has(key) || typeof this.get(key) !== value) {
        return false;
      }
    }
    return true;
  }
}