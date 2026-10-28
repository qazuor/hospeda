/**
 * venue entity schemas — all schema files for the Gastronomía listing.
 *
 * Mirrors the accommodation barrel: each sub-file has a single responsibility.
 */

// Subtypes — FAQ and Review
export * from './subtypes/index.js';
// Access level schemas (public, protected, admin)
export * from './venue.access.schema.js';
// Admin search
export * from './venue.admin-search.schema.js'; // Admin-specific search with extended filters
// Batch operations
export * from './venue.batch.schema.js'; // Batch request and response schemas
// CRUD operations
export * from './venue.crud.schema.js'; // Create, Update, Delete, Restore schemas
// HTTP operations
export * from './venue.http.schema.js'; // HTTP-compatible schemas with query coercion
// Relation-selector lookup options
export * from './venue.options.schema.js'; // Lightweight {id,label,slug,type,destination} options
// Query operations
export * from './venue.query.schema.js'; // List, Search, Summary, Stats, Filters schemas
// Relations
export * from './venue.relations.schema.js'; // Schemas with related entities
// Core schemas
export * from './venue.schema.js'; // Main entity schema
