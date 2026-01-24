/**
 * EventLocation Schemas
 *
 * This module exports all schemas related to event locations:
 * - Base schema (eventLocation.schema.ts)
 * - CRUD operations
 * - Query operations
 * - HTTP operations
 * - Batch operations
 * - Access schemas (public, protected, admin)
 */

// Base schema
export * from './eventLocation.schema.js';

// CRUD schemas
export * from './eventLocation.crud.schema.js';

// HTTP operations
export * from './eventLocation.http.schema.js';

// Query schemas
export * from './eventLocation.query.schema.js';

// Batch operations
export * from './eventLocation.batch.schema.js';

// Access schemas
export * from './eventLocation.access.schema.js';
