/**
 * Re-export from @repo/service-core (migrated to packages/service-core/src/services/billing/subscription/).
 * This shim maintains backward compatibility for existing consumers in the API layer.
 *
 * @module services/subscription-status-constants
 */
export type { SubscriptionStatus } from '@repo/service-core';

export { SUBSCRIPTION_STATUSES } from '@repo/service-core';
