import { EncryptedData } from 'src/Types';
import { CRYPTO_ALGORITHM, CRYPTO_KEY_LENGTH } from '../utils/Constants';

export class CryptoUtils {
  private static async generateKey(): Promise<CryptoKey> {
    return await window.crypto.subtle.generateKey(
      {
        name: CRYPTO_ALGORITHM,
        length: CRYPTO_KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private static async exportKey(key: CryptoKey): Promise<string> {
    const exported = await window.crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
  }

  private static async importKey(keyData: string): Promise<CryptoKey> {
    const keyDataBinary = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey(
      'raw',
      keyDataBinary,
      CRYPTO_ALGORITHM,
      true,
      ['encrypt', 'decrypt']
    );
  }

  static async encrypt(data: string, key?: string): Promise<EncryptedData> {
    const cryptoKey = key ? await this.importKey(key) : await this.generateKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);

    const encryptedContent = await window.crypto.subtle.encrypt(
      {
        name: CRYPTO_ALGORITHM,
        iv: iv
      },
      cryptoKey,
      encodedData
    );

    const exportedKey = key || await this.exportKey(cryptoKey);

    return {
      ct: btoa(String.fromCharCode(...new Uint8Array(encryptedContent))),
      iv: btoa(String.fromCharCode(...iv)),
      s: exportedKey
    };
  }

  static async decrypt(encryptedData: EncryptedData): Promise<string> {
    const cryptoKey = await this.importKey(encryptedData.s);
    const iv = Uint8Array.from(atob(encryptedData.iv), c => c.charCodeAt(0));
    const encryptedContent = Uint8Array.from(atob(encryptedData.ct), c => c.charCodeAt(0));

    const decryptedContent = await window.crypto.subtle.decrypt(
      {
        name: CRYPTO_ALGORITHM,
        iv: iv
      },
      cryptoKey,
      encryptedContent
    );

    return new TextDecoder().decode(decryptedContent);
  }

  static async hash(data: string): Promise<string> {
    const encodedData = new TextEncoder().encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', encodedData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  static generateRandomId(length: number = 32): string {
    const array = new Uint8Array(length / 2);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => dec.toString(16).padStart(2, "0")).join('');
  }
}