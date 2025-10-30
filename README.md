# ClipForge - Desktop Video Editor

A professional desktop video editor built with Electron, TypeScript, and FFmpeg. ClipForge provides a complete video editing experience with recording, timeline editing, and fast export capabilities.

## Features

### Core Video Editing ✅
- ✅ **Video Import**: Import MP4, MOV, AVI, MKV, WebM files
- ✅ **Smart Preview System**:
  - Preview media library clips before editing
  - Timeline playback respects all trim points and clip sequences
  - Automatic mode switching between media and timeline preview
- ✅ **Professional Timeline**:
  - Multi-track timeline with visual clip arrangement
  - Hard snapping - clips automatically snap to valid positions
  - No overlaps allowed on same track
  - Click clips to seek and preview
  - Drag playhead or click timeline to scrub/seek
  - Zoom in/out for precision editing
- ✅ **Editing Tools**:
  - Trim clips by dragging edge handles
  - Split clips at playhead position (S key)
  - Delete clips from timeline (Delete/Backspace)
  - Move clips by dragging (with smart snapping)
- ✅ **Keyboard Shortcuts**: Spacebar for play/pause, S to split, Delete to remove clips
- ✅ **Fast Export**:
  - FFmpeg ultrafast preset for 5-10x faster encoding
  - Handles mixed media (with/without audio)
  - Complete format normalization (1080p, 30fps, AAC audio)
  - Real-time progress tracking throughout
  - Exports to MP4 with H.264/AAC

### Recording Features ✅
- ✅ **Screen Recording**: Capture any screen or window with source selection
- ✅ **Webcam Recording**: Record from camera with audio
- ✅ **Picture-in-Picture**: Simultaneous screen + webcam recording with webcam overlay
- ✅ **Auto-Import**: Recordings automatically added to media library
- ✅ **macOS Permissions**: Proper entitlements for screen recording, camera, and microphone

### Native Packaging ✅
- ✅ **Standalone macOS App**: Runs without dependencies
- ✅ **FFmpeg Bundled**: All processing tools included
- ✅ **Code Signed**: Ready for distribution (development mode)

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
3. Imported videos appear in the **Media Library** panel

### Recording
**Screen Recording:**
1. Click **Record Screen**
2. Select a screen or window from the preview grid
3. Click **Stop Recording** when done
4. Recording auto-imports to media library

**Webcam Recording:**
1. Click **Record Webcam**
2. Grant camera/microphone permissions
3. Click **Stop Recording** when done

**Picture-in-Picture:**
1. Click **Screen + Webcam**
2. Select screen/window to record
3. Webcam appears as overlay in bottom-right corner
4. Click **Stop Recording** when done

### Previewing Media
- **Click** a clip in Media Library to preview it
- **Video player controls** or **Spacebar** to play/pause
- **Seek bar** allows scrubbing through video
- Preview shows the source clip before adding to timeline

### Building Your Edit
- **Double-click** a clip to add it to Track 1
- **Drag & drop** clips onto specific tracks
- Clips **automatically snap** to valid positions (no overlaps)
- **Click a timeline clip** to seek to that position

### Timeline Playback & Navigation
- **Spacebar** to play/pause the timeline composition
- **Drag the playhead** to scrub through your edit
- **Click anywhere on timeline** to jump to that position
- Playback respects all trim points and transitions between clips
- Timeline preview shows your actual edit, not the source clip

### Editing on Timeline
- **Move clips**: Drag clips left/right (snaps to valid positions only)
- **Trim clips**: Drag edge handles to adjust in/out points
- **Split clips**: Position playhead and press **S** to split clip at that point
- **Delete clips**: Select a clip and press **Delete** or **Backspace**
- **No overlaps**: Clips can't be placed on top of each other
- **Zoom**: Use + and - buttons for precision

### Keyboard Shortcuts
- **Spacebar** - Play/Pause toggle
- **S** - Split clip at playhead position
- **Delete / Backspace** - Remove selected clip from timeline
- **+** - Zoom in on timeline
- **-** - Zoom out on timeline

### Exporting
1. Add clips to timeline and arrange as desired
2. Click **Export** button (disabled until timeline has clips)
3. Progress bar shows real-time encoding progress
4. Video exports to Desktop: `ClipForge-Export-YYYY-MM-DD-HH-MM-SS.mp4`
5. Export is fast (~5-10x faster than real-time)
6. All clips are normalized to 1920x1080, 30fps, AAC audio for reliable concatenation

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

- Only Track 1 plays during timeline preview (multi-track compositing not yet supported)
- No undo/redo functionality
- No audio controls (volume, fade in/out, ducking)
- No effects, filters, or color correction
- No transitions between clips
- Export normalizes all clips to 1080p (no custom resolution options)
- No project save/load (session-only editing)

## Future Enhancements

### Completed Features
- [x] Keyboard shortcuts for common actions (Spacebar, S, Delete)
- [x] Split clips at playhead position
- [x] Delete clips from timeline
- [x] Playhead dragging and seeking

### Nice-to-Have Features
- [ ] Multi-track compositing (overlay Track 2 on Track 1)
- [ ] Text overlays and titles
- [ ] Transitions (fade, dissolve, wipe, etc.)
- [ ] Audio controls (volume adjustments, fade, ducking)
- [ ] Color correction and filters
- [ ] More keyboard shortcuts (arrow keys, J/K/L playback)
- [ ] Project save/load (JSON format)
- [ ] Auto-save functionality
- [ ] Undo/redo system
- [ ] Export resolution options (720p, 1080p, 4K, custom)
- [ ] Export format options (WebM, ProRes, etc.)
- [ ] Batch export multiple timelines
- [ ] Audio waveform visualization
- [ ] Clip markers and annotations
- [ ] Ripple delete (close gaps automatically)

## Contributing

This is a 3-day sprint project for learning purposes. See `ClipForge.md` for full project requirements.

## License

MIT
