/**
 * Re-export from @repo/service-core (migrated to packages/service-core/src/services/billing/addon/).
 * This shim maintains backward compatibility for existing consumers in the API layer.
 *
 * @module services/addon-status-transitions
 */
export type { AddonPurchaseStatus, ValidateAddonStatusTransitionInput } from '@repo/service-core';

export {
    ADDON_PURCHASE_STATUSES,
    validateAddonStatusTransition,
    InvalidStateTransitionError
} from '@repo/service-core';
