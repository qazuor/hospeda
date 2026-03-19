/**
 * Re-export from @repo/service-core (migrated to packages/service-core/src/services/billing/addon/).
 * This shim maintains backward compatibility for existing consumers in the API layer.
 *
 * @module services/addon-expiration.queries
 */
export type {
    ExpiredAddon,
    ExpiringAddon,
    FindExpiringAddonsInput
} from '@repo/service-core';

export {
    BATCH_SIZE,
    daysAheadSchema,
    parseLimitAdjustments,
    parseEntitlementAdjustments,
    findExpiredAddons,
    findExpiringAddons
} from '@repo/service-core';
