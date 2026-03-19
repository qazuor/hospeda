/**
 * Re-export shim for backward compatibility.
 * The canonical source has moved to @repo/service-core.
 *
 * @module services/addon-limit-recalculation
 * @deprecated Import from '@repo/service-core' instead.
 */
export {
    recalculateAddonLimitsForCustomer,
    type RecalculationOutcome,
    type RecalculationResult,
    type RecalculateAddonLimitsInput
} from '@repo/service-core';
