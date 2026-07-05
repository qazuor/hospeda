// Core schemas

// Access level schemas (public, protected, admin)
export * from './postSponsor.access.schema.js';
// Admin search
export * from './postSponsor.admin-search.schema.js';
// CRUD operations
export * from './postSponsor.crud.schema.js'; // Create, Update, Delete, Restore, Search schemas

// HTTP operations
export * from './postSponsor.http.schema.js'; // HTTP-compatible schemas with query coercion
// Query schemas
export * from './postSponsor.query.schema.js'; // Search/filter schemas for public queries
export * from './postSponsor.schema.js'; // Main entity schema
