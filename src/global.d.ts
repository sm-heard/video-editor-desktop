import type { ClipForgeAPI } from './preload';

declare global {
  interface Window {
    api: ClipForgeAPI;
  }
}

export {};
