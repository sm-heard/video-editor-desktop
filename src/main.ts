import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execa } from 'execa';
import ffmpeg from 'ffmpeg-static';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#020617',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: app.isPackaged,
      allowRunningInsecureContent: !app.isPackaged,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (!app.isPackaged) {
    // Open the DevTools when running in development for faster iteration.
    mainWindow.webContents.openDevTools();
  }
};

const getFfmpegPath = () => {
  const binaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const candidates = new Set<string>();

  if (typeof ffmpeg === 'string') {
    candidates.add(ffmpeg);
  }

  const appPath = app.getAppPath();

  if (!app.isPackaged) {
    candidates.add(path.join(appPath, 'node_modules', 'ffmpeg-static', binaryName));
    candidates.add(path.join(appPath, '..', 'node_modules', 'ffmpeg-static', binaryName));
  }

  candidates.add(path.join(process.resourcesPath, binaryName));

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`FFmpeg binary not found. Checked: ${Array.from(candidates).join(', ')}`);
};

const registerIpcHandlers = () => {
  ipcMain.handle('dialog:openVideos', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Video', extensions: ['mp4', 'mov'] }],
    });

    if (result.canceled) {
      return [];
    }

    return result.filePaths;
  });

  ipcMain.handle('dialog:saveExport', async (_event, defaultFileName: string) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultFileName,
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
    });

    if (result.canceled || !result.filePath) {
      return null;
    }

    return result.filePath;
  });

  ipcMain.handle('path:toFileUrl', (_event, filePath: string) => {
    return pathToFileURL(filePath).href;
  });

  ipcMain.handle('file:reveal', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return true;
  });

  ipcMain.handle('export:trim', async (_event, payload) => {
    const { inputPath, inSec, outSec, destPath, preferCopy = true } = payload ?? {};

    if (!inputPath || !destPath || typeof inSec !== 'number' || typeof outSec !== 'number') {
      return { ok: false, error: 'Invalid export payload' };
    }

    const ffmpegPath = getFfmpegPath();
    const baseArgs = ['-ss', `${inSec}`, '-to', `${outSec}`, '-i', inputPath];

    const tryExport = async (args: string[]) => {
      await execa(ffmpegPath, args, {
        windowsHide: true,
      });
    };

    if (preferCopy) {
      try {
        await tryExport([...baseArgs, '-c', 'copy', '-y', destPath]);
        return { ok: true };
      } catch (copyError) {
        console.warn('Stream copy export failed, retrying with re-encode.', copyError);
      }
    }

    try {
      await tryExport([
        ...baseArgs,
        '-c:v',
        'libx264',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        '-preset',
        'veryfast',
        '-y',
        destPath,
      ]);
      return { ok: true };
    } catch (encodeError) {
      console.error('Export failed', encodeError);

      let errorMessage = 'Export failed';
      if (encodeError instanceof Error && encodeError.message) {
        errorMessage = encodeError.message;
      } else if (
        typeof encodeError === 'object' &&
        encodeError !== null &&
        'stderr' in encodeError &&
        typeof (encodeError as { stderr?: unknown }).stderr === 'string'
      ) {
        errorMessage = (encodeError as { stderr: string }).stderr;
      }

      return {
        ok: false,
        error: errorMessage,
      };
    }
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
