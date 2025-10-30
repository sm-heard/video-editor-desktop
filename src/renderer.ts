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

  // Recording state
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingStartTime: number = 0;
  private recordingInterval: number | null = null;
  private currentRecordingStream: MediaStream | null = null;

  // Picture-in-picture recording state
  private pipCanvas: HTMLCanvasElement | null = null;
  private pipContext: CanvasRenderingContext2D | null = null;
  private pipAnimationFrame: number | null = null;
  private screenVideoElement: HTMLVideoElement | null = null;
  private webcamVideoElement: HTMLVideoElement | null = null;

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

    // Recording buttons
    document.getElementById('record-screen-btn')?.addEventListener('click', () => this.startScreenRecording());
    document.getElementById('record-webcam-btn')?.addEventListener('click', () => this.startWebcamRecording());
    document.getElementById('record-pip-btn')?.addEventListener('click', () => this.startPictureInPictureRecording());
    document.getElementById('stop-recording-btn')?.addEventListener('click', () => this.stopRecording());
    document.getElementById('cancel-recording')?.addEventListener('click', () => this.closeRecordingModal());

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

  // Recording Methods
  async startScreenRecording() {
    try {
      // Get available screen sources
      const sources = await window.electronAPI.getScreenSources();

      // Show modal with sources
      const modal = document.getElementById('recording-modal') as HTMLElement;
      const sourceGrid = document.getElementById('screen-sources') as HTMLElement;

      // Clear previous sources
      sourceGrid.innerHTML = '';

      // Render source selection
      sources.forEach((source) => {
        const sourceItem = document.createElement('div');
        sourceItem.className = 'source-item';
        sourceItem.innerHTML = `
          <img src="${source.thumbnail}" alt="${source.name}">
          <p>${source.name}</p>
        `;
        sourceItem.addEventListener('click', () => {
          this.startRecordingWithSource(source.id);
          modal.classList.remove('active');
        });
        sourceGrid.appendChild(sourceItem);
      });

      modal.classList.add('active');
    } catch (error) {
      console.error('Error starting screen recording:', error);
      alert(`Failed to start screen recording: ${error}`);
    }
  }

  async startWebcamRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      this.startRecordingStream(stream);
    } catch (error) {
      console.error('Error starting webcam recording:', error);
      alert(`Failed to start webcam recording: ${error}`);
    }
  }

  async startPictureInPictureRecording() {
    try {
      // Get available screen sources
      const sources = await window.electronAPI.getScreenSources();

      // Show modal with sources
      const modal = document.getElementById('recording-modal') as HTMLElement;
      const sourceGrid = document.getElementById('screen-sources') as HTMLElement;

      // Clear previous sources
      sourceGrid.innerHTML = '';

      // Render source selection
      sources.forEach((source) => {
        const sourceItem = document.createElement('div');
        sourceItem.className = 'source-item';
        sourceItem.innerHTML = `
          <img src="${source.thumbnail}" alt="${source.name}">
          <p>${source.name}</p>
        `;
        sourceItem.addEventListener('click', () => {
          this.startPipRecordingWithSource(source.id);
          modal.classList.remove('active');
        });
        sourceGrid.appendChild(sourceItem);
      });

      modal.classList.add('active');
    } catch (error) {
      console.error('Error starting picture-in-picture recording:', error);
      alert(`Failed to start picture-in-picture recording: ${error}`);
    }
  }

  private async startPipRecordingWithSource(sourceId: string) {
    try {
      // Get screen stream
      const screenStream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          },
        },
      });

      // Get webcam stream
      const webcamStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: true,
      });

      // Create canvas for compositing
      this.pipCanvas = document.createElement('canvas');
      this.pipContext = this.pipCanvas.getContext('2d');

      // Set canvas size to match screen stream
      const screenTrack = screenStream.getVideoTracks()[0];
      const settings = screenTrack.getSettings();
      this.pipCanvas.width = settings.width || 1920;
      this.pipCanvas.height = settings.height || 1080;

      // Create video elements for both streams
      this.screenVideoElement = document.createElement('video');
      this.screenVideoElement.srcObject = screenStream;
      this.screenVideoElement.play();

      this.webcamVideoElement = document.createElement('video');
      this.webcamVideoElement.srcObject = webcamStream;
      this.webcamVideoElement.play();

      // Wait for both videos to be ready
      await Promise.all([
        new Promise((resolve) => {
          this.screenVideoElement!.onloadedmetadata = resolve;
        }),
        new Promise((resolve) => {
          this.webcamVideoElement!.onloadedmetadata = resolve;
        }),
      ]);

      // Start compositing frames
      this.compositeFrames();

      // Get canvas stream and add audio from webcam
      const canvasStream = this.pipCanvas.captureStream(30); // 30 fps
      const audioTrack = webcamStream.getAudioTracks()[0];
      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
      }

      // Store streams for cleanup
      this.currentRecordingStream = new MediaStream([
        ...screenStream.getTracks(),
        ...webcamStream.getTracks(),
      ]);

      // Start recording the composite stream
      this.startRecordingStream(canvasStream);
    } catch (error) {
      console.error('Error starting PiP recording with source:', error);
      alert(`Failed to start picture-in-picture recording: ${error}`);
    }
  }

  private compositeFrames() {
    if (!this.pipContext || !this.pipCanvas || !this.screenVideoElement || !this.webcamVideoElement) {
      return;
    }

    const ctx = this.pipContext;
    const canvas = this.pipCanvas;
    const screenVideo = this.screenVideoElement;
    const webcamVideo = this.webcamVideoElement;

    // Draw screen content (full canvas)
    ctx.drawImage(screenVideo, 0, 0, canvas.width, canvas.height);

    // Calculate webcam overlay position (bottom-right corner)
    const webcamWidth = 320;
    const webcamHeight = 240;
    const margin = 20;
    const x = canvas.width - webcamWidth - margin;
    const y = canvas.height - webcamHeight - margin;

    // Draw border/shadow for webcam
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 2, y - 2, webcamWidth + 4, webcamHeight + 4);

    // Draw webcam feed on top
    ctx.shadowBlur = 0;
    ctx.drawImage(webcamVideo, x, y, webcamWidth, webcamHeight);

    // Continue compositing
    this.pipAnimationFrame = requestAnimationFrame(() => this.compositeFrames());
  }

  private async startRecordingWithSource(sourceId: string) {
    try {
      const stream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          },
        },
      });

      this.startRecordingStream(stream);
    } catch (error) {
      console.error('Error starting recording with source:', error);
      alert(`Failed to start recording: ${error}`);
    }
  }

  private startRecordingStream(stream: MediaStream) {
    this.currentRecordingStream = stream;
    this.recordedChunks = [];

    // Create MediaRecorder
    const options = { mimeType: 'video/webm; codecs=vp9' };
    this.mediaRecorder = new MediaRecorder(stream, options);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.saveRecording();
    };

    // Start recording
    this.mediaRecorder.start();
    this.recordingStartTime = Date.now();

    // Show recording controls
    const recordingControls = document.getElementById('recording-controls') as HTMLElement;
    recordingControls.style.display = 'flex';

    // Update recording time display
    this.recordingInterval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
      const timeDisplay = document.getElementById('recording-time') as HTMLElement;
      timeDisplay.textContent = this.formatTime(elapsed);
    }, 1000);
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();

      // Stop compositing animation if running
      if (this.pipAnimationFrame) {
        cancelAnimationFrame(this.pipAnimationFrame);
        this.pipAnimationFrame = null;
      }

      // Clean up video elements
      if (this.screenVideoElement) {
        this.screenVideoElement.srcObject = null;
        this.screenVideoElement = null;
      }

      if (this.webcamVideoElement) {
        this.webcamVideoElement.srcObject = null;
        this.webcamVideoElement = null;
      }

      // Clean up canvas
      this.pipCanvas = null;
      this.pipContext = null;

      // Stop all tracks
      if (this.currentRecordingStream) {
        this.currentRecordingStream.getTracks().forEach((track) => track.stop());
        this.currentRecordingStream = null;
      }

      // Clear interval
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }

      // Hide recording controls
      const recordingControls = document.getElementById('recording-controls') as HTMLElement;
      recordingControls.style.display = 'none';
    }
  }

  private async saveRecording() {
    try {
      // Create blob from recorded chunks
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });

      // Convert blob to Uint8Array
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Save via IPC (path is generated in main process)
      const savedPath = await window.electronAPI.saveRecording(uint8Array);

      // Import the recording into the media library
      const metadata = await window.electronAPI.getVideoMetadata(savedPath);
      this.addMediaClip(metadata);

      alert(`Recording saved to ${savedPath} and added to media library!`);
    } catch (error) {
      console.error('Error saving recording:', error);
      alert(`Failed to save recording: ${error}`);
    }
  }

  closeRecordingModal() {
    const modal = document.getElementById('recording-modal') as HTMLElement;
    modal.classList.remove('active');
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
