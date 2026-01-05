# NYC Subway Status Web App

A small Express + vanilla JS app that surfaces the latest NYC subway status from the MTA service feed. The feed no longer requires an API key; if the live endpoint is unreachable, the app falls back to a bundled sample snapshot so you can still view the experience locally.

## Features
- Server endpoint (`/api/status`) that proxies the MTA service status feed (optionally sending `MTA_API_KEY`) and normalizes it to a simple JSON shape.
- Graceful fallback to a sample snapshot when the public feed is unreachable.
- Responsive UI with status badges, descriptions, and timestamps, refreshing automatically every 90 seconds.

## Getting started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the example environment file (optional—only needed if you want to change the port or feed URL):
   ```bash
   cp .env.example .env
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open the app at http://localhost:3000.

## Configuration
- `MTA_API_KEY`: Optional legacy key header. The public feed no longer requires it.
- `MTA_SERVICE_STATUS_URL`: Override the feed endpoint (defaults to `https://api.mta.info/serviceStatus`).
- `PORT`: Server port (defaults to `3000`).

## Notes
- The frontend is served from `public/` and consumes the JSON returned by `/api/status`.
- Error handling is in place to ensure the UI still renders using sample data when live data cannot be reached.
