/**
 * EntityView schemas (SPEC-159 — cross-entity view tracking).
 *
 * Append-only telemetry for accommodation/post/event detail-page views:
 * unique visitors + total visits over 7-day and 30-day rolling windows.
 */

// Core schema (stored entity + trackable-type subset)
export * from './entityView.schema.js';

// CRUD inputs (capture)
export * from './entityView.crud.schema.js';

// Query schemas (window enum, stats query params)
export * from './entityView.query.schema.js';

// HTTP wire schemas (path params, request bodies, response items)
export * from './entityView.http.schema.js';
