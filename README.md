# NYC Subway Status Web App

A small Express + vanilla JS transit dashboard for NYC subway riders. It now includes:
- line status cards,
- station search,
- route/station disruption lookup,
- resilient fallback behavior with live/cache/sample sources.

## Features
- `GET /api/status` proxies MTA service status XML and normalizes it to JSON.
- Retry + timeout logic for upstream fetches.
- Last-known-good in-memory cache, returned when live fetches fail.
- Sample snapshot fallback if both live + cache are unavailable.
- `GET /api/stations?query=...` for station lookup.
- `GET /api/alerts?stationId=...` (or `route=...`) for active disruptions.
- `/health` reports provider health and cache availability.

## Getting started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start server:
   ```bash
   npm start
   ```
3. Open http://localhost:3000.

## Configuration
- `MTA_API_KEY`: Optional legacy key header.
- `MTA_SERVICE_STATUS_URL`: Upstream status endpoint.
- `PORT`: HTTP port (default `3000`).
- `FETCH_TIMEOUT_MS`: Upstream timeout (default `7000`).
- `FETCH_RETRIES`: Retry count (default `3`).
- `RETRY_BASE_DELAY_MS`: Base delay for exponential backoff (default `400`).
