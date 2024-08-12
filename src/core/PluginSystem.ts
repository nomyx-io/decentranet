import EventEmitter from "events";
import { ErrorHandler } from "src";
import { Logger } from "src/Logger";
import { PluginMetadata } from "src/Types";

interface Plugin {
  metadata: PluginMetadata;
  initialize?(): Promise<void>;
  destroy?(): Promise<void>;
}

export class PluginSystem extends EventEmitter {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<string, Set<Function>> = new Map();
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor() {
    super();
    this.logger = Logger.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
  }
 
  async registerPlugin(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.metadata.name)) {
      throw new Error(`Plugin ${plugin.metadata.name} is already registered`);
    }

    try {
      if(plugin.initialize) await plugin.initialize();
      this.plugins.set(plugin.metadata.name, plugin);
      this.logger.info('Plugin registered', 'PluginSystem', { plugin: plugin.metadata.name });
      this.emit('pluginRegistered', plugin.metadata);
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PluginSystem.registerPlugin');
      throw error;
    }
  }

  async unregisterPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not registered`);
    }

    try {
      if(plugin.destroy) await plugin.destroy();
      this.plugins.delete(pluginName);
      this.logger.info('Plugin unregistered', 'PluginSystem', { plugin: pluginName });
      this.emit('pluginUnregistered', plugin.metadata);
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PluginSystem.unregisterPlugin');
      throw error;
    }
  }

  getPlugin(pluginName: string): Plugin | undefined {
    return this.plugins.get(pluginName);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  registerHook(hookName: string, callback: Function): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, new Set());
    }
    this.hooks.get(hookName)!.add(callback);
    this.logger.debug('Hook registered', 'PluginSystem', { hook: hookName });
  }

  unregisterHook(hookName: string, callback: Function): void {
    const hookSet = this.hooks.get(hookName);
    if (hookSet) {
      hookSet.delete(callback);
      if (hookSet.size === 0) {
        this.hooks.delete(hookName);
      }
      this.logger.debug('Hook unregistered', 'PluginSystem', { hook: hookName });
    }
  }

  broadcastToPlugins(event: string, ...args: any[]): void {
    for (const plugin of this.plugins.values()) {
      if ((plugin as any)[event]) {
        try {
          (plugin as any)[event](...args);
        } catch (error) {
          this.errorHandler.handleError(error as Error, 'PluginSystem.broadcastToPlugins');
        }
      }
    }
  }

  async executeHook(hookName: string, ...args: any[]): Promise<any[]> {
    const hookSet = this.hooks.get(hookName);
    if (!hookSet) {
      return [];
    }

    const results: any[] = [];
    for (const callback of hookSet) {
      try {
        const result = await callback(...args);
        results.push(result);
      } catch (error) {
        this.errorHandler.handleError(error as Error, 'PluginSystem.executeHook');
      }
    }

    return results;
  }

  async initializeAllPlugins(): Promise<void> {
    for (const [pluginName, plugin] of this.plugins) {
      try {
        if(plugin.initialize) await plugin.initialize();
        this.logger.info('Plugin initialized', 'PluginSystem', { plugin: pluginName });
      } catch (error) {
        this.errorHandler.handleError(error as Error, 'PluginSystem.initializeAllPlugins');
      }
    }
  }

  async destroyAllPlugins(): Promise<void> {
    for (const [pluginName, plugin] of this.plugins) {
      try {
        if(plugin.destroy) await plugin.destroy();
        this.logger.info('Plugin destroyed', 'PluginSystem', { plugin: pluginName });
      } catch (error) {
        this.errorHandler.handleError(error as Error, 'PluginSystem.destroyAllPlugins');
      }
    }
    this.plugins.clear();
    this.hooks.clear();
  }

  isPluginRegistered(pluginName: string): boolean {
    return this.plugins.has(pluginName);
  }

  getPluginMetadata(pluginName: string): PluginMetadata | undefined {
    const plugin = this.plugins.get(pluginName);
    return plugin ? plugin.metadata : undefined;
  }

  getAllPluginMetadata(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map(plugin => plugin.metadata);
  }

  async reloadPlugin(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin ${pluginName} is not registered`);
    }

    try {
      if(plugin.destroy) await plugin.destroy();
      if(plugin.initialize) await plugin.initialize();
      this.logger.info('Plugin reloaded', 'PluginSystem', { plugin: pluginName });
      this.emit('pluginReloaded', plugin.metadata);
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'PluginSystem.reloadPlugin');
      throw error;
    }
  }

  getHooks(): string[] {
    return Array.from(this.hooks.keys());
  }

  clearHooks(): void {
    this.hooks.clear();
    this.logger.info('All hooks cleared', 'PluginSystem');
  }
}

// Singleton instance
export const pluginSystem = new PluginSystem();

// Decorator for creating plugins
export function Plugin(metadata: PluginMetadata) {
  return function <T extends { new (...args: any[]): {
    metadata: PluginMetadata;
    initialize?(): Promise<void>;
    destroy?(): Promise<void>;
  } }>(constructor: T) {
    return class extends constructor implements Plugin {
      metadata = metadata;
      
      async initialize(): Promise<void> {
        if (super.initialize) {
          await super.initialize();
        }
      }

      async destroy(): Promise<void> {
        if (super.destroy) {
          await super.destroy();
        }
      }
    }
  }
}

// Helper function to create and register a plugin
export async function createAndRegisterPlugin<T extends Plugin>(
  PluginClass: new () => T
): Promise<T> {
  const plugin = new PluginClass();
  await pluginSystem.registerPlugin(plugin);
  return plugin;
}