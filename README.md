# ClipForge - Desktop Video Editor

A professional desktop video editor built with Electron, TypeScript, and FFmpeg. ClipForge allows you to import videos, arrange them on a timeline, trim clips, and export to MP4.

## Features

### Core Features (Completed)
- ✅ **Video Import**: Drag & drop or file picker for MP4, MOV, AVI, MKV, WebM
- ✅ **Video Preview**: Real-time playback with play/pause controls
- ✅ **Timeline Editor**: Multi-track timeline with visual clip arrangement
- ✅ **Trim Functionality**: Adjust in/out points by dragging clip handles
- ✅ **Clip Repositioning**: Drag clips to reposition them on the timeline
- ✅ **Timeline Zoom**: Zoom in/out for precision editing
- ✅ **Multi-Clip Export**: Concatenate multiple clips with trim support
- ✅ **Export to MP4**: FFmpeg-powered export with progress tracking
- ✅ **Native Packaging**: Runs as a standalone macOS application

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- macOS (for current build; Windows/Linux support can be added)

### Install Dependencies
```bash
npm install
```

## Development

### Run in Development Mode
```bash
npm start
```

This will:
- Launch the Electron app with hot reload
- Open DevTools automatically
- Watch for file changes

### Lint Code
```bash
npm run lint
```

## Building & Distribution

### Package the Application
```bash
npm run package
```

This creates a packaged app at:
```
out/video-editor-desktop-darwin-arm64/video-editor-desktop.app
```

### Create Distributable Installers
```bash
npm run make
```

This will create platform-specific installers (DMG for macOS, etc.)

## Usage Guide

### Importing Videos
1. Click the **Import Video** button in the toolbar
2. Select one or more video files (MP4, MOV, AVI, MKV, WebM)
3. Imported videos appear in the **Media Library** on the right

### Previewing Clips
- Click on a clip in the Media Library to preview it
- Use Play/Pause buttons to control playback
- Drag the seek bar to scrub through the video

### Adding Clips to Timeline
- **Double-click** a clip in the Media Library to add it to Track 1
- **Drag & drop** a clip from Media Library onto a specific track
- Clips automatically align to the end of existing clips on the same track

### Editing on Timeline
- **Move clips**: Click and drag a clip left/right
- **Trim clips**: Drag the left or right edge handles to adjust in/out points
- **Select clips**: Click on a clip (turns golden border)
- **Zoom timeline**: Use + and - buttons to zoom in/out

### Exporting
1. Add at least one clip to the timeline
2. Click the **Export** button
3. Video exports to your Desktop with timestamp: `ClipForge-Export-YYYY-MM-DD.mp4`
4. Wait for export completion (progress shown in console)

## Architecture

### Main Components

**Main Process** (`src/main.ts`)
- Handles IPC communication
- FFmpeg integration for video processing
- File system operations

**Preload Script** (`src/preload.ts`)
- Secure bridge between main and renderer
- Exposes safe APIs via `contextBridge`

**Renderer Process** (`src/renderer.ts`)
- UI logic and state management
- Timeline rendering and interaction
- Video preview controls

### Key Technologies
- **Electron**: Desktop app framework
- **TypeScript**: Type-safe development
- **Vite**: Fast build tooling
- **FFmpeg**: Video encoding/decoding
- **fluent-ffmpeg**: Node.js FFmpeg wrapper

## Project Structure

```
src/
├── main.ts        - Main process (IPC handlers, FFmpeg)
├── preload.ts     - Preload script (context bridge)
├── renderer.ts    - Renderer process (UI logic)
└── index.css      - Application styles

index.html         - Main HTML template
forge.config.ts    - Electron Forge configuration
vite.*.config.ts   - Vite build configs
```

## Known Limitations

- Screen recording not yet implemented
- Webcam recording not yet implemented
- No undo/redo functionality
- No keyboard shortcuts
- No audio controls (volume, fade)
- No effects or transitions
- Multi-track export currently concatenates all clips in sequence (overlay support planned)

## Roadmap

### Next Priority Features
- [ ] Screen recording with desktopCapturer
- [ ] Webcam recording
- [ ] Picture-in-picture mode
- [ ] Text overlays
- [ ] Transitions (fade, slide, etc.)
- [ ] Audio controls (volume, fade in/out)
- [ ] Filters and effects
- [ ] Keyboard shortcuts
- [ ] Auto-save project state
- [ ] Undo/redo
- [ ] Export resolution options (720p, 1080p, 4K)

## Contributing

This is a 3-day sprint project for learning purposes. See `ClipForge.md` for full project requirements.

## License

MIT
