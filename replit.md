# VideoForge - Text-to-Video Generator

## Overview
A single-user text-to-video generator web app. Upload PNG/image assets, let AI plan animated scenes, and render real MP4 videos with motion animations (Infographics Show / Kurzgesagt style).

## Tech Stack
- **Frontend/Backend**: Remix (React) + Node.js with TypeScript
- **Database**: SQLite via better-sqlite3
- **AI**: OpenRouter API for scene planning
- **Video Rendering**: Remotion (server-side MP4 rendering)
- **TTS**: Microsoft Edge TTS (free, no API key)
- **Image Processing**: Sharp for background removal
- **Styling**: Custom CSS (dark theme)

## Project Structure
```
app/
  routes/           # Remix routes (pages + API endpoints)
  components/       # React UI components
  lib/              # Server-side utilities (db, upload, AI, renderer, TTS)
  styles/           # Global CSS
remotion/           # Remotion video compositions & animation components
  components/       # SubtitleOverlay, ProgressBar, AnimatedAsset, etc.
storage/
  assets/           # Uploaded image/video files
  renders/          # Rendered MP4 outputs
  music/            # Uploaded background music MP3 files
  voiceover/        # Generated TTS audio per render
db/                 # SQLite database file
```

## Key Files
- `app/lib/db.server.ts` - SQLite database (assets, projects, renders tables)
- `app/lib/openrouter.server.ts` - OpenRouter AI scene planning
- `app/lib/renderer.server.ts` - Remotion video rendering pipeline (dynamically imported, never at module level)
- `app/lib/tts.server.ts` - TTS voice generation with prosody (rate/pitch) support
- `app/lib/voices.ts` - Lightweight voice/pitch constants (no heavy deps, safe to import anywhere)
- `app/lib/autotag.server.ts` - Filename-based auto-tagging system
- `remotion/VideoComposition.tsx` - Main video composition (music, captions, progress bar)
- `remotion/Scene.tsx` - Individual scene renderer with subtitle overlay
- `remotion/components/SubtitleOverlay.tsx` - Animated captions (word-by-word reveal)
- `remotion/components/ProgressBar.tsx` - Video progress bar (fills left-to-right)

## Voiceover (TTS)
- Uses Microsoft Edge TTS via `msedge-tts` package — completely free, no API key needed
- 6 available voices (3 male, 3 female) defined in `app/lib/tts.server.ts`
- Default voice: Andrew (en-US-AndrewMultilingualNeural)
- Prosody options: voice speed (0.8x-1.2x) and pitch (low/normal/high)
- Text preprocessing adds natural pauses at sentence boundaries
- AI narration prompt writes conversational YouTube-style scripts
- MP3 files generated per scene, stored in `storage/voiceover/{renderId}/`
- Audio embedded into final MP4 via Remotion's `<Audio>` component

## Background Music
- Users upload MP3 files on the project page
- Stored in `storage/music/`, path saved in project's `music_path` column
- Volume slider (0-100%, default 15%) controls mix level under narration
- Layered as full-duration Audio track in VideoComposition
- Served via `/storage/*` HTTP route during rendering

## Captions & Visual Options
- **Subtitles**: Animated word-by-word reveal of narration text at bottom of each scene
- Toggle on/off, size options: small (28px), medium (36px), large (48px)
- **Progress Bar**: 4px accent-colored bar at bottom, fills across full video duration
- Toggle on/off
- All visual options passed as RenderOptions through the rendering pipeline

## Asset Serving
- Assets are served via HTTP route `/storage/*` (see `app/routes/storage.$.ts`)
- During Remotion rendering, assets resolve to `http://localhost:{PORT}/storage/...`
- This avoids Chromium's `file://` URL blocking in headless rendering

## Video Duration Support
- Supports Short (3min), Medium (8min), and Long (15min) presets
- Videos 5+ minutes are planned in two AI calls (first half + second half) and merged
- Scene plans include sections for organizational structure
- Longer videos generate 40-90 scenes with varied durations (3-15s each)

## Web Research Pipeline
- Before AI planning, the system searches Brave Search for real facts about the topic
- Search results (facts, dates, names) are fed into the AI prompt for accuracy
- Brave Search module: `app/lib/brave-search.server.ts`

## AI Model Selection
- Users can pick which OpenRouter model to use for scene planning
- Default: Gemini 2.0 Flash (fast, cheap, good structured output)
- Options include Gemini, GPT-4o, Claude Sonnet, DeepSeek

## Database Schema
- `projects` table: id, name, prompt, scene_plan, status, music_path, music_volume, voice_rate, voice_pitch, show_captions, caption_size, show_progress_bar
- `assets` table: id, filename, original_name, file_path, file_type, mime_type, file_size, tags, has_transparency
- `renders` table: id, project_id, file_path, duration_seconds, resolution, status, progress, error_message

## Environment Variables
- `OPENROUTER_API_KEY` - Required for AI scene planning
- `BRAVE_SEARCH_API_KEY` - Required for web research (free at api.search.brave.com)
- `PORT` - Server port (default 5000 dev, 5050 production/Docker)

## Deployment
- Designed for VPS deployment via Docker (port 5050 by default)
- See DEPLOY.md for VPS setup instructions
- Push to GitHub → clone on VPS → `docker compose up -d`
- Ports 3000, 4000, 5001 avoided (user's VPS has those in use)

## Development
- Run: `npm run dev` (starts on port 5000)
- Build: `npm run build`
- Production: `npm start`

## Dependencies
- @remix-run/node, @remix-run/react, @remix-run/serve
- remotion, @remotion/bundler, @remotion/renderer
- better-sqlite3, msedge-tts
- sharp (image processing)
- System: ffmpeg, chromium
