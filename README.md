# Nexus AI Project

This workspace has been migrated to **Grok (xAI)** for all AI functionality.

## Structure

- **Root/**: Frontend Application (React/Vite)
  - `src/`: Frontend Source Code
  - `index.html`, `vite.config.ts`: Frontend Config
- **backend/**: Backend API (Node.js/Express)

## Quick Start

### Frontend
1. Open terminal in **Root** directory.
2. `npm install`
3. `npm run dev`

### Backend
1. `cd backend`
2. `npm install`
3. `npm run dev`

## Environment Setup

### Backend env (required)

- Copy [backend/.env.example](backend/.env.example) → `backend/.env`
- Set `GROK_API_KEY` (server-side only)

### Frontend env (optional)

- For local dev, create `.env.local` at repo root (gitignored) and set:
  - `VITE_API_URL=http://localhost:5000`

## AI Smoke Tests

With backend running, you can verify each module quickly:

- Live Assistant: open **Live Assistant** and speak; you should see “You:” then “Nexus:” lines and hear TTS.
- Neural Chat: send multi-turn messages; history loads when authenticated.
- Doc Analyzer: upload/paste text and confirm summary + key points render.
- Brainstormer: enter a topic and confirm numbered ideas appear.
- Writing Studio: try rewrite / grammar / tone tools and confirm output changes.
