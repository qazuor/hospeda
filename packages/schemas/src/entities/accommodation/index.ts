// Core schemas
export * from './accommodation.schema.js'; // Main entity schema
export * from './accommodation.location.schema.js'; // Postal address shape (SPEC-095)
// Types are exported inline from their schema files

// CRUD operations
export * from './accommodation.crud.schema.js'; // Create, Update, Delete, Restore schemas

// Query operations
export * from './accommodation.query.schema.js'; // List, Search, Summary, Stats, Filters schemas

// Admin search
export * from './accommodation.admin-search.schema.js'; // Admin-specific search with extended filters

// Relation-selector lookup options (SPEC-169 §5.5)
export * from './accommodation.options.schema.js'; // Lightweight {id,label,slug,type,destination} options

// HTTP operations
export * from './accommodation.http.schema.js'; // HTTP-compatible schemas with query coercion

// Relations
export * from './accommodation.relations.schema.js'; // Schemas with related entities

// Batch operations
export * from './accommodation.batch.schema.js'; // Batch request and response schemas

// Subtypes - all subtypes are now exported
export * from './subtypes/index.js';

// Access level schemas (public, protected, admin)
export * from './accommodation.access.schema.js';
