import { NodeVM, VMScript } from 'vm2';
import { Component } from '../core/Component';
import { Logger } from '../Logger';
import { ErrorHandler } from '../ui/ErrorHandler';

export class SandboxedEnvironment {
  private vm: NodeVM;
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor() {
    this.logger = Logger.getInstance();
    this.errorHandler = ErrorHandler.getInstance();

    this.vm = new NodeVM({
      console: 'redirect',
      sandbox: {
        Component,
        // Add any other necessary classes or functions here
      },
      require: {
        external: true,
        builtin: ['assert', 'buffer', 'crypto', 'events', 'stream', 'util'],
        root: './',
        mock: {
          fs: {
            readFileSync: () => 'Not allowed in sandbox',
          },
        },
      },
    });

    this.setupConsoleRedirect();
  }

  private setupConsoleRedirect(): void {
    this.vm.on('console.log', (...args: any[]) => {
      this.logger.info('Sandbox console.log', 'SandboxedEnvironment', ...args);
    });
    this.vm.on('console.error', (...args: any[]) => {
      this.logger.error('Sandbox console.error', 'SandboxedEnvironment', ...args);
    });
    this.vm.on('console.warn', ((...args: any[]) => {
      this.logger.warn('Sandbox console.warn', 'SandboxedEnvironment', ...args);
    }));
  }

  evaluate(code: string): any {
    try {
      const script = new VMScript(code);
      return this.vm.run(script);
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'SandboxedEnvironment.evaluate');
      throw error;
    }
  }

  runFunction(func: Function, ...args: any[]): any {
    try {
      const argsString = JSON.stringify(args);
      const code = `
        (function() {
          const args = ${argsString};
          return (${func.toString()})(...args);
        })()
      `;
      return this.vm.run(code, 'vm.js');
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'SandboxedEnvironment.runFunction');
      throw error;
    }
  }
  
  setGlobal(key: string, value: any): void {
    this.vm.setGlobal(key, value);
  }

  getGlobal(key: string): any {
    return this.vm.getGlobal(key);
  }
}