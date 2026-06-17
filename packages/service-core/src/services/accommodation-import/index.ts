/**
 * Accommodation Import module barrel (SPEC-222)
 *
 * Re-exports the adapter contract types and the source detector so consumers
 * can import everything from `@repo/service-core` without reaching into
 * internal paths.
 */
export * from './adapter.types.js';
export * from './detect-source.js';
export * from './extractors/jsonld.js';
export * from './extractors/meta.js';
export * from './mapping.js';
export * from './resolvers/amenities.js';
export * from './resolvers/destination.js';
export * from './adapters/apify-client.js';
export * from './adapters/generic.adapter.js';
export * from './adapters/booking.adapter.js';
export * from './adapters/airbnb.adapter.js';
export * from './adapters/mercadolibre.adapter.js';
export * from './adapters/google-places.adapter.js';
export * from './accommodation-import.service.js';
