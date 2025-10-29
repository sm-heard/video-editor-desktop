# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ClipForge is a desktop video editor built with Electron, TypeScript, and Vite. This is a compressed 3-day sprint project aimed at creating a production-grade video editor similar to CapCut, supporting screen recording, webcam capture, timeline editing, and video export.

**Key Deadlines:**
- MVP: Tuesday, October 28th at 10:59 PM CT
- Final Submission: Wednesday, October 29th at 10:59 PM CT

## Development Commands

```bash
# Start the app in development mode with hot reload
npm start

# Lint TypeScript files
npm run lint

# Package the application for distribution
npm run package

# Create distributable installers for the current platform
npm run make

# Publish the application
npm run publish
```

## Architecture

### Electron Process Model

This app follows the standard Electron multi-process architecture:

**Main Process (`src/main.ts`)**
- Entry point for the Electron application
- Manages BrowserWindow lifecycle
- Handles OS-level integration (window creation, app events)
- Uses preload script at `src/preload.ts` for context bridging

**Renderer Process (`src/renderer.ts`)**
- Runs in the Chromium browser context
- Handles UI rendering and user interactions
- Entry point loaded via `index.html`
- Styled with `src/index.css`

**Preload Script (`src/preload.ts`)**
- Currently minimal; will need expansion for IPC communication
- Bridge between main process and renderer for secure native API access
- Critical for implementing screen recording, file system access, and FFmpeg integration

### Build System

**Electron Forge** is configured via `forge.config.ts`:
- **VitePlugin**: Builds main, preload, and renderer processes separately
  - Main: `src/main.ts` → `vite.main.config.ts`
  - Preload: `src/preload.ts` → `vite.preload.config.ts`
  - Renderer: `index.html` + `src/renderer.ts` → `vite.renderer.config.ts`
- **Makers**: Configured for cross-platform builds (Squirrel/Windows, ZIP/macOS, RPM/Linux, DEB/Linux)
- **Fuses**: Security hardening enabled (ASAR integrity, cookie encryption, no Node CLI access)

The app uses **Vite** for fast development builds and HMR. In dev mode, `MAIN_WINDOW_VITE_DEV_SERVER_URL` is set; in production, files are served from ASAR bundle.

### Critical Implementation Notes

**Media Processing:**
- FFmpeg integration is essential for video encoding, trimming, and exporting
- Consider `fluent-ffmpeg` for Node.js or `@ffmpeg/ffmpeg` for browser context
- Export pipeline must handle stitching clips, applying cuts, and rendering to MP4

**Recording Implementation:**
- Use Electron's `desktopCapturer` API to enumerate screens/windows
- Pass source ID to `navigator.mediaDevices.getUserMedia()` for screen recording
- Standard `getUserMedia()` for webcam access
- Alternative: `getDisplayMedia()` for screen sharing (has limitations)
- Audio capture requires microphone permissions

**Timeline Architecture:**
- Timeline is the core UI component; prioritize this after import/preview
- Options: HTML5 Canvas, Fabric.js, Konva.js, or DOM-based solution
- Must support: drag-and-drop, trimming, splitting, multi-track, zoom, snapping

**IPC Communication:**
- Expand `src/preload.ts` to expose safe APIs via `contextBridge`
- Main process will handle FFmpeg spawning, file system operations, recording APIs
- Renderer sends commands; main process executes and returns results

## Project Structure

```
src/
├── main.ts       - Main process entry point
├── preload.ts    - Preload script for IPC bridging
├── renderer.ts   - Renderer process entry point
└── index.css     - Global styles

forge.config.ts   - Electron Forge configuration
vite.*.config.ts  - Vite build configs for each process
index.html        - Application entry HTML
tsconfig.json     - TypeScript configuration
```

## Development Strategy

Per ClipForge.md, follow this build order:
1. **Import and Preview** - Validate media pipeline first
2. **Timeline** - Core interface for editing
3. **Export** - Test FFmpeg encoding early
4. **Recording** - Add after core loop works
5. **Package and Test** - Don't wait until last minute

## MVP Requirements Checklist

Must have by Tuesday 10:59 PM CT:
- [ ] Desktop app launches
- [ ] Video import (drag & drop or file picker for MP4/MOV)
- [ ] Timeline view showing imported clips
- [ ] Video preview player
- [ ] Basic trim functionality (in/out points)
- [ ] Export to MP4
- [ ] Built and packaged as native app

## Performance Targets

- Timeline responsive with 10+ clips
- Preview playback at 30+ fps
- App launch under 5 seconds
- No memory leaks during 15+ minute sessions
- Reasonable exported file sizes

## Testing

Test with:
- 30-second screen recording
- 3+ video clips in sequence
- Trimming and splitting
- 2-minute multi-clip export
- Webcam overlay on screen recording
