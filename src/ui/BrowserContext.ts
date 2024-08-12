import { Context } from '../Types';

export const BROWSER_CONTEXT: Context = 'browser';

export function isBrowserContext(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function executeInBrowserContext(func: Function): any {
  if (isBrowserContext()) {
    return func();
  } else {
    throw new Error('Attempted to execute browser-specific code in a non-browser environment');
  }
}

export function getBrowserInfo(): {name: string, version: string} {
  const ua = navigator.userAgent;
  let browserName = "Unknown";
  let browserVersion = "Unknown";

  if (ua.indexOf("Firefox") > -1) {
    browserName = "Firefox";
    browserVersion = ua.match(/Firefox\/(\d+\.\d+)/)?.[1] || "Unknown";
  } else if (ua.indexOf("Chrome") > -1) {
    browserName = "Chrome";
    browserVersion = ua.match(/Chrome\/(\d+\.\d+)/)?.[1] || "Unknown";
  } else if (ua.indexOf("Safari") > -1) {
    browserName = "Safari";
    browserVersion = ua.match(/Version\/(\d+\.\d+)/)?.[1] || "Unknown";
  } else if (ua.indexOf("MSIE") > -1 || ua.indexOf("Trident/") > -1) {
    browserName = "Internet Explorer";
    browserVersion = ua.match(/(?:MSIE |rv:)(\d+\.\d+)/)?.[1] || "Unknown";
  } else if (ua.indexOf("Edge") > -1) {
    browserName = "Edge";
    browserVersion = ua.match(/Edge\/(\d+\.\d+)/)?.[1] || "Unknown";
  }

  return { name: browserName, version: browserVersion };
}

export function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
}

export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

export function isWebSocketSupported(): boolean {
  return 'WebSocket' in window;
}

export function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function getScreenSize(): {width: number, height: number} {
  return {
    width: window.screen.width,
    height: window.screen.height
  };
}

export function getBrowserLanguage(): string {
  return navigator.language || (navigator as any).userLanguage;
}

export function isOnline(): boolean {
  return navigator.onLine;
}