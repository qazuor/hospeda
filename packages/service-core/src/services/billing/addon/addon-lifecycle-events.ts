/**
 * Centralized addon lifecycle event emitter.
 *
 * Every addon lifecycle transition (purchase, cancellation, expiration, renewal,
 * limit recalculation, revocation failure) MUST be dispatched through
 * `emitLifecycleEvent` instead of each service handling logging/notifications/
 * metrics individually.
 *
 * Current implementation: in-memory metrics collection.
 * Future placeholders are present for notification dispatch and metrics emission
 * so the call sites never need to change when those gaps are implemented.
 *
 * @module services/addon-lifecycle-events
 */

// ─── In-memory lifecycle metrics ─────────────────────────────────────────────

/**
 * In-memory addon lifecycle metrics store.
 *
 * Collected per-process and exposed via `getAddonLifecycleMetrics()` for
 * the `/admin/billing/metrics/lifecycle` endpoint.  Intentionally simple:
 * no external dependency, reset on process restart.
 */
const lifecycleMetrics = {
    revocationDurationMs: [] as number[],
    revocationOutcomes: { success: 0, failed: 0 },
    recalculationDurationMs: [] as number[],
    expiryRetryCount: 0,
    cacheHitRate: { hits: 0, misses: 0 }
};

/**
 * Returns a shallow snapshot of the current addon lifecycle metrics.
 *
 * The arrays are copied so callers cannot mutate the internal state.
 *
 * @returns Read-only snapshot of `lifecycleMetrics`.
 *
 * @example
 * ```ts
 * const snap = getAddonLifecycleMetrics();
 * console.log(snap.revocationOutcomes.success);
 * ```
 */
export function getAddonLifecycleMetrics(): Readonly<typeof lifecycleMetrics> {
    return {
        ...lifecycleMetrics,
        revocationDurationMs: [...lifecycleMetrics.revocationDurationMs],
        recalculationDurationMs: [...lifecycleMetrics.recalculationDurationMs],
        revocationOutcomes: { ...lifecycleMetrics.revocationOutcomes },
        cacheHitRate: { ...lifecycleMetrics.cacheHitRate }
    };
}

/**
 * Resets all in-memory lifecycle metrics to zero.
 *
 * Intended for use in tests only — calling this in production code will
 * silently discard accumulated data.
 *
 * @example
 * ```ts
 * beforeEach(() => resetAddonLifecycleMetrics());
 * ```
 */
export function resetAddonLifecycleMetrics(): void {
    lifecycleMetrics.revocationDurationMs.length = 0;
    lifecycleMetrics.revocationOutcomes.success = 0;
    lifecycleMetrics.revocationOutcomes.failed = 0;
    lifecycleMetrics.recalculationDurationMs.length = 0;
    lifecycleMetrics.expiryRetryCount = 0;
    lifecycleMetrics.cacheHitRate.hits = 0;
    lifecycleMetrics.cacheHitRate.misses = 0;
}

// ─── Event type constants ─────────────────────────────────────────────────────

/**
 * Discriminant string values for every addon lifecycle transition.
 *
 * Using a `const` object (not an `enum`) keeps the values tree-shakeable and
 * lets callers narrow on `event.type` with a strict string literal union.
 */
export const AddonLifecycleEventType = {
    PURCHASE_CONFIRMED: 'addon.purchase.confirmed',
    CANCELLATION_STARTED: 'addon.cancellation.started',
    CANCELLATION_COMPLETED: 'addon.cancellation.completed',
    EXPIRATION_WARNING: 'addon.expiration.warning',
    EXPIRED: 'addon.expired',
    RENEWAL_CONFIRMED: 'addon.renewal.confirmed',
    LIMITS_RECALCULATED: 'addon.limits.recalculated',
    REVOCATION_FAILED: 'addon.revocation.failed'
} as const;

/** Union of every possible lifecycle event type string. */
export type AddonLifecycleEventType =
    (typeof AddonLifecycleEventType)[keyof typeof AddonLifecycleEventType];

// ─── Event payload interfaces ─────────────────────────────────────────────────

/**
 * Fields shared by every addon lifecycle event.
 */
interface BaseLifecycleEvent {
    /** The specific lifecycle transition that occurred. */
    readonly type: AddonLifecycleEventType;
    /** QZPay billing customer ID of the affected customer. */
    readonly customerId: string;
    /** When the event occurred. */
    readonly timestamp: Date;
    /** Optional free-form context for debugging. */
    readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Emitted when an addon purchase is successfully confirmed by the billing system.
 */
export interface PurchaseConfirmedEvent extends BaseLifecycleEvent {
    readonly type: typeof AddonLifecycleEventType.PURCHASE_CONFIRMED;
    /** Slug of the purchased addon product (e.g. `'visibility-boost-7d'`). */
    readonly addonSlug: string;
    /** UUID of the `billing_addon_purchases` row that was created. */
    readonly purchaseId: string;
}

/**
 * Emitted when the cancellation of an addon-bearing subscription begins
 * (before individual addon revocations are attempted).
 */
export interface CancellationStartedEvent extends BaseLifecycleEvent {
    readonly type: typeof AddonLifecycleEventType.CANCELLATION_STARTED;
    /** QZPay subscription ID being cancelled. */
    readonly subscriptionId: string;
    /** Number of active addon purchases that will be revoked. */
    readonly addonCount: number;
}

/**
 * Emitted when all addon revocations for a cancelled subscription have finished
 * (whether all succeeded, some failed, or all failed).
 */
export interface CancellationCompletedEvent extends BaseLifecycleEvent {
    readonly type: typeof AddonLifecycleEventType.CANCELLATION_COMPLETED;
    /** QZPay subscription ID that was cancelled. */
    readonly subscriptionId: string;
    /** Number of addon revocations that succeeded. */
    readonly revokedCount: number;
    /** Number of addon revocations that failed. */
    readonly failedCount: number;
}

/**
 * Emitted when an addon is approaching its expiration date and a warning
 * should be surfaced to the customer.
 */
export interface ExpirationWarningEvent extends BaseLifecycleEvent {
    readonly type: typeof AddonLifecycleEventType.EXPIRATION_WARNING;
    /** Slug of the addon that is expiring soon. */
    readonly addonSlug: string;
    /** UUID of the `billing_addon_purchases` row. */
    readonly purchaseId: string;
    /** How many days remain until expiration (>= 1). */
    readonly daysRemaining: number;
}

/**
 * Emitted when an addon purchase has expired (its `expires_at` is in the past
 * and its status has been updated to `expired`).
 */
export interface ExpiredEvent extends BaseLifecycleEvent {
    readonly type: typeof AddonLifecycleEventType.EXPIRED;
    /** Slug of the expired addon product. */
    readonly addonSlug: string;
    /** UUID of the `billing_addon_purchases` row that expired. */
    readonly purchaseId: string;
}

/**
 * Emitted when a recurring addon is successfully renewed by the billing system.
 */
export interface RenewalConfirmedEvent extends BaseLifecycleEvent {
    readonly type: typeof AddonLifecycleEventType.RENEWAL_CONFIRMED;
    /** Slug of the renewed addon product. */
    readonly addonSlug: string;
    /** UUID of the new `billing_addon_purchases` row created for this renewal cycle. */
    readonly purchaseId: string;
}

/**
 * Emitted after `recalculateAddonLimitsForCustomer` completes, regardless of
 * whether any limits actually changed.
 */
export interface LimitsRecalculatedEvent extends BaseLifecycleEvent {
    readonly type: typeof AddonLifecycleEventType.LIMITS_RECALCULATED;
    /** Trigger context (e.g. `'plan-change'`, `'cancellation'`, `'expiry-job'`). */
    readonly trigger: string;
    /** Number of limit keys that were evaluated. */
    readonly evaluatedCount: number;
    /** Number of limit keys whose value actually changed. */
    readonly changedCount: number;
}

/**
 * Emitted when a QZPay revocation call fails fatally and the system cannot
 * automatically recover.  The caller is expected to surface this as an error.
 */
export interface RevocationFailedEvent extends BaseLifecycleEvent {
    readonly type: typeof AddonLifecycleEventType.REVOCATION_FAILED;
    /** Slug of the addon whose revocation failed. */
    readonly addonSlug: string;
    /** UUID of the `billing_addon_purchases` row that could not be revoked. */
    readonly purchaseId: string;
    /** Human-readable description of the failure. */
    readonly errorMessage: string;
}

// ─── Discriminated union ──────────────────────────────────────────────────────

/**
 * Discriminated union of all addon lifecycle events.
 * Narrow on `event.type` to access event-specific fields.
 */
export type AddonLifecycleEvent =
    | PurchaseConfirmedEvent
    | CancellationStartedEvent
    | CancellationCompletedEvent
    | ExpirationWarningEvent
    | ExpiredEvent
    | RenewalConfirmedEvent
    | LimitsRecalculatedEvent
    | RevocationFailedEvent;

// ─── Unified result type ──────────────────────────────────────────────────────

/**
 * Unified result type for all addon lifecycle service operations (GAP-043-033).
 *
 * All lifecycle services (checkout, cancellation, expiration, limit recalculation)
 * should return this type for consistent error handling and observability.
 *
 * The generic parameter `T` is the shape of the success data payload.
 * Defaults to `void` for operations that only indicate success/failure.
 *
 * @example
 * ```ts
 * async function cancelAddon(): Promise<AddonLifecycleResult> {
 *   return { success: true };
 * }
 *
 * async function purchaseAddon(): Promise<AddonLifecycleResult<{ purchaseId: string }>> {
 *   return { success: true, data: { purchaseId: 'purch_abc' } };
 * }
 * ```
 *
 * @remarks
 * Existing services use `ServiceResult<T>` from `addon.types.ts` (a compatible but
 * narrower type). Migrate them to `AddonLifecycleResult<T>` incrementally — do not
 * refactor all services at once.
 */
export interface AddonLifecycleResult<T = void> {
    readonly success: boolean;
    readonly data?: T;
    readonly error?: {
        readonly code: string;
        readonly message: string;
        readonly cause?: unknown;
    };
    readonly metadata?: Record<string, unknown>;
}

// ─── Emitter ─────────────────────────────────────────────────────────────────

/**
 * Centralized addon lifecycle event emitter.
 *
 * Dispatches every lifecycle transition to:
 * 1. **In-memory metrics** collection for observability.
 * 2. *(Future)* Notification dispatch .. placeholder is present; add implementation
 *    when GAP-043-notifications is worked.
 * 3. *(Future)* Structured logging .. callers in the API layer can add logging
 *    before/after calling this function.
 *
 * Callers MUST NOT handle logging or side-effects themselves. Centralizing
 * all dispatch here ensures consistency and makes it trivial to add new
 * channels (e.g. Sentry breadcrumbs, event bus) without touching every service.
 *
 * @param event - A fully-typed addon lifecycle event.
 * @returns Resolves when all dispatch steps have completed.
 *
 * @example
 * ```ts
 * await emitLifecycleEvent({
 *   type: AddonLifecycleEventType.EXPIRED,
 *   customerId: 'cus_abc123',
 *   addonSlug: 'extra-photos-20',
 *   purchaseId: 'purch_uuid-0001',
 *   timestamp: new Date(),
 * });
 * ```
 */
export async function emitLifecycleEvent(event: AddonLifecycleEvent): Promise<void> {
    const { type, metadata } = event;

    // ── 1. Notification dispatch (future) ────────────────────────────────────
    // TODO(GAP-043-notifications): dispatch to NotificationService based on event.type
    // Example:
    //   if (type === AddonLifecycleEventType.EXPIRATION_WARNING) {
    //     await notificationService.send({ type: NotificationType.ADDON_EXPIRATION_WARNING, ... });
    //   }

    // ── 2. Metrics emission ──────────────────────────────────────────────────
    switch (type) {
        case AddonLifecycleEventType.CANCELLATION_COMPLETED: {
            const durationMs =
                typeof metadata?.durationMs === 'number' ? metadata.durationMs : null;
            if (durationMs !== null) {
                lifecycleMetrics.revocationDurationMs.push(durationMs);
            }
            lifecycleMetrics.revocationOutcomes.success += 1;
            break;
        }
        case AddonLifecycleEventType.REVOCATION_FAILED: {
            lifecycleMetrics.revocationOutcomes.failed += 1;
            break;
        }
        case AddonLifecycleEventType.LIMITS_RECALCULATED: {
            const durationMs =
                typeof metadata?.durationMs === 'number' ? metadata.durationMs : null;
            if (durationMs !== null) {
                lifecycleMetrics.recalculationDurationMs.push(durationMs);
            }
            break;
        }
        case AddonLifecycleEventType.EXPIRED: {
            lifecycleMetrics.expiryRetryCount += 1;
            break;
        }
        default:
            break;
    }
}
