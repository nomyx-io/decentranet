// ComponentRegistry.ts

import { GunDataProvider } from '../data/GunDataProvider';
import { SEA } from '../auth/SEA';
import { ComponentMetadata, ComponentPackage, EncryptedComponentPackage, AccessControlList, ComponentUpdateEvent } from '../Types';
import { EventEmitter } from '../utils/EventEmitter';
import Fuse from 'fuse.js';

export class ComponentRegistry extends EventEmitter {
  private gun: GunDataProvider;
  private componentIndex: Fuse<ComponentMetadata>;
  private indexedComponents: ComponentMetadata[] = [];


  constructor(gun: GunDataProvider) {
    super();
    this.gun = gun;
    this.setupUpdateListeners().then(() => {
      this.initializeSearchIndex();
    });
    this.componentIndex = new Fuse([], { keys: [] });
  }

  async getComponent(address: string, userPair: any): Promise<ComponentPackage | null> {
    const path = this.getComponentPath(this.parseAddress(address));
    const data = await this.gun.get(path);

    if (!data) return null;

    if (data.metadata && typeof data.metadata !== 'string') {
      // Public component
      if (!await this.verifyComponentSignature(data)) {
        throw new Error('Component signature verification failed');
      }
      return data as ComponentPackage;
    } else {
      // Private or shared component
      const decrypted = await this.decryptComponent(data as EncryptedComponentPackage, userPair);
      if (!decrypted) return null;
      if (!await this.verifyComponentSignature(decrypted)) {
        throw new Error('Component signature verification failed');
      }
      return decrypted;
    }
  }

  getComponentSchema(address: string, userPair: any): Promise<any> {
    const path = this.getComponentPath(this.parseAddress(address));
    return this.gun.get(path);
  }


  private async initializeSearchIndex() {
    // Fetch all public components and index them
    const publicComponents = await this.fetchAllPublicComponents();
    this.indexedComponents = publicComponents;
    
    const options = {
      keys: ['name', 'description', 'tags', 'author'],
      threshold: 0.3,
      includeScore: true
    };
    this.componentIndex = new Fuse(this.indexedComponents, options);
  }

  private async fetchAllPublicComponents(): Promise<ComponentMetadata[]> {
    return new Promise(async (resolve) => {
      const components: ComponentMetadata[] = [];
      (await this.gun.get('components/public')).map().on((component: ComponentPackage, key: string) => {
        components.push(component.metadata);
      }).once(() => {
        resolve(components);
      });
    });
  }

  async searchComponents(query: string, limit: number = 10): Promise<ComponentMetadata[]> {
    const results = this.componentIndex.search(query);
    return results
      .slice(0, limit)
      .map(result => result.item);
  }

  async publishComponent(component: ComponentPackage, currentUserPair: any): Promise<void> {
    const { metadata, code, state } = component;
    const path = this.getComponentPath(metadata);

    // Sign the component
    metadata.signature = await SEA.sign(JSON.stringify({ metadata, code }), currentUserPair);

    if (metadata.acl.type === 'public') {
      await this.gun.put(path, { metadata, code, state });
    } else {
      const encryptedPackage = await this.encryptComponent(component, metadata.acl, currentUserPair);
      await this.gun.put(path, encryptedPackage);
    }

    // Notify about the new version
    this.notifyComponentUpdate(metadata);

    this.updateSearchIndex(component.metadata);
  }

  private updateSearchIndex(metadata: ComponentMetadata) {
    const existingIndex = this.indexedComponents.findIndex(c => c.id === metadata.id);
    if (existingIndex !== -1) {
      // Update existing component in the index
      this.indexedComponents[existingIndex] = metadata;
    } else {
      // Add new component to the index
      this.indexedComponents.push(metadata);
    }

    const options = {
      keys: ['name', 'description', 'tags', 'author'],
      threshold: 0.3,
      includeScore: true
    };
    this.componentIndex = new Fuse(this.indexedComponents, options);
  }

  private async setupUpdateListeners() {
    (await this.gun.get('components')).map().on((component: ComponentPackage, key: string) => {
      this.updateSearchIndex(component.metadata);
      this.notifyComponentUpdate(component.metadata);
    });
  }

  async updateComponentAccess(componentId: string, newAcl: AccessControlList, currentUserPair: any): Promise<void> {
    const component = await this.getComponent(componentId, currentUserPair);
    if (!component) throw new Error('Component not found');

    component.metadata.acl = newAcl;
    await this.publishComponent(component, currentUserPair);
  }

  private notifyComponentUpdate(metadata: ComponentMetadata): void {
    const updateEvent: ComponentUpdateEvent = {
      id: metadata.id,
      version: metadata.version,
      changes: [], // You would need to implement a way to track changes between versions
    };
    this.emit('componentUpdate', updateEvent);
  }

  private getComponentPath(metadata: ComponentMetadata): string {
    const baseType = metadata.acl.type === 'public' ? 'public' : 'private';
    return `components/${baseType}/${metadata.author}/${metadata.id}/${metadata.version}`;
  }

  private parseAddress(address: string): ComponentMetadata {
    const [author, id, version] = address.split('/');
    return { author, id, version } as ComponentMetadata;
  }

  private async encryptComponent(
    component: ComponentPackage,
    acl: AccessControlList,
    currentUserPair: any
  ): Promise<EncryptedComponentPackage> {
    function generateRandom(length: number): string {
      return Math.random().toString(36).substring(2, 2 + length);
    }
    const symmetricKey = generateRandom(16);
    const encryptedMetadata = await SEA.encrypt(JSON.stringify(component.metadata), symmetricKey);
    const encryptedCode = await SEA.encrypt(component.code, symmetricKey);
    const encryptedState = component.state ? await SEA.encrypt(JSON.stringify(component.state), symmetricKey) : undefined;

    const encryptedKey: { [key: string]: string } = {};
    for (const userPubKey of acl.allowedUsers || []) {
      encryptedKey[userPubKey] = await SEA.encrypt(symmetricKey, await SEA.secret(userPubKey, currentUserPair));
    }

    return {
      metadata: encryptedMetadata,
      code: encryptedCode,
      state: encryptedState,
      encryptedKey
    };
  }

  private async decryptComponent(
    encryptedPackage: EncryptedComponentPackage,
    userPair: any
  ): Promise<ComponentPackage | null> {
    const symmetricKey = await SEA.decrypt(encryptedPackage.encryptedKey[userPair.pub], userPair);
    if (!symmetricKey) return null;

    const metadata = JSON.parse(await SEA.decrypt(encryptedPackage.metadata, symmetricKey) as string);
    const code = await SEA.decrypt(encryptedPackage.code, symmetricKey) as string;
    const state = encryptedPackage.state ? JSON.parse(await SEA.decrypt(encryptedPackage.state, symmetricKey) as string) : undefined;

    return { metadata, code, state };
  }

  private async verifyComponentSignature(component: ComponentPackage): Promise<boolean> {
    const { metadata, code } = component;
    const signedData = JSON.stringify({ metadata: { ...metadata, signature: undefined }, code });
    return await SEA.verify(signedData, metadata.signature); // TODO: check if this is correct
  }
}