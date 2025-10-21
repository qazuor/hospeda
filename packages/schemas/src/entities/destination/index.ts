// Core schemas
export * from './destination.schema.js'; // Main entity schema

// CRUD operations
export * from './destination.crud.schema.js'; // Create, Update, Delete, Restore schemas

// Query operations
export * from './destination.query.schema.js'; // List, Search, Summary, Stats, Filters schemas

// HTTP operations
export * from './destination.http.schema.js'; // HTTP-compatible schemas with query coercion

// Batch operations
export * from './destination.batch.schema.js'; // Batch retrieval schemas

// Relations
export * from './destination.relations.schema.js'; // Schemas with related entities

// Subtypes - all subschemas are now organized in subtypes folder
export * from './subtypes/index.js';
