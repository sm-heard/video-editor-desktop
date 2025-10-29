// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

export interface VideoClip {
  id: string;
  name: string;
  path: string;
  duration: number;
  width: number;
  height: number;
  size: number;
}

export interface TimelineClip {
  id: string;
  clipId: string;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  track: number;
}

export interface ExportOptions {
  outputPath?: string;
  resolution?: string;
  clips: TimelineClip[];
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectVideoFiles: () => ipcRenderer.invoke('dialog:selectVideoFiles'),
  getVideoMetadata: (filePath: string) => ipcRenderer.invoke('video:getMetadata', filePath),

  // Export operations
  exportVideo: (options: ExportOptions) => ipcRenderer.invoke('video:export', options),

  // Recording operations
  startScreenRecording: () => ipcRenderer.invoke('recording:startScreen'),
  startWebcamRecording: () => ipcRenderer.invoke('recording:startWebcam'),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),

  // Listen to events
  onExportProgress: (callback: (progress: number) => void) => {
    ipcRenderer.on('export:progress', (_event, progress) => callback(progress));
  },

  onExportComplete: (callback: (outputPath: string) => void) => {
    ipcRenderer.on('export:complete', (_event, outputPath) => callback(outputPath));
  },

  onExportError: (callback: (error: string) => void) => {
    ipcRenderer.on('export:error', (_event, error) => callback(error));
  },
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      selectVideoFiles: () => Promise<string[]>;
      getVideoMetadata: (filePath: string) => Promise<VideoClip>;
      exportVideo: (options: ExportOptions) => Promise<void>;
      startScreenRecording: () => Promise<string>;
      startWebcamRecording: () => Promise<string>;
      stopRecording: () => Promise<void>;
      onExportProgress: (callback: (progress: number) => void) => void;
      onExportComplete: (callback: (outputPath: string) => void) => void;
      onExportError: (callback: (error: string) => void) => void;
    };
  }
}
