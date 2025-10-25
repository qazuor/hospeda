// Core schemas
export * from './client.schema.js'; // Main entity schema
// Types are exported inline from their schema files

// CRUD operations
export * from './client.crud.schema.js'; // Create, Update, Delete, Restore schemas

// Query operations
export * from './client.query.schema.js'; // List, Search, Summary, Stats, Filters schemas

// HTTP operations
export * from './client.http.schema.js'; // HTTP-compatible schemas with query coercion

// Relations
export * from './client.relations.schema.js'; // Schemas with related entities

// Batch operations
export * from './client.batch.schema.js'; // Batch request and response schemas
