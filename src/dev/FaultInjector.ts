// FaultInjector.ts

import { EventEmitter } from '../utils/EventEmitter';
import { Logger } from '../Logger';

type FaultType = 'error' | 'delay' | 'networkError' | 'timeout' | 'customError';

interface FaultConfig {
  probability: number;
  type: FaultType;
  details?: any;
}

interface InjectionPoint {
  name: string;
  config: FaultConfig;
}

export class FaultInjector extends EventEmitter {
  private injectionPoints: Map<string, FaultConfig> = new Map();
  private logger: Logger;

  constructor() {
    super();
    this.logger = Logger.getInstance();
  }

  addFault(name: string, config: FaultConfig): void {
    this.injectionPoints.set(name, config);
    this.logger.info(`Fault added: ${name}`, 'FaultInjector', { config });
  }

  removeFault(name: string): void {
    this.injectionPoints.delete(name);
    this.logger.info(`Fault removed: ${name}`, 'FaultInjector');
  }

  async injectFault(name: string, options?: any): Promise<void> {
    // TODO implement options
    
    const config = this.injectionPoints.get(name);
    if (!config) {
      this.logger.warn(`No fault configured for: ${name}`, 'FaultInjector');
      return;
    }

    if (Math.random() < config.probability) {
      this.logger.info(`Injecting fault: ${name}`, 'FaultInjector', { type: config.type });
      this.emit('faultInjected', { name, type: config.type });

      switch (config.type) {
        case 'error':
          throw new Error(`Injected error for ${name}`);
        case 'delay':
          await this.injectDelay(config.details || 1000);
          break;
        case 'networkError':
          throw new Error(`Simulated network error for ${name}`);
        case 'timeout':
          await this.injectTimeout(config.details || 5000);
          break;
        case 'customError':
          if (typeof config.details === 'function') {
            config.details();
          } else {
            throw new Error(`Custom error for ${name}: ${config.details}`);
          }
          break;
      }
    }
  }

  private async injectDelay(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  private async injectTimeout(ms: number): Promise<void> {
    await new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms));
  }

  getAllFaults(): InjectionPoint[] {
    return Array.from(this.injectionPoints.entries()).map(([name, config]) => ({ name, config }));
  }

  clearAllFaults(): void {
    this.injectionPoints.clear();
    this.logger.info('All faults cleared', 'FaultInjector');
  }

  async injectRandomFault(): Promise<void> {
    const faults = this.getAllFaults();
    if (faults.length === 0) {
      this.logger.warn('No faults configured for random injection', 'FaultInjector');
      return;
    }

    const randomFault = faults[Math.floor(Math.random() * faults.length)];
    await this.injectFault(randomFault.name);
  }

  setGlobalFaultProbability(probability: number): void {
    for (const [name, config] of this.injectionPoints) {
      this.injectionPoints.set(name, { ...config, probability });
    }
    this.logger.info(`Global fault probability set to ${probability}`, 'FaultInjector');
  }
}

// Singleton instance
export const faultInjector = new FaultInjector();

// Decorator for injecting faults into methods
export function InjectFault(faultName: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      await faultInjector.injectFault(faultName);
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}