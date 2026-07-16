/**
 * AccommodationCalendarSync schemas (HOS-157 Phase 2 — Google Calendar sync
 * DB foundation; widened by HOS-162 Phase 3 — iCal feed sync).
 *
 * Core stored entity (full row, internal use only), the safe public/
 * protected-facing status projection, and the HTTP request/response schemas
 * for the `connect-ical`/`sync`/`status`/`disconnect` routes (the
 * `connect-google` request body schemas remain inline in that pre-existing
 * route file, out of scope here).
 */

// API request/response schemas for the calendar-sync routes (HOS-162 Phase 3)
export * from './accommodation-calendar-sync.http.schema.js';
// Core schema (full stored entity — internal use only)
export * from './accommodation-calendar-sync.schema.js';
// Safe public/protected status projection (never includes token columns)
export * from './accommodation-calendar-sync-status.schema.js';
