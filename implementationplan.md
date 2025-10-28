# ClipForge MVP Implementation Plan (macOS)

Updated: 2025-10-28

Scope: Implement MVP features to import, preview, trim a single clip, and export to MP4. No coding begins until explicitly approved.

## Overview

- Stack: Electron Forge + Vite + React (renderer), TypeScript throughout, `ffmpeg-static` + `execa` in main.
- Packaging: macOS ZIP via Electron Forge.
- Theme: Dark.
- Strategy: Build in this order — Import/Preview → Timeline/Trim → Export → Package.

## Tasks by Phase

### Phase 0 — Prep (Environment & Dependencies)

- Add React: `react`, `react-dom`, `@types/react`, `@types/react-dom`.
- Optional UI libs: keep minimal; consider `rc-slider` or `react-range` for in/out handles.
- Add media/export deps: `ffmpeg-static`, `execa`.
- Update Vite renderer config to enable React plugin; wire `index.html` to `root` div and `App.tsx`.
- Create a basic dark theme CSS (CSS variables) without heavy frameworks.

### Phase 1 — Import & Preview

- Preload: Define a minimal, typed API surface (`window.api`) with:
  - `openVideoDialog(): Promise<string[]>`
  - `validateFiles(paths: string[]): Promise<string[]>` (optional; simple filter by extension in renderer is OK for MVP)
- Main: Implement `openVideoDialog` via `dialog.showOpenDialog({ filters: [mp4, mov] })`.
- Renderer (React):
  - App shell with top bar (Import, Export) and main layout.
  - Drag-and-drop area and Import button.
  - When a file is chosen: load into `<video>` and read `loadedmetadata` for duration/resolution.
  - Media panel shows filename and duration.
  - Preview player: play/pause, scrub bar, current time display.

### Phase 2 — Timeline & Trim

- Renderer:
  - Single-lane timeline bound to the selected clip.
  - In/out selection via dual-handle slider or draggable handles overlay.
  - Display playhead; scrubbing updates video currentTime.
  - Clamp playback to [in, out] when “loop selection” is active.
  - Validation: ensure `in < out`; prevent handle crossing.

### Phase 3 — Export (FFmpeg)

- Main process:
  - Resolve ffmpeg binary path:
    - Dev: from `require('ffmpeg-static')`
    - Prod: from `process.resourcesPath` + packaged resource
  - Implement `exportTrim({ inputPath, inSec, outSec, destPath, preferCopy: true }): Promise<{ ok: boolean, error?: string }>`
    - Attempt fast path: `-ss {in} -to {out} -i input -c copy -y dest`
    - On failure: retry with re-encode: `-c:v libx264 -c:a aac -movflags +faststart`
    - Optionally parse stderr timestamps to derive progress text; MVP can show a spinner.
- Preload: Expose `exportTrim` and (optionally) a progress event channel.
- Renderer:
  - Export button opens save dialog via main; disable when no valid selection.
  - Show exporting state; on success, show toast with “Reveal in Finder” via `shell.showItemInFolder`.

### Phase 4 — Packaging & Smoke Testing

- Forge config:
  - Add ffmpeg binary to `packagerConfig.extraResource` so it’s bundled in production.
  - Ensure Vite plugin renders React entry.
- Build: `npm run make` (macOS ZIP maker is already configured).
- Manual smoke tests on packaged app (acceptance checklist below).

## IPC Surface (Typed)

- `ipcMain.handle('dialog:openVideos') => string[]`
- `ipcMain.handle('export:trim', { inputPath, inSec, outSec, destPath, preferCopy }) => { ok, error? }`
- Optional events: `export:progress` (subscribe/unsubscribe).

Preload exposes a minimal `window.api`:

```ts
interface ClipForgeAPI {
  openVideoDialog(): Promise<string[]>;
  exportTrim(args: { inputPath: string; inSec: number; outSec: number; destPath: string; preferCopy?: boolean }): Promise<{ ok: boolean; error?: string }>;
}
```

Security: `contextIsolation: true`; do not expose Node primitives to renderer.

## UI Structure (Renderer)

- `renderer/App.tsx` — Layout and state host
- `components/TopBar.tsx` — Import/Export actions
- `components/MediaPanel.tsx` — Simple list/tile for selected clip
- `components/Preview.tsx` — `<video>` element + controls
- `components/Timeline.tsx` — In/out handles, playhead, scrub
- `styles/theme.css` — Dark theme variables

## FFmpeg Integration Notes

- Fast trim command: `ffmpeg -ss {in} -to {out} -i "{input}" -c copy -y "{dest}"`
- Fallback (re-encode): `ffmpeg -ss {in} -to {out} -i "{input}" -c:v libx264 -c:a aac -movflags +faststart -y "{dest}"`
- Edge cases: non-monotonic DTS or copy failure → fallback path.

## Packaging Details (macOS)

- Add `extraResource` entry for ffmpeg binary (copied from `node_modules/ffmpeg-static/ffmpeg`).
- At runtime, resolve:
  - Dev: the module-provided path.
  - Prod: `path.join(process.resourcesPath, 'ffmpeg')` (or packaged name); guard both paths.
- Provide README note and About attribution for ffmpeg.

## Acceptance Test Checklist

1. Import MP4 (H.264/AAC) via dialog → appears with name/duration.
2. Import via drag-and-drop → same result.
3. Preview plays; scrub bar updates current time.
4. Set in/out; preview honors selection clamping.
5. Export asks for location; produces playable MP4; “Reveal in Finder” works.
6. Handle invalid selection (in >= out) gracefully.
7. Packaged app (ZIP) runs and passes 1–5.

## Manual QA Matrix (Spot Checks)

- Short 30s 720p MP4
- 2–5 min 1080p MP4
- MOV container with H.264/AAC
- Start cut near file start (<2s)
- End cut near file end (last 2s)

## Timeline (Target)

- Day 1: Phase 0 + Phase 1 complete in dev
- Day 2: Phase 2 interactions complete; basic polish
- Day 3: Phase 3 + Phase 4; run acceptance tests on packaged app

## Future (Post-MVP)

- Multi-clip timeline and sequencing
- Frame-accurate export toggle in UI
- Thumbnails via ffmpeg frame grabs
- Basic audio gain and fade
- Project save/load and autosave
- Screen/webcam recording (Electron desktopCapturer + getUserMedia)

## Risks & Mitigations

- UI latency with large files → keep timeline DOM-simple; avoid canvases now.
- ffmpeg path issues in prod → log resolved path; protective try/catch; fallback messages.
- Codec surprises in MOV → surface clear error + suggest re-encode path.

## Open Items (If Needed)

- macOS minimum version target (assume 13+)
- Whether to add Tailwind (quick theming) vs. plain CSS; default: plain CSS to minimize setup
- Progress parsing for export (optional for MVP)

