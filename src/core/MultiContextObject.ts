import { Context, ContextSwitch, ContextState, ContextTransition } from '../Types';
import { BROWSER_CONTEXT, SERVER_CONTEXT, PEER_CONTEXT } from '../utils/Constants';
import { EventEmitter } from '../utils/EventEmitter';
import { Logger } from '../Logger';
import { ErrorHandler } from '../ui/ErrorHandler';

export class MultiContextObject extends EventEmitter {
  protected contexts: Map<Context, ContextState>;
  protected currentContext: Context;
  protected transitionInProgress: boolean = false;
  protected logger: Logger;
  protected errorHandler: ErrorHandler;

  constructor(contexts: Context[]) {
    super();
    this.logger = Logger.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
    this.contexts = new Map(contexts.map(context => [context, { active: false, data: {}, context }]));
    this.currentContext = this.detectContext();
    this.activateContext(this.currentContext);
    this.setupContextListeners();
  }

  private detectContext(): Context {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      return BROWSER_CONTEXT;
    } else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      return SERVER_CONTEXT;
    } else {
      return PEER_CONTEXT;
    }
  }

  private setupContextListeners(): void {
    this.on('beforeContextSwitch', this.handleBeforeContextSwitch.bind(this));
    this.on('afterContextSwitch', this.handleAfterContextSwitch.bind(this));
    this.on('contextError', this.handleContextError.bind(this));
  }

  private async handleBeforeContextSwitch(transition: ContextTransition): Promise<void> {
    this.logger.debug('Preparing for context switch', 'MultiContextObject', transition);
    // Perform any necessary cleanup or state saving for the current context
    await this.deactivateContext(transition.from);
  }

  private async handleAfterContextSwitch(transition: ContextTransition): Promise<void> {
    this.logger.debug('Finalizing context switch', 'MultiContextObject', transition);
    // Perform any necessary setup for the new context
    await this.activateContext(transition.to);
  }

  private handleContextError(error: Error, context: Context): void {
    this.errorHandler.handleError(error, `MultiContextObject (${context})`);
  }

  private async activateContext(context: Context): Promise<void> {
    const contextState = this.contexts.get(context);
    if (contextState) {
      contextState.active = true;
      // Perform any necessary initialization for the context
      this.emit('contextActivated', context);
    }
  }

  private async deactivateContext(context: Context): Promise<void> {
    const contextState = this.contexts.get(context);
    if (contextState) {
      contextState.active = false;
      // Perform any necessary cleanup for the context
      this.emit('contextDeactivated', context);
    }
  }

  isValidContext(context: Context): boolean {
    return this.contexts.has(context);
  }

  getCurrentContext(): Context {
    return this.currentContext;
  }

  getContextState(context: Context): ContextState | undefined {
    return this.contexts.get(context);
  }

  setContextData(context: Context, key: string, value: any): void {
    const contextState = this.contexts.get(context);
    if (contextState) {
      contextState.data[key] = value;
    }
  }

  getContextData(context: Context, key: string): any {
    const contextState = this.contexts.get(context);
    return contextState ? contextState.data[key] : undefined;
  }

  async switchContext(newContext: Context): Promise<void> {
    if (!this.isValidContext(newContext)) {
      throw new Error(`Invalid context: ${newContext}`);
    }

    if (this.currentContext === newContext) {
      return;
    }

    if (this.transitionInProgress) {
      throw new Error('Context switch already in progress');
    }

    this.transitionInProgress = true;

    try {
      const transition: ContextTransition = { from: this.currentContext, to: newContext };
      await this.emit('beforeContextSwitch', transition);

      const prevContext = this.currentContext;
      this.currentContext = newContext;

      await this.emit('afterContextSwitch', { ...transition, success: true });
    } catch (error) {
      this.emit('contextError', error, newContext);
      throw error;
    } finally {
      this.transitionInProgress = false;
    }
  }

  async executeInContext<T>(context: Context, func: () => Promise<T> | T): Promise<T> {
    const originalContext = this.currentContext;
    
    if (originalContext !== context) {
      await this.switchContext(context);
    }

    try {
      return await func();
    } finally {
      if (originalContext !== context) {
        await this.switchContext(originalContext);
      }
    }
  }

  async executeInAllContexts<T>(func: (context: Context) => Promise<T> | T): Promise<Map<Context, T>> {
    const results = new Map<Context, T>();
    for (const context of this.contexts.keys()) {
      results.set(context, await this.executeInContext(context, () => func(context)));
    }
    return results;
  }

  async executeInMultipleContexts<T>(contexts: Context[], func: (context: Context) => Promise<T> | T): Promise<Map<Context, T>> {
    const results = new Map<Context, T>();
    for (const context of contexts) {
      if (this.isValidContext(context)) {
        results.set(context, await this.executeInContext(context, () => func(context)));
      }
    }
    return results;
  }

  onContextActivated(callback: (context: Context) => void): void {
    this.on('contextActivated', callback);
  }

  onContextDeactivated(callback: (context: Context) => void): void {
    this.on('contextDeactivated', callback);
  }

  onBeforeContextSwitch(callback: (transition: ContextTransition) => void): void {
    this.on('beforeContextSwitch', callback);
  }

  onAfterContextSwitch(callback: (transition: ContextTransition) => void): void {
    this.on('afterContextSwitch', callback);
  }

  async withContext<T>(context: Context, func: () => Promise<T> | T): Promise<T> {
    return this.executeInContext(context, func);
  }

  isContextActive(context: Context): boolean {
    const contextState = this.contexts.get(context);
    return contextState ? contextState.active : false;
  }

  getActiveContexts(): Context[] {
    return Array.from(this.contexts.entries())
      .filter(([_, state]) => state.active)
      .map(([context, _]) => context);
  }

  async broadcastToActiveContexts<T>(func: (context: Context) => Promise<T> | T): Promise<Map<Context, T>> {
    const activeContexts = this.getActiveContexts();
    return this.executeInMultipleContexts(activeContexts, func);
  }
}