import { VNode, VNodeType, VNodeProps, Patch } from "src/Types";

export class VirtualDOM {
 private rootNode: VNode | null = null;

 createElement(type: VNodeType, props: VNodeProps = {}, ...children: (VNode | string)[]): VNode {
  return { type, props, children, key: props.key };
 }

 render(node: VNode | string): HTMLElement | Text {
  if (typeof node === 'string') {
   return document.createTextNode(node);
  }

  const element = typeof node.type === 'function'
   ? (node.type as Function)(node.props)
   : document.createElement(node.type as string);

  this.updateProps(element, {}, node.props);

  node.children.forEach(child => {
   element.appendChild(this.render(child));
  });

  return element;
 }

 clear(): void {
  this.rootNode = null;
 }

 private updateProps(element: HTMLElement, oldProps: VNodeProps, newProps: VNodeProps): void {
  const mergedProps = { ...oldProps, ...newProps };

  Object.keys(mergedProps).forEach(name => {
   const oldValue = oldProps[name];
   const newValue = newProps[name];

   if (name.startsWith('on') && typeof newValue === 'function') {
    const eventName = name.toLowerCase().substr(2);
    if (oldValue) element.removeEventListener(eventName, oldValue);
    element.addEventListener(eventName, newValue);
   } else if (name === 'style' && typeof newValue === 'object') {
    Object.assign(element.style, newValue);
   } else if (name === 'className') {
    element.className = newValue;
   } else if (newValue == null || newValue === false) {
    element.removeAttribute(name);
   } else {
    element.setAttribute(name, newValue.toString());
   }
  });
 }

 diff(oldNode: VNode | null, newNode: VNode): Patch[] {
  const patches: Patch[] = [];

  if (oldNode === null) {
   patches.push({ type: 'CREATE', node: newNode });
  } else if (typeof oldNode === 'string' || typeof newNode === 'string') {
   if (oldNode !== newNode) {
    patches.push({ type: 'REPLACE', node: newNode });
   }
  } else if (oldNode.type !== newNode.type) {
   patches.push({ type: 'REPLACE', node: newNode });
  } else {
   const propPatches = this.diffProps(oldNode.props, newNode.props);
   if (Object.keys(propPatches).length > 0) {
    patches.push({ type: 'UPDATE', props: propPatches });
   }

   const childPatches = this.diffChildren(oldNode.children, newNode.children);
   patches.push(...childPatches);
  }

  return patches;
 }

 getRootNode(): VNode | null {
  return this.rootNode;
 }
 
 private diffProps(oldProps: VNodeProps, newProps: VNodeProps): VNodeProps {
  const patches: VNodeProps = {};

  // Find changed or new props
  Object.entries(newProps).forEach(([key, value]) => {
   if (oldProps[key] !== value) {
    patches[key] = value;
   }
  });

  // Find removed props
  Object.keys(oldProps).forEach(key => {
   if (!(key in newProps)) {
    patches[key] = undefined;
   }
  });

  return patches;
 }

 private diffChildren(oldChildren: (VNode | string)[], newChildren: (VNode | string)[]): Patch[] {
  const patches: Patch[] = [];
  const oldKeyedChildren = new Map<string | number, VNode>();
  const newKeyedChildren = new Map<string | number, VNode>();

  // Separate keyed and non-keyed children
  oldChildren.forEach((child, index) => {
   if (typeof child !== 'string' && child.key != null) {
    oldKeyedChildren.set(child.key, child);
   }
  });

  newChildren.forEach((child, index) => {
   if (typeof child !== 'string' && child.key != null) {
    newKeyedChildren.set(child.key, child);
   }
  });

  // Handle keyed children
  newKeyedChildren.forEach((newChild, key) => {
   const oldChild = oldKeyedChildren.get(key);
   if (oldChild) {
    patches.push(...this.diff(oldChild, newChild).map(patch => ({ ...patch, key })));
    oldKeyedChildren.delete(key);
   } else {
    patches.push({ type: 'CREATE', node: newChild, key } as any);
   }
  });

  oldKeyedChildren.forEach((oldChild, key: any) => {
   patches.push({ type: 'REMOVE', key } as any);
  });

  // Handle non-keyed children
  const oldNonKeyedChildren = oldChildren.filter(child => typeof child === 'string' || child.key == null);
  const newNonKeyedChildren = newChildren.filter(child => typeof child === 'string' || child.key == null);

  for (let i = 0; i < Math.max(oldNonKeyedChildren.length, newNonKeyedChildren.length); i++) {
   if (i >= oldNonKeyedChildren.length) {
    patches.push({ type: 'CREATE', node: newNonKeyedChildren[i] as any, index: i });
   } else if (i >= newNonKeyedChildren.length) {
    patches.push({ type: 'REMOVE', index: i });
   } else {
    patches.push(...this.diff(oldNonKeyedChildren[i] as VNode, newNonKeyedChildren[i] as VNode).map(patch => ({ ...patch, index: i })));
   }
  }

  return patches;
 }

 applyPatches(rootElement: HTMLElement, patches: Patch[]): void {
  patches.forEach((patch: any) => {
   switch (patch.type) {
    case 'CREATE':
     if (patch.node) {
      const newElement = this.render(patch.node);
      if (patch.index !== undefined) {
       rootElement.insertBefore(newElement, rootElement.childNodes[patch.index] || null);
      } else if (patch.key !== undefined) {
       rootElement.appendChild(newElement);
      }
     }
     break;
    case 'UPDATE':
     if (patch.props && (patch.index !== undefined || patch.key !== undefined)) {
      const element = patch.key !== undefined
       ? Array.from(rootElement.children).find(child => child.getAttribute('key') === patch.key?.toString())
       : rootElement.childNodes[patch.index!];
      if (element && element instanceof HTMLElement) {
       this.updateProps(element, {}, patch.props);
      }
     }
     break;
    case 'REPLACE':
     if (patch.node && (patch.index !== undefined || patch.key !== undefined)) {
      const newElement = this.render(patch.node);
      const oldElement = patch.key !== undefined
       ? Array.from(rootElement.children).find(child => child.getAttribute('key') === patch.key?.toString())
       : rootElement.childNodes[patch.index!];
      if (oldElement) {
       rootElement.replaceChild(newElement, oldElement);
      }
     }
     break;
    case 'REMOVE':
     if (patch.index !== undefined) {
      rootElement.removeChild(rootElement.childNodes[patch.index]);
     } else if (patch.key !== undefined) {
      const element = Array.from(rootElement.children).find(child => child.getAttribute('key') === patch.key?.toString());
      if (element) rootElement.removeChild(element);
     }
     break;
    case 'REORDER':
     if (patch.from !== undefined && patch.to !== undefined) {
      const element = rootElement.childNodes[patch.from];
      rootElement.insertBefore(element, rootElement.childNodes[patch.to]);
     }
     break;
   }
  });
 }

 updateDOM(rootElement: HTMLElement, newVNode: VNode): void {
  const patches = this.diff(this.rootNode, newVNode);
  this.applyPatches(rootElement, patches);
  this.rootNode = newVNode;
 }
}