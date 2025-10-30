import { app, BrowserWindow, ipcMain, dialog, protocol, desktopCapturer } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import ffmpeg from 'fluent-ffmpeg';

// Set FFmpeg and FFprobe paths
// Handle both development and packaged scenarios
if (app.isPackaged) {
  // In packaged app, binaries are in extraResources
  const ffmpegPath = path.join(process.resourcesPath, 'ffmpeg-static', 'ffmpeg');
  const ffprobePath = path.join(process.resourcesPath, 'ffprobe-static', 'bin', 'darwin', 'arm64', 'ffprobe');

  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);
  console.log('FFmpeg path set to:', ffmpegPath);
  console.log('FFprobe path set to:', ffprobePath);
} else {
  // In development, use the npm packages
  const ffmpegStatic = require('ffmpeg-static');
  const ffprobeStatic = require('ffprobe-static');

  if (ffmpegStatic) {
    ffmpeg.setFfmpegPath(ffmpegStatic);
    console.log('FFmpeg path set to:', ffmpegStatic);
  }

  if (ffprobeStatic.path) {
    ffmpeg.setFfprobePath(ffprobeStatic.path);
    console.log('FFprobe path set to:', ffprobeStatic.path);
  }
}

// Register custom protocol schemes before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-video',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: false,
      stream: true,
    },
  },
]);

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Allow loading local video files in dev
    },
  });

  console.log('Window created, preload path:', path.join(__dirname, 'preload.js'));

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools in development
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

// Register custom protocol to serve local video files
app.whenReady().then(() => {
  protocol.registerFileProtocol('local-video', (request, callback) => {
    const url = request.url.replace('local-video://', '');
    const decodedPath = decodeURIComponent(url);

    try {
      return callback({ path: decodedPath });
    } catch (error) {
      console.error('Error serving local video:', error);
      return callback({ path: '' });
    }
  });

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

// IPC Handlers

// File selection dialog
ipcMain.handle('dialog:selectVideoFiles', async () => {
  console.log('Opening file dialog...');
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] },
    ],
  });

  if (result.canceled) {
    console.log('File dialog canceled');
    return [];
  }

  console.log('Selected files:', result.filePaths);
  return result.filePaths;
});

// Get video metadata
ipcMain.handle('video:getMetadata', async (_event, filePath: string) => {
  console.log('Getting metadata for:', filePath);

  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        console.error('FFprobe error:', err);
        reject(err);
        return;
      }

      try {
        const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
        const stats = fs.statSync(filePath);

        const result = {
          id: Date.now().toString() + Math.random().toString(36).substring(7),
          name: path.basename(filePath),
          path: filePath,
          duration: metadata.format.duration || 0,
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          size: stats.size,
        };

        console.log('Metadata result:', result);
        resolve(result);
      } catch (error) {
        console.error('Error processing metadata:', error);
        reject(error);
      }
    });
  });
});

// Export video
ipcMain.handle('video:export', async (event, options) => {
  let { outputPath, clips } = options;

  // Generate output path if not provided
  if (!outputPath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const desktopPath = app.getPath('desktop');
    outputPath = path.join(desktopPath, `ClipForge-Export-${timestamp}.mp4`);
  }

  console.log('Exporting to:', outputPath);

  return new Promise(async (resolve, reject) => {
    if (clips.length === 0) {
      reject(new Error('No clips to export'));
      return;
    }

    try {
      // Sort clips by track and start time
      const sortedClips = [...clips].sort((a, b) => {
        if (a.track !== b.track) return a.track - b.track;
        return a.startTime - b.startTime;
      });

      // For MVP and multi-clip support
      if (sortedClips.length === 1) {
        // Single clip export with trim
        const clip = sortedClips[0];
        const command = ffmpeg();

        if (clip.trimStart > 0 || clip.trimEnd < clip.duration) {
          command
            .input(clip.clipId)
            .setStartTime(clip.trimStart)
            .setDuration(clip.duration);
        } else {
          command.input(clip.clipId);
        }

        command
          .output(outputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .on('progress', (progress) => {
            event.sender.send('export:progress', progress.percent || 0);
          })
          .on('end', () => {
            event.sender.send('export:complete', outputPath);
            resolve(null);
          })
          .on('error', (err) => {
            event.sender.send('export:error', err.message);
            reject(err);
          })
          .run();
      } else {
        // Multi-clip export: Create temporary trimmed clips then concatenate
        const tempDir = path.join(app.getPath('temp'), `clipforge-${Date.now()}`);
        fs.mkdirSync(tempDir, { recursive: true });

        const tempFiles: string[] = [];
        const processClip = (clip: any, index: number): Promise<string> => {
          return new Promise((resolveClip, rejectClip) => {
            const tempFile = path.join(tempDir, `clip-${index}.mp4`);
            tempFiles.push(tempFile);

            const cmd = ffmpeg()
              .input(clip.clipId)
              .setStartTime(clip.trimStart)
              .setDuration(clip.duration)
              .output(tempFile)
              .videoCodec('libx264')
              .audioCodec('aac')
              .on('end', () => resolveClip(tempFile))
              .on('error', (err) => rejectClip(err));

            cmd.run();
          });
        };

        // Process all clips
        const processedFiles = await Promise.all(
          sortedClips.map((clip, idx) => processClip(clip, idx))
        );

        // Create concat list file
        const concatListPath = path.join(tempDir, 'concat.txt');
        const concatList = processedFiles.map((f) => `file '${f}'`).join('\n');
        fs.writeFileSync(concatListPath, concatList);

        // Concatenate all clips
        ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions(['-c copy'])
          .output(outputPath)
          .on('progress', (progress) => {
            event.sender.send('export:progress', progress.percent || 0);
          })
          .on('end', () => {
            // Cleanup temp files
            tempFiles.forEach((f) => {
              try {
                fs.unlinkSync(f);
              } catch (e) {
                /* ignore */
              }
            });
            try {
              fs.unlinkSync(concatListPath);
              fs.rmdirSync(tempDir);
            } catch (e) {
              /* ignore */
            }

            event.sender.send('export:complete', outputPath);
            resolve(null);
          })
          .on('error', (err) => {
            event.sender.send('export:error', err.message);
            reject(err);
          })
          .run();
      }
    } catch (err) {
      event.sender.send('export:error', (err as Error).message);
      reject(err);
    }
  });
});

// Recording handlers
ipcMain.handle('recording:getScreenSources', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 150, height: 150 },
    });

    if (sources.length === 0) {
      throw new Error(
        'No screen sources available. On macOS, please grant Screen Recording permission in System Settings > Privacy & Security > Screen Recording.'
      );
    }

    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  } catch (error) {
    console.error('Error getting screen sources:', error);
    if (error instanceof Error) {
      throw new Error(
        `Failed to get screen sources. On macOS, please check System Settings > Privacy & Security > Screen Recording and make sure ClipForge has permission. Error: ${error.message}`
      );
    }
    throw error;
  }
});

ipcMain.handle('recording:save', async (_event, blobData: Uint8Array) => {
  try {
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ClipForge-Recording-${timestamp}.webm`;

    // Save to desktop
    const desktopPath = app.getPath('desktop');
    const videoPath = path.join(desktopPath, filename);

    const buffer = Buffer.from(blobData);
    fs.writeFileSync(videoPath, buffer);
    console.log('Recording saved to:', videoPath);
    return videoPath;
  } catch (error) {
    console.error('Error saving recording:', error);
    throw error;
  }
});
