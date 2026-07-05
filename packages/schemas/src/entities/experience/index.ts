/**
 * Experience entity schemas — all schema files for the Experiencias commerce listing.
 *
 * Mirrors the gastronomy barrel: each sub-file has a single responsibility.
 */

// Access level schemas (public, protected, admin)
export * from './experience.access.schema.js';
// Admin search
export * from './experience.admin-search.schema.js'; // Admin-specific search with extended filters
// Batch operations
export * from './experience.batch.schema.js'; // Batch request and response schemas
// CRUD operations
export * from './experience.crud.schema.js'; // Create, Update, Delete, Restore schemas
// HTTP operations
export * from './experience.http.schema.js'; // HTTP-compatible schemas with query coercion
// Relation-selector lookup options
export * from './experience.options.schema.js'; // Lightweight {id,label,slug,type,destination} options
// Query operations
export * from './experience.query.schema.js'; // List, Search, Summary, Stats, Filters schemas
// Relations
export * from './experience.relations.schema.js'; // Schemas with related entities
// Core schemas
export * from './experience.schema.js'; // Main entity schema
// Subtypes — FAQ and Review
export * from './subtypes/index.js';
