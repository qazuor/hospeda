/**
 * Gastronomy entity schemas — all schema files for the Gastronomía commerce listing.
 *
 * Mirrors the accommodation barrel: each sub-file has a single responsibility.
 */

// Access level schemas (public, protected, admin)
export * from './gastronomy.access.schema.js';
// Admin search
export * from './gastronomy.admin-search.schema.js'; // Admin-specific search with extended filters
// Batch operations
export * from './gastronomy.batch.schema.js'; // Batch request and response schemas
// CRUD operations
export * from './gastronomy.crud.schema.js'; // Create, Update, Delete, Restore schemas
// HTTP operations
export * from './gastronomy.http.schema.js'; // HTTP-compatible schemas with query coercion
// Relation-selector lookup options
export * from './gastronomy.options.schema.js'; // Lightweight {id,label,slug,type,destination} options
// Query operations
export * from './gastronomy.query.schema.js'; // List, Search, Summary, Stats, Filters schemas
// Relations
export * from './gastronomy.relations.schema.js'; // Schemas with related entities
// Core schemas
export * from './gastronomy.schema.js'; // Main entity schema
// Subtypes — FAQ and Review
export * from './subtypes/index.js';
