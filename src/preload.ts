import { contextBridge, ipcRenderer } from 'electron';

export type ExportTrimPayload = {
  inputPath: string;
  inSec: number;
  outSec: number;
  destPath: string;
  preferCopy?: boolean;
};

export type ExportTrimResult = {
  ok: boolean;
  error?: string;
};

export type ClipForgeAPI = {
  openVideoDialog: () => Promise<string[]>;
  saveExportDialog: (defaultFileName: string) => Promise<string | null>;
  pathToFileUrl: (filePath: string) => Promise<string>;
  revealInFolder: (filePath: string) => Promise<boolean>;
  exportTrim: (payload: ExportTrimPayload) => Promise<ExportTrimResult>;
};

const api: ClipForgeAPI = {
  openVideoDialog: () => ipcRenderer.invoke('dialog:openVideos'),
  saveExportDialog: (defaultFileName) =>
    ipcRenderer.invoke('dialog:saveExport', defaultFileName),
  pathToFileUrl: (filePath) => ipcRenderer.invoke('path:toFileUrl', filePath),
  revealInFolder: (filePath) => ipcRenderer.invoke('file:reveal', filePath),
  exportTrim: (payload) => ipcRenderer.invoke('export:trim', payload),
};

contextBridge.exposeInMainWorld('api', api);
