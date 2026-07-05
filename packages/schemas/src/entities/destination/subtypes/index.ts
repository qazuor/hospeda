/**
 * Destination Subtypes - Specific schema variations
 * This folder contains specialized schemas for different destination contexts
 */

// Climate schemas (SPEC-215: seasonal climate)
export * from './destination.climate.schema.js';

// FAQ schemas (types are exported from schemas)
export * from './destination.faq.schema.js';
// Rating schemas (types are exported from schemas)
export * from './destination.rating.schema.js';

// Weather schemas (SPEC-215: live current conditions + daily forecast cache)
export * from './destination.weather.schema.js';
