import Gun from 'gun';
import 'gun/sea';
import { EncryptedData } from '../Types';

const gun = Gun();

export class SEA {
  static async pair(): Promise<any> {
    return await Gun.SEA.pair();
  }

  static async encrypt(data: any, pair: any): Promise<string> {
    return await Gun.SEA.encrypt(data, pair);
  }

  static async decrypt(encryptedData: string, pair: any): Promise<any> {
    return await Gun.SEA.decrypt(encryptedData, pair);
  }

  static async sign(data: any, pair: any): Promise<string> {
    return await Gun.SEA.sign(data, pair);
  }

  static async verify(signedData: string, pair: any): Promise<any> {
    return await Gun.SEA.verify(signedData, pair);
  }

  static async work(data: string, salt: any, options?: any): Promise<any> {
    return await Gun.SEA.work(data, salt, null, options);
  }

  static async certify(certificants: string | string[], policy: any, authority: any, expiry?: any, cb?: any): Promise<string> {
    return await Gun.SEA.certify(certificants, policy, authority, expiry, cb);
  }

  static async recall(props: any, cb?: any): Promise<any> {
    const user = gun.user();
    return await user.recall(props, cb);
  }

  static async secret(key: any, pair: any, cb?: any): Promise<any> {
    return await Gun.SEA.secret(key, pair, cb);
  }

  static async derive(passphrase: string, salt?: any, options?: any): Promise<{ epriv: string; epub: string }> {
    const { epriv, epub } = await Gun.SEA.pair();
    const proof: any = await Gun.SEA.work(passphrase, salt, null, options);
    return {
      epriv: await Gun.SEA.encrypt(epriv, proof),
      epub
    };
  }

  static async authenticateUser(alias: string, password: string): Promise<any> {
    return new Promise((resolve, reject) => {
      Gun.SEA.pair().then(async (pair: any) => {
        const user = gun.user();
        user.auth(alias, password, (ack: any) => {
          if(ack.err) {
            reject(ack.err);
          } else {
            resolve(ack.sea);
          }
        });
      });
    });
  }

  static async createUser(alias: string, password: string): Promise<any> {
    return new Promise((resolve, reject) => {
      Gun.SEA.pair().then(async (pair: any) => {
        const user = gun.user();
        user.create(alias, password, (ack: any) => {
          if(ack.err) {
            reject(ack.err);
          } else {
            resolve(ack.sea);
          }
        });
      });
    });
  }
}