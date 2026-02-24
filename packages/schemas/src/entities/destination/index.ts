// Core schemas
export * from './destination.schema.js'; // Main entity schema

// CRUD operations
export * from './destination.crud.schema.js'; // Create, Update, Delete, Restore schemas

// Query operations
export * from './destination.query.schema.js'; // List, Search, Summary, Stats, Filters schemas

// Admin search
export * from './destination.admin-search.schema.js'; // Admin-specific search with extended filters

// HTTP operations
export * from './destination.http.schema.js'; // HTTP-compatible schemas with query coercion

// Batch operations
export * from './destination.batch.schema.js'; // Batch retrieval schemas

// Hierarchy operations
export * from './destination.hierarchy.schema.js'; // Children, Descendants, Ancestors, Breadcrumb schemas

// Access control schemas
export * from './destination.access.schema.js'; // Public, Protected, Admin schemas

// Relations
export * from './destination.relations.schema.js'; // Schemas with related entities

// Subtypes - all subschemas are now organized in subtypes folder
export * from './subtypes/index.js';
