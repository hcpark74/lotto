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

**Backend** (`backend/src/index.ts`): A single-file Cloudflare Worker using the Hono framework. It binds to a Cloudflare D1 database (`DB`) and exposes four API routes:
- `POST /api/sync` — Fetches draw results from `dhlottery.co.kr` JSON API and upserts into D1, processing up to 10 draws per call. Uses `getLatestDrawNo()` to estimate current draw number from the first draw date (2002-12-07).
- `GET /api/results` — Returns recent draws (default 10, max 50 via `?limit=`). Supports `?drwNo=` for single draw lookup.
- `GET /api/stats/hot` — Returns the 10 most frequently drawn numbers across all history.
- `POST /api/generate` — Returns 6 numbers using algorithm v2.0: 40% all-time frequency + 60% recent-30-draws frequency, cold numbers (absent from last 15 draws) get 50% weight penalty, filters for odd/even balance (2–4 odd numbers) and no 3+ consecutive numbers (up to 30 attempts).

A cron trigger (`30 21 * * 6`, Saturday 21:30 KST) is configured in `wrangler.toml` for weekly auto-sync; the `scheduled` handler is fully implemented (syncs all missing draws).

**Frontend** (`frontend/src/App.tsx`): A single-component React app. `API_URL` reads from `VITE_API_URL` env var, falling back to `http://localhost:8787`. Features: AI number generator, ball color guide, latest draw result display, draw history with pagination (5 per page, up to 50 draws), and draw number search.

**Database** (`backend/schema.sql`): Single table `lotto_history` with columns matching the official lottery API response (`drwNo`, `drwNoDate`, `drwtNo1`–`drwtNo6`, `bnusNo`, `firstWinamnt`).

**Production**: Worker deployed at `https://lotto-analysis-backend.kbaysin.workers.dev`. Frontend `VITE_API_URL` is set in `frontend/.env.production`.

## Key Notes

- Backend runs on port 8787 locally; frontend `VITE_API_URL` must match.
- D1 database ID in `wrangler.toml` (`d879aa99-d304-4001-b3d9-67ab6605de57`) is the production database. Use `--local` flag for local development.
- Additional backend scripts: `npm run seed` (generate seed.sql via script), `npm run seed:apply` (apply seed.sql to remote D1).
- Additional frontend script: `npm run deploy` (build + deploy via `scripts/deploy.mjs`).
- The project targets Cloudflare's free tier — avoid adding paid Cloudflare services.
