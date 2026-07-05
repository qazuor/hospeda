// Core schemas

// Access level schemas (public, protected, admin)
export * from './destinationReview.access.schema.js';
// Admin search
export * from './destinationReview.admin-search.schema.js'; // Admin-specific search with extended filters
// CRUD operations
export * from './destinationReview.crud.schema.js'; // Create, Update, Delete, Restore schemas

// HTTP operations
export * from './destinationReview.http.schema.js'; // HTTP-compatible schemas with coercion

// Query operations
export * from './destinationReview.query.schema.js'; // List, Search, Summary, Stats, Filters schemas
export * from './destinationReview.schema.js'; // Main entity schema
