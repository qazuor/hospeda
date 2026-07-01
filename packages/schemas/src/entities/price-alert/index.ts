/**
 * PriceAlert schemas (SPEC-286 G-1 — price-drop alert subscriptions).
 *
 * Core stored entity, CRUD inputs (create/delete), and list/response schemas
 * for tourist price-alert subscriptions. Access-tier (Public/Protected/Admin)
 * schemas are intentionally out of scope for T-002 — see the routes task
 * (SPEC-286 T-005) for the tier that consumes these.
 */

// Core schema (stored entity)
export * from './price-alert.schema.js';

// CRUD inputs (create/delete)
export * from './price-alert.crud.schema.js';

// Query + response schemas (list input, denormalized response)
export * from './price-alert.query.schema.js';
