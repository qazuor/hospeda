// Core schemas

// Access level schemas (public, protected, admin)
export * from './point-of-interest.access.schema.js';
// CRUD operations
export * from './point-of-interest.crud.schema.js'; // Create, Update, Delete, Restore schemas
// HTTP operations
export * from './point-of-interest.http.schema.js'; // HTTP-compatible schemas with query coercion
// Query operations
export * from './point-of-interest.query.schema.js'; // List, Search, Summary, Stats, Filters schemas
// Relations
export * from './point-of-interest.relations.schema.js'; // Schemas with related entities
export * from './point-of-interest.schema.js'; // Main entity schema
