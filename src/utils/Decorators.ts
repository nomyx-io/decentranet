import { MultiContextObject } from 'src/core/MultiContextObject';
import { DecoratorOptions, Context } from '../Types';
import { BROWSER_CONTEXT, SERVER_CONTEXT, PEER_CONTEXT } from './Constants';

export function contextMethod(context: Context) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (this: MultiContextObject, ...args: any[]) {
      if (this.getCurrentContext() !== context) {
        throw new Error(`Method ${propertyKey} can only be called in ${context} context`);
      }
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

export function multiContext(...contexts: Context[]) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (this: MultiContextObject, ...args: any[]) {
      if (!contexts.includes(this.getCurrentContext())) {
        throw new Error(`Method ${propertyKey} can only be called in ${contexts.join(' or ')} context`);
      }
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

export function logMethod(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(`Calling method ${propertyKey} with args:`, args);
    const result = originalMethod.apply(this, args);
    console.log(`Method ${propertyKey} returned:`, result);
    return result;
  };
  return descriptor;
}

export function retry(maxAttempts: number = 3, delay: number = 1000) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      let attempts = 0;
      while (attempts < maxAttempts) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };
    return descriptor;
  };
}

export function memoize(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const cache = new Map();
  descriptor.value = function (...args: any[]) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = originalMethod.apply(this, args);
    cache.set(key, result);
    return result;
  };
  return descriptor;
}

export function debounce(delay: number = 300) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let timeoutId: NodeJS.Timeout;
    descriptor.value = function (...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => originalMethod.apply(this, args), delay);
    };
    return descriptor;
  };
}

export function throttle(limit: number = 300) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let lastRun = 0;
    descriptor.value = function (...args: any[]) {
      const now = Date.now();
      if (now - lastRun >= limit) {
        lastRun = now;
        return originalMethod.apply(this, args);
      }
    };
    return descriptor;
  };
}