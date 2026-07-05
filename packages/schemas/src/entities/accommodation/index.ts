// Core schemas

export * from './accommodation.location.schema.js'; // Postal address shape (SPEC-095)
export * from './accommodation.schema.js'; // Main entity schema
export * from './accommodation-import.schema.js'; // Import-from-URL schemas (SPEC-222)

// Types are exported inline from their schema files

// Access level schemas (public, protected, admin)
export * from './accommodation.access.schema.js';
// Admin search
export * from './accommodation.admin-search.schema.js'; // Admin-specific search with extended filters
// Batch operations
export * from './accommodation.batch.schema.js'; // Batch request and response schemas
// Comparison (SPEC-288)
export * from './accommodation.comparison.schema.js'; // Side-by-side comparison request/response
// CRUD operations
export * from './accommodation.crud.schema.js'; // Create, Update, Delete, Restore schemas
export * from './accommodation.featured-toggle.schema.js'; // Owner self-service featured toggle body (SPEC-309 T-019)
// HTTP operations
export * from './accommodation.http.schema.js'; // HTTP-compatible schemas with query coercion
// Relation-selector lookup options (SPEC-169 §5.5)
export * from './accommodation.options.schema.js'; // Lightweight {id,label,slug,type,destination} options
// Query operations
export * from './accommodation.query.schema.js'; // List, Search, Summary, Stats, Filters schemas
// Relations
export * from './accommodation.relations.schema.js'; // Schemas with related entities
// Subtypes - all subtypes are now exported
export * from './subtypes/index.js';
