import { VirtualDOM } from '../utils/VirtualDOM';
import { EventEmitter } from '../utils/EventEmitter';
import { Component } from '../core/Component';
import { VNode, Patch } from 'src/Types';

type EventHandler = (event: Event) => void;


interface LifecycleHooks {
  beforeUpdate?: () => void;
  afterUpdate?: () => void;
}


export class ReactiveUI extends EventEmitter {
  private rootElement: HTMLElement | null = null;
  private virtualDOM: VirtualDOM;
  private components: Map<string, Component<any, any>> = new Map();
  private eventDelegator: EventDelegator;
  private errorBoundary: ErrorBoundary;

  constructor() {
    super();
    this.virtualDOM = new VirtualDOM();
    this.eventDelegator = new EventDelegator(this);
    this.errorBoundary = new ErrorBoundary();
  }

  mount(element: HTMLElement): void {
    this.rootElement = element;
    this.eventDelegator.attachToRoot(element);
    this.emit('mounted', element);
  }

  unmount(): void {
    if (this.rootElement) {
      this.eventDelegator.detachFromRoot();
      this.emit('unmounted', this.rootElement);
      this.rootElement = null;
    }
    this.virtualDOM.clear();
    this.components.clear();
  }

  update(newVDOM: VNode): void {
    if (this.rootElement) {
      this.errorBoundary.tryExecute(() => {
        this.triggerLifecycleHook('beforeUpdate');
        const patches = this.virtualDOM.diff(this.virtualDOM.getRootNode(), newVDOM);
        this.applyPatches(patches);
        this.triggerLifecycleHook('afterUpdate');
        this.emit('updated', patches);
      });
    }
  }

  private applyPatches(patches: Patch[]): void {
    if (!this.rootElement) return;

    patches.forEach(patch => {
      switch (patch.type) {
        case 'CREATE':
          this.createNode(patch.node as any);
          break;
        case 'REMOVE':
          this.removeNode(patch.index as any);
          break;
        case 'REPLACE':
          this.replaceNode(patch.index as any, patch.node as any);
          break;
        case 'UPDATE':
          this.updateNode(patch.index as any, patch.props);
          break;
      }
    });
  }

  
  private createNode(vnode: VNode): void {
    if (!this.rootElement) return;

    const element = this.renderVNode(vnode);
    if (Array.isArray(element)) {
      element.forEach(el => this.rootElement!.appendChild(el));
    } else {
      this.rootElement.appendChild(element);
    }
  }

  private removeNode(index: number): void {
    if (!this.rootElement) return;

    const node = this.rootElement.childNodes[index];
    if (node) {
      this.rootElement.removeChild(node);
    }
  }

  private replaceNode(index: number, vnode: VNode): void {
    if (!this.rootElement) return;

    const oldNode = this.rootElement.childNodes[index];
    const newNode = this.renderVNode(vnode);
    if (oldNode) {
      if (Array.isArray(newNode)) {
        const fragment = document.createDocumentFragment();
        newNode.forEach(el => fragment.appendChild(el));
        this.rootElement.replaceChild(fragment, oldNode);
      } else {
        this.rootElement.replaceChild(newNode, oldNode);
      }
    }
  }

  private updateNode(index: number, props: any): void {
    if (!this.rootElement) return;

    const node = this.rootElement.childNodes[index] as HTMLElement;
    if (node) {
      Object.entries(props).forEach(([key, value]) => {
        if (key === 'style' && typeof value === 'object') {
          Object.assign(node.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
          const eventName = key.slice(2).toLowerCase();
          this.eventDelegator.addListener(node, eventName, value as EventHandler);
        } else {
          node.setAttribute(key, value as string);
        }
      });
    }
  }

  private renderVNode(vnode: VNode): HTMLElement | Text | (HTMLElement | Text)[] {
    if (typeof vnode === 'string') {
      return document.createTextNode(vnode);
    }

    if (vnode.tag === 'fragment') {
      return vnode.children.map(child => this.renderVNode(child as VNode)).flat();
    }

    const element = document.createElement(vnode.tag as string);

    Object.entries(vnode.props || {}).forEach(([key, value]) => {
      if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        this.eventDelegator.addListener(element, eventName, value as EventHandler);
      } else {
        element.setAttribute(key, value as string);
      }
    });

    (vnode.children || []).forEach((value: string | VNode, index: number, array: (string | VNode)[]) => {
      const child = this.renderVNode(value as VNode);
      if (Array.isArray(child)) {
        child.forEach(c => element.appendChild(c));
      } else {
        element.appendChild(child);
      }
    });

    if (vnode.component) {
      const componentInstance = vnode.component(vnode.props);
      this.components.set(element.id, componentInstance);
      componentInstance.mount(element);
    }

    return element;
  }

  getComponentInstance(id: string): Component<any, any> | undefined {
    return this.components.get(id);
  }

  updateComponentProps(id: string, newProps: any): void {
    const component = this.components.get(id);
    if (component) {
      const propsChanged = this.hasPropsChanged(component.props, newProps);
      if (propsChanged) {
        component.updateProps(newProps);
      }
    }
  }

  private hasPropsChanged(oldProps: any, newProps: any): boolean {
    const keys = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);
    for (const key of keys) {
      if (!Object.is(oldProps[key], newProps[key])) {
        return true;
      }
    }
    return false;
  }

  private triggerLifecycleHook(hook: keyof LifecycleHooks): void {
    this.components.forEach((component: any) => {
      if (component[hook]) {
        (component[hook] as Function)();
      }
    });
  }

  setErrorHandler(handler: (error: Error) => void): void {
    this.errorBoundary.setErrorHandler(handler);
  }
}

class EventDelegator {
  private root: HTMLElement | null = null;
  private listeners: Map<string, Set<EventHandler>> = new Map();

  constructor(private reactiveUI: ReactiveUI) {}

  attachToRoot(root: HTMLElement): void {
    this.root = root;
    this.addRootListeners();
  }

  detachFromRoot(): void {
    if (this.root) {
      this.removeRootListeners();
      this.root = null;
    }
    this.listeners.clear();
  }

  addListener(element: HTMLElement, eventName: string, handler: EventHandler): void {
    const key = this.getEventKey(element, eventName);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(handler);
  }

  removeListener(element: HTMLElement, eventName: string, handler: EventHandler): void {
    const key = this.getEventKey(element, eventName);
    const handlers = this.listeners.get(key);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(key);
      }
    }
  }

  private addRootListeners(): void {
    if (!this.root) return;
    
    const eventNames = ['click', 'input', 'change', 'submit', 'keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove'];
    eventNames.forEach(eventName => {
      this.root!.addEventListener(eventName, this.handleEvent);
    });
  }

  private removeRootListeners(): void {
    if (!this.root) return;

    const eventNames = ['click', 'input', 'change', 'submit', 'keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove'];
    eventNames.forEach(eventName => {
      this.root!.removeEventListener(eventName, this.handleEvent);
    });
  }

  private handleEvent = (event: Event): void => {
    let target = event.target as HTMLElement | null;
    while (target && target !== this.root) {
      const key = this.getEventKey(target, event.type);
      const handlers = this.listeners.get(key);
      if (handlers) {
        handlers.forEach(handler => handler(event));
      }
      target = target.parentElement;
    }
  };

  private getEventKey(element: HTMLElement, eventName: string): string {
    return `${element.id || element.tagName.toLowerCase()}:${eventName}`;
  }
}

class ErrorBoundary {
  private errorHandler: ((error: Error) => void) | null = null;

  setErrorHandler(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  tryExecute(fn: () => void): void {
    try {
      fn();
    } catch (error) {
      if (this.errorHandler) {
        this.errorHandler(error as Error);
      } else {
        console.error('Unhandled error in ReactiveUI:', error);
      }
    }
  }
}