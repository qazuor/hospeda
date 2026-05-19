/**
 * @module entities/newsletter
 *
 * Public API for the newsletter feature schemas (SPEC-101).
 *
 * Re-exports all named symbols from the schema files in this directory.
 */

// Base entity schemas
export * from './newsletter-subscriber.schema.js';
export * from './newsletter-campaign.schema.js';
export * from './newsletter-delivery.schema.js';

// CRUD operation schemas
export * from './newsletter-subscriber.crud.schema.js';
export * from './newsletter-campaign.crud.schema.js';

// Query / pagination schemas
export * from './newsletter-subscriber.query.schema.js';

// Admin search schemas
export * from './newsletter-subscriber.admin-search.schema.js';
export * from './newsletter-campaign.admin-search.schema.js';

// HTTP request / response schemas
export * from './newsletter-subscriber.http.schema.js';
export * from './newsletter-campaign.http.schema.js';
export * from './newsletter-delivery.http.schema.js';
