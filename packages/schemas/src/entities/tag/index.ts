// Core schemas
export * from './entity-tag.schema.js'; // Polymorphic relation schema (r_entity_tag)
export * from './tag.schema.js'; // Main entity schema (tags table — refactored per SPEC-086)

// CRUD operations
export * from './tag.crud.schema.js'; // Create, Update, Delete, Restore schemas

// Query operations
export * from './tag.query.schema.js'; // List, Search, Summary, Stats, Filters schemas

// Batch operations
export * from './tag.batch.schema.js'; // Batch retrieve schemas

// Relations
export * from './tag.relations.schema.js'; // Schemas with related entities

// Admin search schemas
export * from './tag.admin-search.schema.js';

// Access level schemas (public, protected, admin)
export * from './tag.access.schema.js';

// i18n key shape schemas (used by locale validation tooling)
export * from './tag.i18n.schema.js';

// PostTag subsystem (D-001, SPEC-086) — public SEO taxonomy for blog posts
export * from './post-tag.schema.js'; // Main entity schema (post_tags table)
export * from './post-tag.crud.schema.js'; // Create, Update, Delete, Restore schemas
export * from './post-tag.query.schema.js'; // Admin list and filter schemas
export * from './post-tag.public.schema.js'; // Public API response and query schemas
