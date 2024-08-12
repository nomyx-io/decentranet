import { EventEmitter } from '../utils/EventEmitter';
import { GunDataProvider } from '../data/GunDataProvider';
import { SEA } from '../auth/SEA';
import { User, AuthCredentials } from '../Types';
import { Logger } from '../Logger';
import { ErrorHandler } from '../ui/ErrorHandler';

export class AuthManager extends EventEmitter {
  private gunDataProvider: GunDataProvider;
  private currentUser: User | null = null;
  private logger: Logger;
  private errorHandler: ErrorHandler;

  constructor(gunDataProvider: GunDataProvider) {
    super();
    this.gunDataProvider = gunDataProvider;
    this.logger = Logger.getInstance();
    this.errorHandler = ErrorHandler.getInstance();
  }

  async register(credentials: AuthCredentials): Promise<User> {
    try {
      const result = await SEA.createUser(credentials.username, credentials.password);
      const user: User = {
        alias: credentials.username,
        pub: result.pub
      };
      this.currentUser = user;
      this.emit('userRegistered', user);
      this.logger.info('User registered', 'AuthManager', { username: credentials.username });
      return user;
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'AuthManager.register');
      throw error;
    }
  }

  async login(credentials: AuthCredentials): Promise<User> {
    try {
      const result = await SEA.authenticateUser(credentials.username, credentials.password);
      const user: User = {
        alias: credentials.username,
        pub: result.pub
      };
      this.currentUser = user;
      this.emit('userLoggedIn', user);
      this.logger.info('User logged in', 'AuthManager', { username: credentials.username });
      return user;
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'AuthManager.login');
      throw error;
    }
  }

  logout(): void {
    this.gunDataProvider.logout();
    this.currentUser = null;
    this.emit('userLoggedOut');
    this.logger.info('User logged out', 'AuthManager');
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.gunDataProvider.isAuthenticated();
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!this.currentUser) {
      throw new Error('No user is currently logged in');
    }

    try {
      // Verify current password
      await SEA.authenticateUser(this.currentUser.alias, currentPassword);

      // Change password
      await (await this.gunDataProvider.get(`~@${this.currentUser.alias}`)).put({ auth: newPassword });

      this.logger.info('Password changed successfully', 'AuthManager');
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'AuthManager.changePassword');
      throw error;
    }
  }

  async resetPassword(username: string, resetToken: string, newPassword: string): Promise<void> {
    try {
      // Verify reset token
      const isValidToken = await this.verifyResetToken(username, resetToken);
      if (!isValidToken) {
        throw new Error('Invalid or expired reset token');
      }

      // Change password
      await (await this.gunDataProvider.get(`~@${username}`)).put({ auth: newPassword });

      // Invalidate reset token
      await this.invalidateResetToken(username);

      this.logger.info('Password reset successfully', 'AuthManager', { username });
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'AuthManager.resetPassword');
      throw error;
    }
  }

  private async verifyResetToken(username: string, resetToken: string): Promise<boolean> {
    // Implement token verification logic here
    // This is a placeholder implementation
    return true;
  }

  private async invalidateResetToken(username: string): Promise<void> {
    // Implement token invalidation logic here
    // This is a placeholder implementation
  }

  async requestPasswordReset(username: string): Promise<void> {
    try {
      // Generate reset token
      const resetToken = await SEA.work(username, username, { name: 'SHA-256' });

      // Store reset token (you might want to store this more securely and with an expiration)
      await (await this.gunDataProvider.get(`~@${username}`)).get('resetToken').put(resetToken);

      // In a real-world scenario, you would send this token to the user via email
      this.logger.info('Password reset requested', 'AuthManager', { username, resetToken });
    } catch (error) {
      this.errorHandler.handleError(error as Error, 'AuthManager.requestPasswordReset');
      throw error;
    }
  }
}