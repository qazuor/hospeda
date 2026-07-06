/**
 * Re-export shim for backward compatibility.
 * The canonical source has moved to @repo/service-core.
 *
 * @module services/addon-limit-recalculation
 * @deprecated Import from '@repo/service-core' instead.
 */
export {
    type RecalculateAddonLimitsInput,
    type RecalculationOutcome,
    type RecalculationResult,
    recalculateAddonLimitsForCustomer
} from '@repo/service-core';
