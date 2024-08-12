type Listener = (...args: any[]) => void;

export class EventEmitter {
  private events: { [event: string]: Listener[] } = {};

  on(event: string, listener: Listener): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listenerToRemove: Listener): void {
    if (!this.events[event]) {
      return;
    }
    this.events[event] = this.events[event].filter(listener => listener !== listenerToRemove);
  }

  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) {
      return;
    }
    this.events[event].forEach(listener => {
      listener.apply(this, args);
    });
  }

  once(event: string, listener: Listener): void {
    const onceWrapper = (...args: any[]) => {
      listener.apply(this, args);
      this.off(event, onceWrapper);
    };
    this.on(event, onceWrapper);
  }

  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  listenerCount(event: string): number {
    return this.events[event] ? this.events[event].length : 0;
  }

  listeners(event: string): Listener[] {
    return this.events[event] ? [...this.events[event]] : [];
  }

  eventNames(): string[] {
    return Object.keys(this.events);
  }

  executeInContext(event: string, context: any, ...args: any[]): any {
    if (!this.events[event]) {
      return;
    }
    const results: any[] = [];
    this.events[event].forEach(listener => {
      results.push(listener.apply(context, args));
    });
    return results;
  }
}