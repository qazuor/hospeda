// Core schemas

// Access level schemas (public, protected, admin)
export * from './destination.access.schema.js';
// Admin search
export * from './destination.admin-search.schema.js'; // Admin-specific search with extended filters
// Batch operations
export * from './destination.batch.schema.js'; // Batch retrieval schemas
// CRUD operations
export * from './destination.crud.schema.js'; // Create, Update, Delete, Restore schemas
// Hierarchy operations
export * from './destination.hierarchy.schema.js'; // Children, Descendants, Ancestors, Breadcrumb schemas

// HTTP operations
export * from './destination.http.schema.js'; // HTTP-compatible schemas with query coercion
// Query operations
export * from './destination.query.schema.js'; // List, Search, Summary, Stats, Filters schemas
export * from './destination.refs.schema.js'; // Lightweight relation projections (SPEC-095)

// Relations
export * from './destination.relations.schema.js'; // Schemas with related entities
export * from './destination.schema.js'; // Main entity schema
// Subtypes - all subschemas are now organized in subtypes folder
export * from './subtypes/index.js';
