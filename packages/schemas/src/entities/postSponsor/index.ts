// Core schemas
export * from './postSponsor.schema.js'; // Main entity schema

// CRUD operations
export * from './postSponsor.crud.schema.js'; // Create, Update, Delete, Restore, Search schemas

// Query schemas
export * from './postSponsor.query.schema.js'; // Search/filter schemas for public queries

// HTTP operations
export * from './postSponsor.http.schema.js'; // HTTP-compatible schemas with query coercion

// Admin search
export * from './postSponsor.admin-search.schema.js';

// Access level schemas (public, protected, admin)
export * from './postSponsor.access.schema.js';
