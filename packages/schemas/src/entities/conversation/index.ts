/**
 * @module entities/conversation
 *
 * Public API for the conversation feature schemas (SPEC-085).
 *
 * Re-exports all named symbols from the eight schema files in this directory.
 */

// Base entity schemas
export * from './conversation.schema.js';
export * from './message.schema.js';

// CRUD operation schemas
export * from './conversation.crud.schema.js';

// Query / pagination schemas
export * from './conversation.query.schema.js';

// Admin search schemas
export * from './conversation.admin-search.schema.js';

// HTTP request / response schemas and error reason discriminator
export * from './conversation.http.schema.js';

// Relation-enriched schemas
export * from './conversation.relations.schema.js';

// Access / token schemas
export * from './conversation.access.schema.js';
