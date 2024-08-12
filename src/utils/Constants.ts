export const BROWSER_CONTEXT = 'browser';
export const SERVER_CONTEXT = 'server';
export const PEER_CONTEXT = 'peer';

export const DEFAULT_PEER_URL = 'https://gun-manhattan.herokuapp.com/gun';

export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_DELAY_MS = 1000;

export const DEFAULT_DEBOUNCE_TIME = 300;
export const DEFAULT_THROTTLE_TIME = 300;

export const MAX_BATCH_SIZE = 100;

export const STORAGE_PREFIX = 'decentralized_app_';

export const CRYPTO_ALGORITHM = 'AES-GCM';
export const CRYPTO_KEY_LENGTH = 256;

export const DEFAULT_LOG_LEVEL = 'info';

export const EVENT_STATE_CHANGE = 'state_change';
export const EVENT_PEER_CONNECTED = 'peer_connected';
export const EVENT_PEER_DISCONNECTED = 'peer_disconnected';
export const EVENT_SYNC_COMPLETE = 'sync_complete';
export const EVENT_AUTH_STATE_CHANGE = 'auth_state_change';

export const DEFAULT_COMPONENT_PREFIX = 'da'; // for DecentralizedApp

export const API_VERSION = '1.0.0';

export const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB

export const RESERVED_KEYS = ['_', '#', '@', '$', '=', '+'];

export const DEFAULT_TIMEOUT = 30000; // 30 seconds

export const PLUGIN_NAMESPACE = 'decentralized_app_plugin_';

export const DEV_TOOLS_KEY = '__DECENTRALIZED_APP_DEVTOOLS__';