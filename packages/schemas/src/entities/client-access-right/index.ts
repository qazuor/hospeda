// Core schemas
export * from './client-access-right.schema.js'; // Main entity schema
// Types are exported inline from their schema files

// CRUD operations
export * from './client-access-right.crud.schema.js'; // Create, Update, Delete, Restore schemas

// Query operations
export * from './client-access-right.query.schema.js'; // List, Search, Summary, Stats, Filters schemas

// HTTP operations
export * from './client-access-right.http.schema.js'; // HTTP-compatible schemas with query coercion

// Relations
export * from './client-access-right.relations.schema.js'; // Schemas with related entities

// Batch operations
export * from './client-access-right.batch.schema.js'; // Batch request and response schemas
