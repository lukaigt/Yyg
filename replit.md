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

## Video Duration Support
- Supports 1, 2, 5, 10, and 15 minute videos
- Videos 5+ minutes are planned in two AI calls (first half + second half) and merged
- Scene plans include sections for organizational structure
- Longer videos generate 40-90 scenes with varied durations (3-15s each)

## Environment Variables
- `OPENROUTER_API_KEY` - Required for AI scene planning
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
