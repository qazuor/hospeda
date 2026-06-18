/**
 * Barrel exports for the accommodation-external-reputation service directory
 * (SPEC-237).
 *
 * Exposes the two SPEC-237 services plus the adapter registry so consumers
 * (API routes, cron jobs) import from a single path.
 *
 * @module services/accommodation-external-reputation
 */

export { AccommodationExternalListingService } from './accommodation-external-listing.service.js';
export { AccommodationExternalReputationService } from './accommodation-external-reputation.service.js';
export type {
    RefreshResult,
    RefreshFailureEntry,
    AccommodationExternalReputationServiceDeps
} from './accommodation-external-reputation.service.js';
export * from './adapters/index.js';
