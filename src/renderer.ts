/**
 * ClipForge - Video Editor Renderer Process
 */

import './index.css';

console.log('ClipForge Video Editor - Renderer loaded');

// Types
interface VideoClip {
  id: string;
  name: string;
  path: string;
  duration: number;
  width: number;
  height: number;
  size: number;
}

interface TimelineClip {
  id: string;
  clipId: string;
  videoClip: VideoClip;
  startTime: number;
  duration: number;
  trimStart: number;
  trimEnd: number;
  track: number;
}

// Application State
class VideoEditorApp {
  private mediaClips: Map<string, VideoClip> = new Map();
  private timelineClips: Map<string, TimelineClip> = new Map();
  private selectedMediaClipId: string | null = null;
  private selectedTimelineClipId: string | null = null;
  private currentTime: number = 0;
  private isPlaying: boolean = false;
  private timelineZoom: number = 100;
  private pixelsPerSecond: number = 50;

  // DOM Elements
  private previewVideo: HTMLVideoElement;
  private previewPlaceholder: HTMLElement;
  private mediaClipsContainer: HTMLElement;
  private timelineContainer: HTMLElement;
  private playhead: HTMLElement;
  private seekBar: HTMLInputElement;
  private timeDisplay: HTMLElement;

  constructor() {
    this.initElements();
    this.initEventListeners();
    this.setupExportListeners();
  }

  private initElements() {
    this.previewVideo = document.getElementById('preview-video') as HTMLVideoElement;
    this.previewPlaceholder = document.getElementById('preview-placeholder') as HTMLElement;
    this.mediaClipsContainer = document.getElementById('media-clips') as HTMLElement;
    this.timelineContainer = document.getElementById('timeline-container') as HTMLElement;
    this.playhead = document.getElementById('playhead') as HTMLElement;
    this.seekBar = document.getElementById('seek-bar') as HTMLInputElement;
    this.timeDisplay = document.getElementById('time-display') as HTMLElement;
  }

  private initEventListeners() {
    // Import button
    document.getElementById('import-btn')?.addEventListener('click', () => this.importVideos());

    // Export button
    document.getElementById('export-btn')?.addEventListener('click', () => this.exportVideo());

    // Preview controls
    document.getElementById('play-btn')?.addEventListener('click', () => this.play());
    document.getElementById('pause-btn')?.addEventListener('click', () => this.pause());

    // Seek bar
    this.seekBar.addEventListener('input', (e) => {
      const target = e.target as HTMLInputElement;
      this.seek(parseFloat(target.value));
    });

    // Video events
    this.previewVideo.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.previewVideo.addEventListener('loadedmetadata', () => this.onVideoLoaded());

    // Timeline zoom
    document.getElementById('zoom-in-btn')?.addEventListener('click', () => this.zoomTimeline(1.2));
    document.getElementById('zoom-out-btn')?.addEventListener('click', () => this.zoomTimeline(0.8));

    // Drag and drop on timeline tracks
    const tracks = document.querySelectorAll('.track-content');
    tracks.forEach((track) => {
      track.addEventListener('dragover', (e) => this.onTrackDragOver(e as DragEvent));
      track.addEventListener('drop', (e) => this.onTrackDrop(e as DragEvent));
    });
  }

  private setupExportListeners() {
    window.electronAPI.onExportProgress((progress) => {
      console.log(`Export progress: ${progress}%`);
    });

    window.electronAPI.onExportComplete((outputPath) => {
      alert(`Video exported successfully to: ${outputPath}`);
    });

    window.electronAPI.onExportError((error) => {
      alert(`Export error: ${error}`);
    });
  }

  async importVideos() {
    try {
      console.log('Starting import...');

      if (!window.electronAPI) {
        console.error('electronAPI not available!');
        alert('Application not properly initialized. Please reload.');
        return;
      }

      const filePaths = await window.electronAPI.selectVideoFiles();
      console.log('Selected file paths:', filePaths);

      if (filePaths.length === 0) {
        console.log('No files selected');
        return;
      }

      for (const filePath of filePaths) {
        console.log('Processing file:', filePath);
        try {
          const metadata = await window.electronAPI.getVideoMetadata(filePath);
          console.log('Got metadata:', metadata);
          this.addMediaClip(metadata);
        } catch (err) {
          console.error(`Error processing ${filePath}:`, err);
          alert(`Failed to import ${filePath}: ${err}`);
        }
      }
    } catch (error) {
      console.error('Error importing videos:', error);
      alert(`Failed to import videos: ${error}`);
    }
  }

  private addMediaClip(clip: VideoClip) {
    this.mediaClips.set(clip.id, clip);
    this.renderMediaClip(clip);
    this.updateExportButton();
  }

  private renderMediaClip(clip: VideoClip) {
    const clipElement = document.createElement('div');
    clipElement.className = 'media-clip';
    clipElement.dataset.clipId = clip.id;
    clipElement.draggable = true;

    const name = document.createElement('div');
    name.className = 'media-clip-name';
    name.textContent = clip.name;

    const info = document.createElement('div');
    info.className = 'media-clip-info';
    info.textContent = `${this.formatTime(clip.duration)} | ${clip.width}x${clip.height} | ${this.formatFileSize(clip.size)}`;

    clipElement.appendChild(name);
    clipElement.appendChild(info);

    // Click to preview
    clipElement.addEventListener('click', () => this.selectMediaClip(clip.id));

    // Double-click to add to timeline
    clipElement.addEventListener('dblclick', () => this.addToTimeline(clip.id, 0));

    // Drag start
    clipElement.addEventListener('dragstart', (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData('clipId', clip.id);
      }
    });

    this.mediaClipsContainer.appendChild(clipElement);
  }

  private selectMediaClip(clipId: string) {
    // Deselect previous
    document.querySelectorAll('.media-clip').forEach((el) => el.classList.remove('selected'));

    // Select new
    const clipElement = document.querySelector(`[data-clip-id="${clipId}"]`);
    clipElement?.classList.add('selected');

    this.selectedMediaClipId = clipId;

    // Preview the clip
    const clip = this.mediaClips.get(clipId);
    if (clip) {
      this.loadVideoPreview(clip.path);
    }
  }

  private loadVideoPreview(videoPath: string) {
    // Load local video file directly (webSecurity disabled for dev)
    this.previewVideo.src = `file://${videoPath}`;
    this.previewVideo.classList.add('active');
    this.previewPlaceholder.style.display = 'none';
    console.log('Loading video from:', this.previewVideo.src);
  }

  private onVideoLoaded() {
    this.seekBar.max = this.previewVideo.duration.toString();
    this.updateTimeDisplay();
  }

  private play() {
    this.previewVideo.play();
    this.isPlaying = true;
  }

  private pause() {
    this.previewVideo.pause();
    this.isPlaying = false;
  }

  private seek(time: number) {
    this.previewVideo.currentTime = time;
    this.currentTime = time;
  }

  private onTimeUpdate() {
    this.currentTime = this.previewVideo.currentTime;
    this.seekBar.value = this.currentTime.toString();
    this.updateTimeDisplay();
    this.updatePlayhead();
  }

  private updateTimeDisplay() {
    const current = this.formatTime(this.previewVideo.currentTime);
    const total = this.formatTime(this.previewVideo.duration);
    this.timeDisplay.textContent = `${current} / ${total}`;
  }

  private updatePlayhead() {
    const position = 80 + this.currentTime * this.pixelsPerSecond * (this.timelineZoom / 100);
    this.playhead.style.left = `${position}px`;
  }

  private addToTimeline(clipId: string, track: number) {
    const clip = this.mediaClips.get(clipId);
    if (!clip) return;

    // Find the end of the last clip on this track
    let startTime = 0;
    this.timelineClips.forEach((tClip) => {
      if (tClip.track === track) {
        const endTime = tClip.startTime + tClip.duration;
        if (endTime > startTime) {
          startTime = endTime;
        }
      }
    });

    const timelineClip: TimelineClip = {
      id: `timeline-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      clipId: clip.id,
      videoClip: clip,
      startTime: startTime,
      duration: clip.duration,
      trimStart: 0,
      trimEnd: clip.duration,
      track: track,
    };

    this.timelineClips.set(timelineClip.id, timelineClip);
    this.renderTimelineClip(timelineClip);
    this.updateExportButton();
  }

  private renderTimelineClip(clip: TimelineClip) {
    const track = document.querySelector(`#track-${clip.track + 1} .track-content`);
    if (!track) return;

    const clipElement = document.createElement('div');
    clipElement.className = 'timeline-clip';
    clipElement.dataset.timelineClipId = clip.id;

    const width = clip.duration * this.pixelsPerSecond * (this.timelineZoom / 100);
    const left = clip.startTime * this.pixelsPerSecond * (this.timelineZoom / 100);

    clipElement.style.width = `${width}px`;
    clipElement.style.left = `${left}px`;
    clipElement.textContent = clip.videoClip.name;

    // Add trim handles
    const leftHandle = document.createElement('div');
    leftHandle.className = 'clip-handle left';
    clipElement.appendChild(leftHandle);

    const rightHandle = document.createElement('div');
    rightHandle.className = 'clip-handle right';
    clipElement.appendChild(rightHandle);

    // Click to select
    clipElement.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectTimelineClip(clip.id);
    });

    // Setup drag for repositioning
    this.setupClipDrag(clipElement, clip);

    // Setup trim handles
    this.setupTrimHandle(leftHandle, clip, 'left');
    this.setupTrimHandle(rightHandle, clip, 'right');

    track.appendChild(clipElement);
  }

  private selectTimelineClip(clipId: string) {
    // Deselect previous
    document.querySelectorAll('.timeline-clip').forEach((el) => el.classList.remove('selected'));

    // Select new
    const clipElement = document.querySelector(`[data-timeline-clip-id="${clipId}"]`);
    clipElement?.classList.add('selected');

    this.selectedTimelineClipId = clipId;

    // Load clip in preview
    const tClip = this.timelineClips.get(clipId);
    if (tClip) {
      this.loadVideoPreview(tClip.videoClip.path);
      this.previewVideo.currentTime = tClip.trimStart;
    }
  }

  private setupClipDrag(element: HTMLElement, clip: TimelineClip) {
    let isDragging = false;
    let startX = 0;
    let startLeft = 0;

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).classList.contains('clip-handle')) return;
      isDragging = true;
      startX = e.clientX;
      startLeft = parseFloat(element.style.left || '0');
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const newLeft = Math.max(0, startLeft + deltaX);
      element.style.left = `${newLeft}px`;

      // Update clip start time
      clip.startTime = newLeft / (this.pixelsPerSecond * (this.timelineZoom / 100));
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    element.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private setupTrimHandle(handle: HTMLElement, clip: TimelineClip, side: 'left' | 'right') {
    let isDragging = false;
    let startX = 0;
    let startValue = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startX = e.clientX;
      startValue = side === 'left' ? clip.trimStart : clip.trimEnd;
      e.stopPropagation();
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - startX;
      const deltaTime = deltaX / (this.pixelsPerSecond * (this.timelineZoom / 100));

      const clipElement = document.querySelector(`[data-timeline-clip-id="${clip.id}"]`) as HTMLElement;
      if (!clipElement) return;

      if (side === 'left') {
        const newTrimStart = Math.max(0, Math.min(clip.trimEnd - 0.1, startValue + deltaTime));
        clip.trimStart = newTrimStart;

        const newWidth = (clip.trimEnd - clip.trimStart) * this.pixelsPerSecond * (this.timelineZoom / 100);
        const newLeft = clip.startTime * this.pixelsPerSecond * (this.timelineZoom / 100) +
                        (newTrimStart * this.pixelsPerSecond * (this.timelineZoom / 100));

        clipElement.style.width = `${newWidth}px`;
        clipElement.style.left = `${newLeft}px`;
      } else {
        const newTrimEnd = Math.min(clip.videoClip.duration, Math.max(clip.trimStart + 0.1, startValue + deltaTime));
        clip.trimEnd = newTrimEnd;

        const newWidth = (clip.trimEnd - clip.trimStart) * this.pixelsPerSecond * (this.timelineZoom / 100);
        clipElement.style.width = `${newWidth}px`;
      }

      clip.duration = clip.trimEnd - clip.trimStart;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    handle.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private onTrackDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  private onTrackDrop(e: DragEvent) {
    e.preventDefault();
    const clipId = e.dataTransfer?.getData('clipId');
    if (!clipId) return;

    const trackElement = (e.currentTarget as HTMLElement).closest('.timeline-track');
    const trackId = trackElement?.id;
    const trackNumber = trackId ? parseInt(trackId.split('-')[1]) - 1 : 0;

    this.addToTimeline(clipId, trackNumber);
  }

  private zoomTimeline(factor: number) {
    this.timelineZoom = Math.max(50, Math.min(200, this.timelineZoom * factor));
    document.getElementById('timeline-zoom')!.textContent = `${Math.round(this.timelineZoom)}%`;

    // Re-render all timeline clips
    document.querySelectorAll('.timeline-clip').forEach((el) => el.remove());
    this.timelineClips.forEach((clip) => this.renderTimelineClip(clip));
  }

  private async exportVideo() {
    if (this.timelineClips.size === 0) {
      alert('No clips on timeline to export');
      return;
    }

    try {
      // Request save path from main process
      const clips = Array.from(this.timelineClips.values()).map((clip) => ({
        id: clip.id,
        clipId: clip.videoClip.path, // Send file path
        startTime: clip.startTime,
        duration: clip.duration,
        trimStart: clip.trimStart,
        trimEnd: clip.trimEnd,
        track: clip.track,
      }));

      await window.electronAPI.exportVideo({ clips });
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error}`);
    }
  }

  private updateExportButton() {
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    exportBtn.disabled = this.timelineClips.size === 0;
  }

  private formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}

// Initialize the app when DOM is ready
const app = new VideoEditorApp();
console.log('Video Editor initialized');
