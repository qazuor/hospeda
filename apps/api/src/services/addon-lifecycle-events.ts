/**
 * Re-export from @repo/service-core (migrated to packages/service-core/src/services/billing/addon/).
 * This shim maintains backward compatibility for existing consumers in the API layer.
 *
 * @module services/addon-lifecycle-events
 */
export type {
    AddonLifecycleEvent,
    AddonLifecycleResult,
    CancellationCompletedEvent,
    CancellationStartedEvent,
    ExpirationWarningEvent,
    ExpiredEvent,
    LimitsRecalculatedEvent,
    PurchaseConfirmedEvent,
    RenewalConfirmedEvent,
    RevocationFailedEvent
} from '@repo/service-core';

export {
    AddonLifecycleEventType,
    emitLifecycleEvent,
    getAddonLifecycleMetrics,
    resetAddonLifecycleMetrics
} from '@repo/service-core';
