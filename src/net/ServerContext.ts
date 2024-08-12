import { Context } from '../Types';

export const SERVER_CONTEXT: Context = 'server';

export function isServerContext(): boolean {
  return !!(typeof process !== 'undefined' && process.versions && process.versions.node);
}

export function executeInServerContext(func: Function): any {
  if (isServerContext()) {
    return func();
  } else {
    throw new Error('Attempted to execute server-specific code in a non-server environment');
  }
}

export function getServerInfo(): {nodeVersion: string, platform: string} {
  if (!isServerContext()) {
    throw new Error('Not in a server context');
  }

  return {
    nodeVersion: process.version,
    platform: process.platform
  };
}

export function getEnvironmentVariables(): {[key: string]: string | undefined} {
  if (!isServerContext()) {
    throw new Error('Not in a server context');
  }

  return process.env;
}

export function getServerMemoryUsage(): {rss: number, heapTotal: number, heapUsed: number, external: number} {
  if (!isServerContext()) {
    throw new Error('Not in a server context');
  }

  return process.memoryUsage();
}

export function getServerUptime(): number {
  if (!isServerContext()) {
    throw new Error('Not in a server context');
  }

  return process.uptime();
}

export function isProductionMode(): boolean {
  if (!isServerContext()) {
    throw new Error('Not in a server context');
  }

  return process.env.NODE_ENV === 'production';
}

export function getCPUUsage(): {user: number, system: number} {
  if (!isServerContext()) {
    throw new Error('Not in a server context');
  }

  return process.cpuUsage();
}

export function getServerArguments(): string[] {
  if (!isServerContext()) {
    throw new Error('Not in a server context');
  }

  return process.argv;
}

export function exitServer(code: number = 0): void {
  if (!isServerContext()) {
    throw new Error('Not in a server context');
  }

  process.exit(code);
}