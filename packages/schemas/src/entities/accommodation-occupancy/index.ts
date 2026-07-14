/**
 * AccommodationOccupancy schemas (HOS-43 Phase 1 — occupancy calendar).
 *
 * Core stored entity, CRUD inputs (single-day create + batch toggle), and
 * range query schemas. Access-tier (Public/Protected/Admin) HTTP schemas are
 * out of scope here — the API routes task consumes these directly.
 */

// CRUD inputs (single-day create, batch toggle)
export * from './accommodation-occupancy.crud.schema.js';
// Query schemas (range query for GET endpoints)
export * from './accommodation-occupancy.query.schema.js';
// Core schema (stored entity)
export * from './accommodation-occupancy.schema.js';
// Shared YYYY-MM-DD date validator (shape + calendar-validity round-trip)
export * from './accommodation-occupancy-date.schema.js';
