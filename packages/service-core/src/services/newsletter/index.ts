/**
 * Newsletter service barrel (SPEC-101).
 *
 * Aggregates every newsletter service so the rest of the monorepo (the API
 * routes, the BullMQ worker, the admin handlers) can import from a single
 * stable entry point.
 */

export * from './newsletter-token.helpers.js';
export * from './newsletter-subscriber.service.js';
export * from './newsletter-subscriber.permissions.js';
export * from './newsletter-campaign.service.js';
export * from './newsletter-campaign.permissions.js';
export * from './newsletter-delivery.service.js';
export * from './newsletter-tracking.service.js';
