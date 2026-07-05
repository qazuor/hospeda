/**
 * Accommodation Subtypes - Specific schema variations
 * This folder contains specialized schemas for different accommodation contexts
 */

// Amenity schemas (re-exports from main amenity entity + association schemas)
export * from './accommodation.amenity.schema.js';
// FAQ schemas (types are exported from schemas)
export * from './accommodation.faq.schema.js';
// Feature schemas (re-exports from main feature entity + association schemas)
export * from './accommodation.feature.schema.js';
// IA schemas (types are exported from schemas)
export * from './accommodation.ia.schema.js';
// Media schemas (SPEC-204 relational gallery)
export * from './accommodation.media.schema.js';
// Price schemas (types are exported from schemas)
export * from './accommodation.price.schema.js';
// Rating schemas (types are exported from schemas)
export * from './accommodation.rating.schema.js';
