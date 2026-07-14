// Core schemas

// Access level schemas (public, protected, admin)
export * from './point-of-interest.access.schema.js';
// Admin list search (HOS-143 T-001)
export * from './point-of-interest.admin-search.schema.js';
// Batch retrieval by IDs (HOS-143 T-002)
export * from './point-of-interest.batch.schema.js';
// Category assignment (HOS-143 T-004)
export * from './point-of-interest.category-assignment.schema.js';
// CRUD operations
export * from './point-of-interest.crud.schema.js'; // Create, Update, Delete, Restore schemas
// Destination relation admin schemas (HOS-143 T-003)
export * from './point-of-interest.destination-relation.schema.js';
// HTTP operations
export * from './point-of-interest.http.schema.js'; // HTTP-compatible schemas with query coercion
// Nearby POI search (HOS-145)
export * from './point-of-interest.nearby.schema.js';
// Query operations
export * from './point-of-interest.query.schema.js'; // List, Search, Summary, Stats, Filters schemas
// Relations
export * from './point-of-interest.relations.schema.js'; // Schemas with related entities
export * from './point-of-interest.schema.js'; // Main entity schema
