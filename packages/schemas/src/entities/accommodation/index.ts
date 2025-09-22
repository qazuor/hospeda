// Core schemas
export * from './accommodation.schema.js'; // Main entity schema
// Types are exported inline from their schema files

// CRUD operations
export * from './accommodation.crud.schema.js'; // Create, Update, Delete, Restore schemas

// Query operations
export * from './accommodation.query.schema.js'; // List, Search, Summary, Stats, Filters schemas

// Relations
export * from './accommodation.relations.schema.js'; // Schemas with related entities

// Batch operations
export * from './accommodation.batch.schema.js'; // Batch request and response schemas

// Subtypes - all subtypes are now exported
export * from './subtypes/index.js';
