/**
 * Re-export from @repo/service-core (migrated to packages/service-core/src/services/billing/addon/).
 * This shim maintains backward compatibility for existing consumers in the API layer.
 *
 * @module services/addon-plan-change.helpers
 */
export type { PlanChangeDirection } from '@repo/service-core';

export {
    hashCustomerId,
    resolvePlanBaseLimit,
    computeDirection,
    sumIncrements
} from '@repo/service-core';
