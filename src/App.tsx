import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';

type ClipMeta = {
  id: string;
  filePath: string;
  fileName: string;
  fileUrl: string;
  duration: number;
  width?: number;
  height?: number;
};

type Selection = {
  in: number;
  out: number;
};

type ExportState =
  | { status: 'idle' }
  | { status: 'exporting' }
  | { status: 'success'; message: string; outputPath: string }
  | { status: 'error'; message: string };

const ACCEPTED_EXTENSIONS = ['.mp4', '.mov'];
const MIN_SELECTION = 0.1; // seconds

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) {
    value = 0;
  }

  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toFixed(2).padStart(5, '0')}`;
};

const extractFileName = (filePath: string) => {
  const segments = filePath.split(/[/\\]/);
  return segments[segments.length - 1] ?? filePath;
};

const hasSupportedExtension = (filePath: string) => {
  const match = filePath.match(/\.[^.]+$/);
  return match ? ACCEPTED_EXTENSIONS.includes(match[0].toLowerCase()) : false;
};

const App = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const [clip, setClip] = useState<ClipMeta | null>(null);
  const [selection, setSelection] = useState<Selection>({ in: 0, out: 0 });
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });
  const [dragging, setDragging] = useState<null | 'in' | 'out' | 'playhead'>(null);

  const resetPlayerState = useCallback(() => {
    setSelection({ in: 0, out: 0 });
    setCurrentTime(0);
    setIsPlaying(false);
    setExportState({ status: 'idle' });
  }, []);

  const handleFilePaths = useCallback(async (paths: string[]) => {
    if (!paths?.length) {
      return;
    }

    const chosenPath = paths[0];
    if (!hasSupportedExtension(chosenPath)) {
      setError('Unsupported file type. Please import MP4 or MOV with H.264/AAC.');
      return;
    }

    try {
      const fileUrl = await window.api.pathToFileUrl(chosenPath);

      videoRef.current?.pause();

      setClip({
        id: crypto.randomUUID(),
        filePath: chosenPath,
        fileName: extractFileName(chosenPath),
        fileUrl,
        duration: 0,
      });
      resetPlayerState();
      setError(null);
    } catch (err) {
      console.error('Failed to prepare video URL', err);
      setError('Unable to load the selected file.');
    }
  }, [resetPlayerState]);

  const handleImportClick = useCallback(async () => {
    const paths = await window.api.openVideoDialog();
    void handleFilePaths(paths);
  }, [handleFilePaths]);

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!event.dataTransfer?.files?.length) {
        return;
      }

      const files = Array.from(event.dataTransfer.files);
      const supported = files.find((file) => hasSupportedExtension(file.path));

      if (!supported) {
        setError('Unsupported file type. Please drop an MP4 or MOV file.');
        return;
      }

      void handleFilePaths([supported.path]);
    },
    [handleFilePaths],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const duration = Number.isFinite(video.duration) ? video.duration : 0;

    setClip((prev) =>
      prev
        ? {
            ...prev,
            duration,
            width: video.videoWidth,
            height: video.videoHeight,
          }
        : prev,
    );

    const safeDuration = duration > 0 ? duration : MIN_SELECTION;
    setSelection({ in: 0, out: safeDuration });
    setCurrentTime(0);
    setError(null);
  }, []);

  const handleVideoError = useCallback(() => {
    setError(
      'Unable to load video preview. Please use MP4 or MOV encoded with H.264 video and AAC audio.',
    );
    setClip((prev) => (prev ? { ...prev, duration: 0 } : prev));
    setSelection({ in: 0, out: MIN_SELECTION });
    setIsPlaying(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    const nextTime = video.currentTime;
    if (nextTime >= selection.out && selection.out > selection.in) {
      video.pause();
      video.currentTime = selection.in;
      setIsPlaying(false);
      setCurrentTime(selection.in);
      return;
    }

    setCurrentTime(nextTime);
  }, [selection.in, selection.out]);

  const handlePlayPause = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (!clip?.duration) {
      return;
    }

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
      return;
    }

    if (video.currentTime < selection.in || video.currentTime >= selection.out) {
      video.currentTime = selection.in;
    }

    try {
      await video.play();
      setIsPlaying(true);
    } catch (err) {
      console.error('Failed to play video', err);
      setError('Unable to start playback.');
      setIsPlaying(false);
    }
  }, [clip?.duration, isPlaying, selection.in, selection.out]);

  const clampTime = useCallback(
    (value: number) => {
      if (!clip?.duration) {
        return 0;
      }

      return Math.min(Math.max(value, 0), clip.duration);
    },
    [clip?.duration],
  );

  const updateSelection = useCallback(
    (next: Partial<Selection>) => {
      setSelection((prev) => {
        const updated: Selection = {
          in: 'in' in next ? next.in ?? prev.in : prev.in,
          out: 'out' in next ? next.out ?? prev.out : prev.out,
        };

        if (updated.out - updated.in < MIN_SELECTION) {
          if ('in' in next && next.in !== undefined) {
            updated.out = updated.in + MIN_SELECTION;
          } else if ('out' in next && next.out !== undefined) {
            updated.in = updated.out - MIN_SELECTION;
          }
        }

        if (clip?.duration) {
          updated.in = Math.max(0, Math.min(updated.in, clip.duration - MIN_SELECTION));
          updated.out = Math.min(clip.duration, Math.max(updated.out, updated.in + MIN_SELECTION));
        }

        return updated;
      });
    },
    [clip?.duration],
  );

  const handleScrub = useCallback(
    (value: number) => {
      const video = videoRef.current;
      if (!video || !clip?.duration) {
        return;
      }

      const time = clampTime(value);
      video.currentTime = time;
      setCurrentTime(time);
      if (time < selection.in || time > selection.out) {
        setIsPlaying(false);
        video.pause();
      }
    },
    [clampTime, clip?.duration, selection.in, selection.out],
  );

  const computePointerTime = useCallback(
    (clientX: number) => {
      if (!clip?.duration) {
        return 0;
      }

      const rect = timelineRef.current?.getBoundingClientRect();
      if (!rect) {
        return 0;
      }

      const ratio = (clientX - rect.left) / rect.width;
      const clamped = Math.min(Math.max(ratio, 0), 1);
      return clamped * clip.duration;
    },
    [clip?.duration],
  );

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextTime = computePointerTime(event.clientX);

      if (dragging === 'in') {
        const maxIn = selection.out - MIN_SELECTION;
        const clamped = Math.min(nextTime, maxIn);
        updateSelection({ in: clamped });
        handleScrub(clamped);
      } else if (dragging === 'out') {
        const minOut = selection.in + MIN_SELECTION;
        const clamped = Math.max(nextTime, minOut);
        updateSelection({ out: clamped });
        handleScrub(clamped);
      } else if (dragging === 'playhead') {
        handleScrub(nextTime);
      }
    };

    const stopDragging = () => {
      setDragging(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
    };
  }, [computePointerTime, dragging, handleScrub, selection.in, selection.out, updateSelection]);

  useEffect(() => {
    if (!clip?.duration) {
      return;
    }

    if (currentTime < selection.in) {
      setCurrentTime(selection.in);
      if (videoRef.current) {
        videoRef.current.currentTime = selection.in;
      }
    } else if (currentTime > selection.out) {
      setCurrentTime(selection.out);
      if (videoRef.current) {
        videoRef.current.currentTime = selection.out;
      }
    }
  }, [clip?.duration, currentTime, selection.in, selection.out]);

  const selectionDuration = useMemo(
    () => Math.max(selection.out - selection.in, 0),
    [selection.in, selection.out],
  );

  const selectionProgress = useMemo(() => {
    if (!clip?.duration) {
      return { start: 0, width: 0 };
    }

    const start = Math.min((selection.in / clip.duration) * 100, 100);
    const width = Math.min((selectionDuration / clip.duration) * 100, 100 - start);
    return { start, width };
  }, [clip?.duration, selection.in, selectionDuration]);

  const playheadPosition = useMemo(() => {
    if (!clip?.duration) {
      return 0;
    }
    return (currentTime / clip.duration) * 100;
  }, [clip?.duration, currentTime]);

  const actionDisabled = !clip || !clip.duration;

  const handleExport = useCallback(async () => {
    if (!clip || !clip.duration) {
      return;
    }

    if (selectionDuration < MIN_SELECTION) {
      setExportState({ status: 'error', message: 'Selection is too short to export.' });
      return;
    }

    const baseName = clip.fileName.replace(/\.[^.]+$/, '');
    const suggestedName = `${baseName || 'clip'}_trimmed.mp4`;
    const destPath = await window.api.saveExportDialog(suggestedName);

    if (!destPath) {
      return;
    }

    setExportState({ status: 'exporting' });

    const result = await window.api.exportTrim({
      inputPath: clip.filePath,
      inSec: selection.in,
      outSec: selection.out,
      destPath,
      preferCopy: true,
    });

    if (result.ok) {
      setExportState({ status: 'success', message: 'Export complete.', outputPath: destPath });
    } else {
      setExportState({
        status: 'error',
        message: result.error ?? 'Export failed. Please try again.',
      });
    }
  }, [clip, selection.in, selection.out, selectionDuration]);

  const revealExport = useCallback(() => {
    if (exportState.status === 'success') {
      void window.api.revealInFolder(exportState.outputPath);
    }
  }, [exportState]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">ClipForge</h1>
          <p className="text-sm text-slate-400">Import, preview, trim, export — macOS MVP</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 transition hover:border-slate-600 hover:bg-slate-700"
          >
            Import Video
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={actionDisabled || exportState.status === 'exporting'}
            className="rounded-md bg-sky-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {exportState.status === 'exporting' ? 'Exporting…' : 'Export Selection'}
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6">
        <section
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={`rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-6 transition ${
            clip ? 'min-h-[120px]' : 'flex flex-1 items-center justify-center'
          }`}
        >
          {clip ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-100">{clip.fileName}</h2>
                  <p className="text-sm text-slate-400">
                    {clip.duration ? `${formatTime(clip.duration)} • ` : ''}
                    {clip.width && clip.height ? `${clip.width}×${clip.height}` : 'Loading metadata…'}
                  </p>
                </div>
                <div className="flex gap-3 text-sm text-slate-300">
                  <div>
                    <p className="text-xs uppercase text-slate-500">In</p>
                    <p>{formatTime(selection.in)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Out</p>
                    <p>{formatTime(selection.out)}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Length</p>
                    <p>{formatTime(selectionDuration)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
                <div className="flex flex-col gap-3">
                  <div className="aspect-video overflow-hidden rounded-md border border-slate-800 bg-black">
                    {clip.fileUrl ? (
                      <video
                        key={clip.id}
                        ref={videoRef}
                        src={clip.fileUrl}
                        className="h-full w-full bg-black"
                        onLoadedMetadata={handleLoadedMetadata}
                        onTimeUpdate={handleTimeUpdate}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onError={handleVideoError}
                        controls={false}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        Preparing preview…
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-md border border-slate-800 bg-slate-900/60 px-4 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePlayPause}
                        disabled={actionDisabled}
                        className="rounded-full bg-slate-800 p-2 text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-800/70"
                      >
                        {isPlaying ? 'Pause' : 'Play'}
                      </button>
                      <span className="text-sm text-slate-300">
                        {formatTime(currentTime)} / {clip.duration ? formatTime(clip.duration) : '00:00.00'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={clip.duration || 0}
                      step="0.05"
                      value={currentTime}
                      disabled={actionDisabled}
                      onChange={(event) => handleScrub(Number(event.currentTarget.value))}
                      className="h-1 w-60 cursor-pointer accent-sky-500 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div
                    ref={timelineRef}
                    className="relative h-20 rounded-md border border-slate-800 bg-slate-900/60"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      if (!clip?.duration) {
                        return;
                      }

                      const target = event.target as HTMLElement;
                      const nextTime = computePointerTime(event.clientX);

                      if (target.dataset.handle === 'in') {
                        updateSelection({ in: nextTime });
                        handleScrub(Math.min(nextTime, selection.out));
                        setDragging('in');
                      } else if (target.dataset.handle === 'out') {
                        updateSelection({ out: nextTime });
                        handleScrub(Math.max(Math.min(nextTime, clip.duration), selection.in));
                        setDragging('out');
                      } else if (target.dataset.handle === 'playhead') {
                        handleScrub(nextTime);
                        setDragging('playhead');
                      } else {
                        handleScrub(nextTime);
                        setDragging('playhead');
                      }
                    }}
                  >
                    <div className="absolute left-4 right-4 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-800" />
                    <div
                      className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-sky-500/70"
                      style={{
                        left: `${selectionProgress.start}%`,
                        width: `${Math.max(selectionProgress.width, 0)}%`,
                      }}
                    />
                    <button
                      type="button"
                      data-handle="in"
                      className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-400 bg-slate-900/90"
                      style={{ left: `${selectionProgress.start}%` }}
                    />
                    <button
                      type="button"
                      data-handle="out"
                      className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-sky-400 bg-slate-900/90"
                      style={{ left: `${selectionProgress.start + selectionProgress.width}%` }}
                    />
                    <button
                      type="button"
                      data-handle="playhead"
                      className="absolute top-1/2 h-6 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400"
                      style={{ left: `${playheadPosition}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4 rounded-md border border-slate-800 bg-slate-900/60 p-4">
                  <h3 className="text-base font-semibold text-slate-100">Clip Details</h3>
                  <dl className="grid gap-2 text-sm text-slate-300">
                    <div className="flex justify-between">
                      <dt className="text-slate-500">File path</dt>
                      <dd className="max-w-[60%] truncate text-right" title={clip.filePath}>
                        {clip.filePath}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Duration</dt>
                      <dd>{clip.duration ? formatTime(clip.duration) : 'Loading…'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Selection</dt>
                      <dd>{formatTime(selectionDuration)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Resolution</dt>
                      <dd>
                        {clip.width && clip.height ? `${clip.width}×${clip.height}` : '—'}
                      </dd>
                    </div>
                  </dl>

                  <div className="rounded-md border border-slate-800 bg-slate-900/50 p-3 text-sm text-slate-300">
                    <p className="font-medium text-slate-200">Export Settings</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-400">
                      <li>Fast stream copy when possible</li>
                      <li>Fallback to H.264 + AAC re-encode</li>
                      <li>File saved where you choose</li>
                    </ul>
                  </div>

                  {exportState.status === 'error' && (
                    <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {exportState.message}
                    </div>
                  )}
                  {exportState.status === 'success' && (
                    <div className="flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                      <span>{exportState.message}</span>
                      <button
                        type="button"
                        onClick={revealExport}
                        className="rounded bg-emerald-500/20 px-2 py-1 text-xs text-emerald-100 transition hover:bg-emerald-500/30"
                      >
                        Reveal in Finder
                      </button>
                    </div>
                  )}
                  {exportState.status === 'exporting' && (
                    <div className="rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-sm text-sky-200">
                      Exporting… This may take a moment.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <div className="rounded-full border border-slate-800 bg-slate-900/60 px-4 py-1 text-xs uppercase tracking-[0.3em] text-slate-500">
                Start Here
              </div>
              <h2 className="text-3xl font-semibold text-slate-100">Import your first clip</h2>
              <p className="max-w-md text-sm text-slate-400">
                Drag and drop an MP4 or MOV file, or use the Import button above. Supported codecs: H.264 video with AAC audio.
              </p>
              <div className="rounded-md border border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-500">
                Tip: Selection is limited to a single clip in this MVP.
              </div>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
