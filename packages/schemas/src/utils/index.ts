// Re-export all utility functions and constants

// Business verticals and the «real client» rule (HOS-2551, HOS-2562)
export * from './business-verticals.js';
// Phase 2.5 Optimized factories (reduces boilerplate)
export * from './http-field.factory.js';
export * from './http-schema.factory.js';
// Phase 1 OpenAPI utilities
export * from './openapi.utils.js';
export * from './openapi-metadata.factory.js';
// Permission catalog grouping (SPEC-170)
export * from './permission-grouping.js';
export * from './type-export.factory.js';
export * from './utils.js';
