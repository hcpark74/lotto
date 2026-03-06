# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered Korean lotto number analyzer deployed on Cloudflare's free tier. Monorepo with two npm workspaces: `backend` (Cloudflare Worker) and `frontend` (React SPA).

## Commands

### Backend (`cd backend`)
```bash
npm run dev          # Start local worker dev server on port 8787
npm run deploy       # Deploy to Cloudflare Workers
npm run init-db      # Initialize local D1 database from schema.sql
```

### Frontend (`cd frontend`)
```bash
npm run dev          # Start Vite dev server
npm run build        # Type-check + build for production
npm run preview      # Preview production build locally
```

## Architecture

**Backend** (`backend/src/index.ts`): A single-file Cloudflare Worker using the Hono framework. It binds to a Cloudflare D1 database (`DB`) and exposes three API routes:
- `POST /api/sync` — Scrapes the Korean lottery site (`dhlottery.co.kr`) for latest draw results and upserts into D1, processing up to 10 draws per call.
- `GET /api/stats/hot` — Returns the 10 most frequently drawn numbers across all history.
- `POST /api/generate` — Returns 6 numbers using frequency-weighted random selection (hot numbers appear twice in the pool).

A cron trigger (`30 21 * * 6`, Saturday 21:30 KST) is configured in `wrangler.toml` for weekly auto-sync; the `scheduled` handler in `index.ts` is currently a stub.

**Frontend** (`frontend/src/App.tsx`): A single-component React app that calls the backend API. `API_URL` is hardcoded to `http://localhost:8787` — update this for production deployment.

**Database** (`backend/schema.sql`): Single table `lotto_history` with columns matching the official lottery API response (`drwNo`, `drwNoDate`, `drwtNo1`–`drwtNo6`, `bnusNo`, `firstWinamnt`).

**Tailwind custom colors**: `lotto-primary` (#6d28d9), `lotto-secondary` (#7c3aed), `lotto-accent` (#c084fc).

## Key Notes

- Backend runs on port 8787 locally; frontend `API_URL` must match.
- D1 database ID in `wrangler.toml` (`d879aa99-d304-4001-b3d9-67ab6605de57`) is the production database. Use `--local` flag for local development.
- The project targets Cloudflare's free tier — avoid adding paid Cloudflare services.
