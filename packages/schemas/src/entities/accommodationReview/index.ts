/**
 * AccommodationReview Entity Schemas
 *
 * This module exports all schemas related to the AccommodationReview entity,
 * including base schemas, CRUD operations, and query-specific schemas.
 */

// Base schemas
export * from './accommodationReview.schema.js';

// CRUD schemas
export * from './accommodationReview.crud.schema.js';

// Query schemas
export * from './accommodationReview.query.schema.js';

// Admin search
export * from './accommodationReview.admin-search.schema.js'; // Admin-specific search with extended filters

// HTTP operations
export * from './accommodationReview.http.schema.js';
