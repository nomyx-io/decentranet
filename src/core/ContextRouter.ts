import { Context, RouteHandler, Middleware, RouteMatch, RouteParams, RouteContext } from '../Types';
import { MultiContextObject } from './MultiContextObject';
import { EventEmitter } from '../utils/EventEmitter';
import { PeerManager } from '../net/PeerManager';
import { Logger } from '../Logger';

export class ContextRouter extends EventEmitter {
  private routes: Map<string, Map<Context, RouteConfig>>;
  private middleware: Middleware[];
  private peerManager: PeerManager;
  private logger: Logger;

  constructor(peerManager: PeerManager) {
    super();
    this.routes = new Map();
    this.middleware = [];
    this.peerManager = peerManager;
    this.logger = Logger.getInstance();
  }

  addRoute(path: string, context: Context, handler: RouteHandler, options: RouteOptions = {}): void {
    if (!this.routes.has(path)) {
      this.routes.set(path, new Map());
    }
    this.routes.get(path)!.set(context, { handler, options });
    this.logger.debug(`Route added: ${path} for context ${context}`, 'ContextRouter');
  }

  use(middleware: Middleware): void {
    this.middleware.push(middleware);
    this.logger.debug('Middleware added', 'ContextRouter');
  }

  async route(path: string, multiContextObject: MultiContextObject, data?: any): Promise<any> {
    const match = this.findRouteMatch(path);
    if (!match) {
      throw new Error(`No route found for path: ${path}`);
    }

    const { routeConfig, params } = match;
    const currentContext = multiContextObject.getCurrentContext();
    
    if (!routeConfig.has(currentContext)) {
      throw new Error(`No handler found for context ${currentContext} on path ${path}`);
    }

    const { handler, options } = routeConfig.get(currentContext)!;

    const routeContext: RouteContext = {
      path,
      params,
      data,
      context: currentContext,
      peerManager: this.peerManager
    };

    // Run middleware
    for (const mw of this.middleware) {
      await mw(routeContext);
    }

    // Run context-specific middleware
    if (options.middleware) {
      for (const mw of options.middleware) {
        await mw(routeContext);
      }
    }

    return multiContextObject.executeInContext(currentContext, () => handler(routeContext));
  }

  async broadcastRoute(path: string, multiContextObject: MultiContextObject, data?: any): Promise<any[]> {
    const match = this.findRouteMatch(path);
    if (!match) {
      throw new Error(`No route found for path: ${path}`);
    }

    const { routeConfig, params } = match;
    const results = [];

    for (const [context, { handler, options }] of routeConfig.entries()) {
      const routeContext: RouteContext = {
        path,
        params,
        data,
        context,
        peerManager: this.peerManager
      };

      // Run middleware
      for (const mw of this.middleware) {
        await mw(routeContext);
      }

      // Run context-specific middleware
      if (options.middleware) {
        for (const mw of options.middleware) {
          await mw(routeContext);
        }
      }

      const result = await multiContextObject.executeInContext(context, () => handler(routeContext));
      results.push(result);
    }

    return results;
  }

  async routeToPeer(peerId: string, path: string, data?: any): Promise<any> {
    return this.peerManager.executeInPeerContext(peerId, (peer: any) => {
      return peer.route(path, data);
    });
  }

  private findRouteMatch(path: string): RouteMatch | null {
    for (const [routePath, routeConfig] of this.routes.entries()) {
      const params = this.matchRoute(routePath, path);
      if (params !== null) {
        return { routeConfig, params };
      }
    }
    return null;
  }

  private matchRoute(routePath: string, path: string): RouteParams | null {
    const routeParts = routePath.split('/');
    const pathParts = path.split('/');

    if (routeParts.length !== pathParts.length) {
      return null;
    }

    const params: RouteParams = {};

    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return params;
  }

  getRoutes(): Map<string, Map<Context, RouteConfig>> {
    return new Map(this.routes);
  }

  clearRoutes(): void {
    this.routes.clear();
    this.logger.debug('All routes cleared', 'ContextRouter');
  }

  removeRoute(path: string, context?: Context): void {
    if (context) {
      const routeConfig = this.routes.get(path);
      if (routeConfig) {
        routeConfig.delete(context);
        if (routeConfig.size === 0) {
          this.routes.delete(path);
        }
      }
    } else {
      this.routes.delete(path);
    }
    this.logger.debug(`Route removed: ${path}${context ? ` for context ${context}` : ''}`, 'ContextRouter');
  }
}

interface RouteOptions {
  middleware?: Middleware[];
}

interface RouteConfig {
  handler: RouteHandler;
  options: RouteOptions;
}