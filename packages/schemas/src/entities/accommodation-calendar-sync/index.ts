/**
 * AccommodationCalendarSync schemas (HOS-157 Phase 2 — Google Calendar sync
 * DB foundation).
 *
 * Core stored entity (full row, internal use only) and the safe public/
 * protected-facing status projection. HTTP request/response schemas for the
 * connect/sync/sync-status/disconnect routes are out of scope here — later
 * layers (OAuth, sync service, routes) consume these directly.
 */

// Core schema (full stored entity — internal use only)
export * from './accommodation-calendar-sync.schema.js';
// Safe public/protected status projection (never includes token columns)
export * from './accommodation-calendar-sync-status.schema.js';
