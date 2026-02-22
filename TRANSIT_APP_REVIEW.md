# Transit App Review and Improvement Plan

## Current state (what works)
- The app serves a clean UI and can show line-level status cards from `/api/status`.
- The server normalizes upstream XML into a frontend-friendly JSON shape.
- There is a fallback snapshot (`data/sample-service-status.xml`) so local demos still render.

## Key gaps preventing a truly functioning transit app
1. **Single-feed dependency and stale fallback behavior**
   - The current product only exposes service status text.
   - If live feed access fails, riders only see static sample data (not useful for real travel decisions).

2. **No trip-level real-time information**
   - Riders need countdowns, next train arrivals, platform direction, and disruptions by station.
   - Service summaries alone do not answer “when is my train coming?”

3. **No station, route, or geography model**
   - There is no station lookup, neighborhood search, or map context.
   - The app cannot anchor incidents to rider location.

4. **No itinerary / routing features**
   - Riders cannot plan point-to-point trips.
   - There is no transfer guidance, travel time estimation, or alternate route suggestions.

5. **No reliability/SRE guardrails for production**
   - No cache policy, retry/backoff, circuit breaker, or stale-while-revalidate mode.
   - No tests around parsing, API contracts, and fallback correctness.

## High-impact improvements (priority order)

### P0 — Make data layer reliable and rider-useful
- Add a **data provider abstraction** to support multiple sources:
  - Line status provider (existing XML feed).
  - GTFS-Realtime provider for subway trip updates and alerts.
  - Static GTFS provider for station metadata and route-stop topology.
- Add **server-side cache** (e.g., in-memory TTL + optional Redis) and expose metadata:
  - `source`, `fetchedAt`, `stale`, `ageSeconds`.
- Implement resilient fetch policy:
  - Retry with exponential backoff on transient failures.
  - Return last-known-good data before sample snapshot.
  - Track provider health in `/health`.

### P1 — Build rider-critical endpoints
- Introduce APIs such as:
  - `GET /api/stations?query=...`
  - `GET /api/arrivals?stationId=...&route=...`
  - `GET /api/alerts?route=...&stationId=...`
  - `GET /api/trip-plan?from=...&to=...&time=...`
- Keep `/api/status` but enrich with:
  - affected stations,
  - planned end time,
  - direction (uptown/downtown),
  - severity score.

### P2 — Improve UX from status board to transit assistant
- Add station search with favorites and recent stations.
- Add “Nearby stations” (geolocation, with permission fallback).
- Add route detail pages with:
  - upcoming arrivals,
  - active alerts,
  - alternatives when disruptions exist.
- Add “Last updated” confidence indicators and stale warnings.

### P3 — Operational readiness
- Add automated tests:
  - unit tests for XML normalization and route parsing,
  - integration tests for `/api/status` happy-path and fallback behavior,
  - contract tests for new endpoints.
- Add observability:
  - structured logs,
  - request IDs,
  - metrics for feed latency, cache hit rate, fallback rate.
- Add deployment guardrails:
  - environment validation,
  - health and readiness probes,
  - documented runbook for feed outages.

## Suggested near-term implementation sequence (2-3 iterations)

### Iteration 1 (stability)
- Refactor server into modules (`providers/`, `services/`, `routes/`).
- Add cache + retry + last-known-good persistence.
- Add tests around parser and fallback logic.

### Iteration 2 (rider value)
- Add station metadata ingestion from GTFS static.
- Ship station search and arrivals endpoint/UI.
- Add route detail page with arrivals and active alerts.

### Iteration 3 (trip planning)
- Add minimal trip planner (origin/destination + transfer suggestions).
- Add alert-aware rerouting recommendations.
- Add favorites and notifications.

## Minimal success criteria for “functioning transit app”
- Riders can search a station and see next trains by direction.
- Riders can view active disruptions affecting a station/route.
- Riders can plan a basic trip and see at least one alternative when disruptions occur.
- Data freshness and source confidence are visible in the UI.
- System continues operating with degraded upstream feeds using cached last-known-good data.
