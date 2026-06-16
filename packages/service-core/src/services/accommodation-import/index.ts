/**
 * Accommodation Import module barrel (SPEC-222)
 *
 * Re-exports the adapter contract types and the source detector so consumers
 * can import everything from `@repo/service-core` without reaching into
 * internal paths.
 */
export * from './adapter.types.js';
export * from './detect-source.js';
