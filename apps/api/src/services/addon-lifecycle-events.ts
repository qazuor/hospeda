/**
 * Re-export from @repo/service-core (migrated to packages/service-core/src/services/billing/addon/).
 * This shim maintains backward compatibility for existing consumers in the API layer.
 *
 * @module services/addon-lifecycle-events
 */
export type {
    PurchaseConfirmedEvent,
    CancellationStartedEvent,
    CancellationCompletedEvent,
    ExpirationWarningEvent,
    ExpiredEvent,
    RenewalConfirmedEvent,
    LimitsRecalculatedEvent,
    RevocationFailedEvent,
    AddonLifecycleEvent,
    AddonLifecycleResult
} from '@repo/service-core';

export {
    getAddonLifecycleMetrics,
    resetAddonLifecycleMetrics,
    AddonLifecycleEventType,
    emitLifecycleEvent
} from '@repo/service-core';
