import {
  DecentralizedApp,
  Component,
  GunDataProvider,
  AuthManager,
  SyncManager,
  PeerManager,
  ContextRouter,
  DistributedState,
  Logger,
  CryptoUtils,
  BROWSER_CONTEXT,
  SERVER_CONTEXT,
  PEER_CONTEXT,
  DevTools
} from '@nomyx/decentranet';

// Initialize the DecentralizedApp
const gunDataProvider = new GunDataProvider({
  peers: ['https://gun-server.example.com/gun'],
  localStorage: true,
});

const app = new DecentralizedApp(gunDataProvider);

// Set up authentication
const authManager = app.getAuthManager();

// Set up sync manager
const syncManager = app.getSyncManager();

// Set up peer manager
const peerManager = app.getPeerManager();

// Set up context router
const contextRouter = app.getContextRouter();

// Set up logger
const logger = Logger.getInstance();

// User Profile Component
class UserProfile extends Component<{ username: string, bio: string }, { userId: string }> {
  private profileState: DistributedState<{ username: string, bio: string }>;

  constructor(props: { userId: string }) {
    super(['browser', 'peer'], app.getDataProvider(), { username: 'string', bio: 'string' }, { username: '', bio: '' }, props, peerManager, syncManager);
    this.profileState = syncManager.syncState<{ username: string, bio: string }>(
      `users/${props.userId}/profile`,
      { username: 'string', bio: 'string' }
    );
  }

  async componentDidMount() {
    const profile = await this.profileState.get();
    this.setState(profile);
  }

  updateProfile(username: string, bio: string) {
    this.profileState.update(state => ({ ...state, username, bio }));
    this.setState({ username, bio });
  }

  render(): string {
    return `
      <div class="user-profile">
        <h2>${(this.state as any).username}</h2>
        <p>${(this.state as any).bio}</p>
      </div>
    `;
  }
}

// Post Component
class Post extends Component<{ content: string, author: string, likes: number }, { postId: string }> {
  private postState: DistributedState<{ content: string, author: string, likes: number }>;

  constructor(props: { postId: string }) {
    super(['browser', 'peer'], app.getDataProvider(), { content: 'string', author: 'string', likes: 'number' }, { content: '', author: '', likes: 0 }, props, peerManager, syncManager);
    this.postState = syncManager.syncState<{ content: string, author: string, likes: number }>(
      `posts/${props.postId}`,
      { content: 'string', author: 'string', likes: 'number' }
    );
  }

  async componentDidMount() {
    const post = await this.postState.get();
    this.setState(post);
  }

  like() {
    this.postState.update(state => ({ ...state, likes: state.likes + 1 }));
    this.setState({ likes: (this.state as any).likes + 1 });
  }

  render(): string {
    return `
      <div class="post">
        <p>${(this.state as any).content}</p>
        <p>Author: ${(this.state as any).author}</p>
        <p>Likes: ${(this.state as any).likes}</p>
        <button onclick="this.like()">Like</button>
      </div>
    `;
  }

  async setPostContent(content: string, author: string) {
    await this.postState.set({ content, author, likes: 0 });
    this.setState({ content, author, likes: 0 });
  }
}

// Main Application Component
class SocialApp extends Component<{ loggedIn: boolean, userId: string | null }, {}> {
  private userState: DistributedState<{ loggedIn: boolean, userId: string | null }>;

  constructor() {
    super(['browser', 'server', 'peer'], app.getDataProvider(), { loggedIn: 'boolean', userId: 'string' }, { loggedIn: false, userId: null }, {}, peerManager, syncManager);
    this.userState = syncManager.syncState<{ loggedIn: boolean, userId: string | null }>(
      'currentUser',
      { loggedIn: 'boolean', userId: 'string' }
    );
  }

  mount(element: HTMLElement) {
    super.mount(element);
    (window as any)['app'] = {
      route: (path: string) => contextRouter.route(path, this, BROWSER_CONTEXT),
      broadcastRoute: (path: string, data: any) => contextRouter.broadcastRoute(path, this, data)
    };
    (window as any)['this'] = this;
  }
  
  async componentDidMount() {
    const user = await this.userState.get();
    this.setState(user);

    // Set up context routing
    contextRouter.addRoute('/profile', BROWSER_CONTEXT, this.renderProfile.bind(this));
    contextRouter.addRoute('/feed', BROWSER_CONTEXT, this.renderFeed.bind(this));
    contextRouter.addRoute('/post', PEER_CONTEXT, this.handleNewPost.bind(this));
  }

  async login(username: string, password: string) {
    try {
      const user = await authManager.login({ username, password });
      this.userState.update(state => ({ ...state, loggedIn: true, userId: user.pub }));
      this.setState({ loggedIn: true, userId: user.pub });
      logger.info('User logged in', 'SocialApp', { username });
    } catch (error) {
      logger.error('Login failed', 'SocialApp', error);
    }
  }

  async register(username: string, password: string) {
    try {
      const user = await authManager.register({ username, password });
      this.userState.update(state => ({ ...state, loggedIn: true, userId: user.pub }));
      this.setState({ loggedIn: true, userId: user.pub });
      logger.info('User registered', 'SocialApp', { username });
    } catch (error) {
      logger.error('Registration failed', 'SocialApp', error);
    }
  }

  logout() {
    authManager.logout();
    this.userState.update(state => ({ ...state, loggedIn: false, userId: null }));
    this.setState({ loggedIn: false, userId: null });
    logger.info('User logged out', 'SocialApp');
  }

  async createPost(content: string) {
    const postId = CryptoUtils.generateRandomId();
    const post = new Post({ postId });
    const currentUser = await this.userState.get();
    await post.setPostContent(content, currentUser.userId!);
    logger.info('New post created', 'SocialApp', { postId });
  }

  private async renderProfile() {
    const currentUser = await this.userState.get();
    if (!currentUser.loggedIn) return '<p>Please log in to view your profile.</p>';
    const profile = new UserProfile({ userId: currentUser.userId! });
    return profile.render();
  }

  private async renderFeed() {
    const currentUser = await this.userState.get();
    if (!currentUser.loggedIn) return '<p>Please log in to view the feed.</p>';
    const posts = await app.searchComponents('type:post', 10);
    return posts.map(post => new Post({ postId: post.id }).render()).join('');
  }

  private async handleNewPost(data: { content: string }) {
    await this.createPost(data.content);
    return { success: true };
  }

  render(): string {
    if (!(this.state as any).loggedIn) {
      return `
        <div>
          <h1>Welcome to DecentralizedSocial</h1>
          <button onclick="app.route('/login')">Login</button>
          <button onclick="app.route('/register')">Register</button>
        </div>
      `;
    } else {
      return `
        <div>
          <h1>DecentralizedSocial</h1>
          <nav>
            <a href="#" onclick="app.route('/profile')">Profile</a>
            <a href="#" onclick="app.route('/feed')">Feed</a>
          </nav>
          <button onclick="this.logout()">Logout</button>
          <div id="content"></div>
          <div>
            <textarea id="newPost"></textarea>
            <button onclick="app.broadcastRoute('/post', { content: document.getElementById('newPost').value })">Post</button>
          </div>
        </div>
      `;
    }
  }
}

// Initialize and start the application
const socialApp = new SocialApp();

app.start().then(() => {
  logger.info('DecentralizedSocial app started', 'main');
  socialApp.mount(document.getElementById('app')!);
});

// Set up peer connections
peerManager.on('peerConnected', (peerId) => {
  logger.info('New peer connected', 'main', { peerId });
});

// Handle errors
app.on('error', (error) => {
  logger.error('Application error', 'main', error);
});

// Example of using DevTools
const devTools = app.getDevTools();
devTools.on('devToolsUpdate', (update) => {
  console.log('DevTools update:', update);
});

// Start performance profiling
devTools.startPerformanceProfile('appStart');

// Simulate some app usage
setTimeout(() => {
  socialApp.register('testuser', 'password123');
  socialApp.createPost('Hello, decentralized world!');
  devTools.stopPerformanceProfile('appStart');
}, 5000);