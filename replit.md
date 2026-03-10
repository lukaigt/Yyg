# VideoForge - Text-to-Video Generator

## Overview
A single-user text-to-video generator web app. Upload PNG/image assets, let AI plan animated scenes, and render real MP4 videos with motion animations (Infographics Show style).

## Tech Stack
- **Frontend/Backend**: Remix (React) + Node.js with TypeScript
- **Database**: SQLite via better-sqlite3
- **AI**: OpenRouter API for scene planning
- **Video Rendering**: Remotion (server-side MP4 rendering)
- **Image Processing**: Sharp for background removal
- **Styling**: Custom CSS (dark theme)

## Project Structure
```
app/
  routes/           # Remix routes (pages + API endpoints)
  components/       # React UI components
  lib/              # Server-side utilities (db, upload, AI, renderer)
  styles/           # Global CSS
remotion/           # Remotion video compositions & animation components
storage/
  assets/           # Uploaded image/video files
  renders/          # Rendered MP4 outputs
db/                 # SQLite database file
```

## Key Files
- `app/lib/db.server.ts` - SQLite database (assets, projects, renders tables)
- `app/lib/openrouter.server.ts` - OpenRouter AI scene planning
- `app/lib/renderer.server.ts` - Remotion video rendering pipeline
- `app/lib/autotag.server.ts` - Filename-based auto-tagging system
- `remotion/VideoComposition.tsx` - Main video composition
- `remotion/components/` - Animation components (AnimatedAsset, AnimatedText, etc.)

## Asset Serving
- Assets are served via HTTP route `/storage/*` (see `app/routes/storage.$.ts`)
- During Remotion rendering, assets resolve to `http://localhost:5000/storage/assets/filename.png`
- This avoids Chromium's `file://` URL blocking in headless rendering

## Video Duration Support
- Supports Short (3min), Medium (8min), and Long (15min) presets
- Videos 5+ minutes are planned in two AI calls (first half + second half) and merged
- Scene plans include sections for organizational structure
- Longer videos generate 40-90 scenes with varied durations (3-15s each)

## Web Research Pipeline
- Before AI planning, the system searches Brave Search for real facts about the topic
- Search results (facts, dates, names) are fed into the AI prompt for accuracy
- Research is included in both parts of two-pass generation for long videos
- Brave Search module: `app/lib/brave-search.server.ts`

## AI Model Selection
- Users can pick which OpenRouter model to use for scene planning
- Available models defined in `app/lib/openrouter.server.ts` (AVAILABLE_MODELS array)
- Default: Gemini 2.0 Flash (fast, cheap, good structured output)
- Options include Gemini, GPT-4o, Claude Sonnet, DeepSeek
- Model picker hidden by default in UI, expandable via "Change AI model" link

## Environment Variables
- `OPENROUTER_API_KEY` - Required for AI scene planning
- `BRAVE_SEARCH_API_KEY` - Required for web research (free at api.search.brave.com)
- `PORT` - Server port (default 5000 dev, 3000 production)

## Deployment
- Designed for VPS deployment via Docker
- See DEPLOY.md for VPS setup instructions
- Push to GitHub → clone on VPS → `docker compose up -d`

## Development
- Run: `npm run dev` (starts on port 5000)
- Build: `npm run build`
- Production: `npm start`

## Dependencies
- @remix-run/node, @remix-run/react, @remix-run/serve
- remotion, @remotion/bundler, @remotion/renderer
- better-sqlite3
- sharp (image processing)
- System: ffmpeg, chromium
