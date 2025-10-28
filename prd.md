# ClipForge MVP PRD (macOS)

Version: 1.0 (MVP)

Status: Approved for implementation

Updated: 2025-10-28

Owner: ClipForge Desktop Team

## Summary

Deliver a packaged desktop video editor for macOS that supports importing a single H.264/AAC MP4/MOV file, previewing it, selecting in/out points, and exporting the trimmed segment to MP4. Keep the UI simple, performant, and reliable. Scope aligns to the MVP gate: import → display → trim → export.

## Decisions (Confirmed)

1. Platform: macOS (primary target)
2. Formats: Restrict to H.264/AAC in MP4/MOV for MVP
3. UI Framework: React (with Vite + Electron Forge)
4. Encoding: Bundle `ffmpeg-static`
5. Export strategy: Try fast stream copy first; fallback to re-encode if needed
6. Theme: Dark by default
7. Defaults: Sensible defaults for controls and behavior
8. Export path: Always ask via save dialog
9. Editing scope: Single clip trim/export only
10. Timeline: Dates from ClipForge.md are acceptable for cadence

## Goals

- A user can import, preview, trim, and export a clip within minutes, without crashes or complex setup.
- Ship as a packaged macOS app via Electron Forge makers (ZIP for macOS).
- Maintain responsive UI and smooth preview for common 1080p clips.

## Non-Goals (MVP)

- Multi-clip sequencing, multi-track timelines, transitions/effects, audio mixing.
- Screen/webcam recording, overlays/PiP, cloud uploads, undo/redo, project autosave.
- Cross-platform packaging (Windows/Linux) in MVP.

## Primary User

Creators and professionals who need a fast desktop workflow to quickly cut a segment from a video and export it without learning heavy tools.

## Key Use Cases

- Import an MP4/MOV from disk or by drag-and-drop.
- Preview the clip and scrub to a specific time.
- Set in/out points and review the selection.
- Export selection to MP4 with a user-chosen destination.

## Functional Requirements

### App Shell & Launch

- Electron app launches a single main window with a dark theme.
- Basic menu with File > Import…, File > Export…, and Quit.
- About dialog includes ffmpeg attribution.

### Import

- Support MP4/MOV files; limit to H.264/AAC for reliable preview.
- Two paths: drag-and-drop onto the app or File > Import… dialog (multiple selection permitted but MVP operates on a single active clip).
- On import: display file name, duration (from media metadata), resolution if available.
- Invalid/unsupported files show a clear error message.

### Media Panel (MVP-simple)

- Display imported clip(s) as a simple list or single tile with name and duration.
- Selecting a clip loads it into the preview and timeline.

### Preview Player

- HTML5 `<video>` preview; play/pause, seek/scrub controls.
- Shows current time and total duration.
- Preview playback and scrubbing respect current in/out selection boundaries (clamped when enabled).

### Timeline & Trimming

- Single-lane timeline for the selected clip.
- Draggable in/out handles or a dual-range control to set selection.
- Playhead indicator and time ruler; scrub updates preview.
- Input validation: in < out; clamp to [0, duration].
- Optional step snapping (e.g., 0.1s) for ease of selection.

### Export

- File > Export… opens a save dialog; proposed filename defaults to `{originalname}_trimmed.mp4`.
- Attempt fast trim first: `-ss {in} -to {out} -c copy`.
- If fast trim fails or yields invalid output, automatically retry with re-encode: `-c:v libx264 -c:a aac -movflags +faststart`.
- Show a visible exporting state (busy indicator and non-blocking progress text).
- On success: confirmation toast with “Reveal in Finder”. On failure: actionable error message.

### Packaging

- Use Electron Forge to create a macOS ZIP artifact suitable for local distribution.
- Bundle `ffmpeg-static` binary as an app resource; main process resolves path at runtime.

### Error Handling

- Graceful handling for: missing/invalid media, ffmpeg spawn errors, insufficient permissions to write destination.
- Never crash the app due to invalid input; surface clear user-facing messages.

## Non-Functional Requirements

- Performance: Smooth UI during scrub/playback; exporting must not block the renderer thread.
- Reliability: Export a 2–5 minute 1080p clip without crashes.
- Security: `contextIsolation: true`; minimal, typed IPC surface; no remote code execution.
- Privacy: No network calls or telemetry in MVP.
- Accessibility: Maintain contrast in dark theme; keyboard navigation for primary actions.

## UX Overview

- Layout: Left media panel (optional), center preview, bottom timeline, top app bar.
- Dark theme with minimal chrome; clear affordances for play/pause, scrub, and in/out handles.
- Always-available Export button (disabled if no valid selection).

## Data Model (MVP, in-memory)

- Clip: `{ id, filePath, fileName, durationSec, width?, height? }`
- Selection: `{ clipId, inSec, outSec }`
- Player UI: `{ currentTimeSec, isPlaying }`
- Export state: `{ status: idle|running|done|error, progressText? }`

No project persistence in MVP.

## Success Criteria & Acceptance Tests

1. Import: User imports an MP4/MOV (H.264/AAC) via drag-and-drop or dialog; clip appears with name and duration.
2. Preview: Clip plays with play/pause and scrubbing; current time is visible.
3. Trim: User sets valid in/out points; preview clamps to the selection.
4. Export: Export asks for destination, completes, and creates an MP4 playable by QuickTime.
5. Package: App runs from packaged ZIP; same flow works without dev server.
6. Stability: No crashes during a 5-minute editing session.

## Risks & Mitigations

- Fast trim accuracy (keyframe cuts): Document limitation and auto-fallback to re-encode.
- Codec variance in MOV: Restrict preview support messaging to H.264/AAC; re-encode path handles others where possible.
- ffmpeg path resolution in production: Use `process.resourcesPath` and ship binary via extraResource.

## Dependencies

- Electron Forge + Vite + React
- `ffmpeg-static` for bundled encoder
- Node 18+ (recommended), macOS 13+ (Ventura) target

## Milestones

- Day 1: Import + Preview working in dev
- Day 2: Timeline + Trim interactions
- Day 3: Export + Packaging; run through acceptance tests

