// Core schemas

// Access level schemas (public, protected, admin)
export * from './poi-category.access.schema.js';
// CRUD operations
export * from './poi-category.crud.schema.js'; // Create, Update, Delete, Restore schemas
// HTTP operations
export * from './poi-category.http.schema.js'; // HTTP-compatible schemas with query coercion
// Query operations
export * from './poi-category.query.schema.js'; // List, Search, Summary, Stats, Filters schemas
// Relations
export * from './poi-category.relations.schema.js'; // Assign/unassign/set-primary schemas (HOS-139)
export * from './poi-category.schema.js'; // Main entity schema
