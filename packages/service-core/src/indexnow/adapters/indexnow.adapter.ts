/**
 * @fileoverview
 * Adapter interface for search-engine change notification (HOS-585 G-1).
 *
 * Sibling of `revalidation/adapters/revalidation.adapter.ts`, and deliberately
 * NOT the same adapter: both are triggered by the same content write, but they
 * have different destinations, different failure modes and different reasons to
 * be switched off. Sharing one transport would mean a saturated IndexNow could
 * delay a cache purge, or that disabling notifications would disable purging.
 *
 * Implementations MUST never throw — errors are captured in the result object,
 * because every caller is a fire-and-forget hook running alongside a content
 * write that must not fail because a notification did.
 */

/** An entity whose public page changed. */
export interface NotifiableEntity {
    /** Entity type, as understood by the web app's public-URL map. */
    readonly entityType: string;
    /** The entity's URL slug. */
    readonly slug: string;
}

/** Outcome of one notification attempt. */
export interface IndexNowNotifyResult {
    /** Whether the notification was accepted downstream. */
    readonly success: boolean;
    /** How many URLs the downstream reported submitting. */
    readonly submitted: number;
    /** Failure reason. Absent on success. */
    readonly error?: string;
    /** Wall-clock duration of the attempt. */
    readonly durationMs: number;
}

/**
 * Adapter for notifying search engines that content changed.
 *
 * Implementations must be safe to call concurrently and must never throw.
 */
export interface IndexNowAdapter {
    /** Human-readable adapter name, for logging and diagnostics. */
    readonly name: string;

    /**
     * Notify that the given entities' public pages changed.
     *
     * @param params.entities - The changed entities. An empty array is a no-op.
     * @returns Result with a success flag, duration, and optional error message.
     */
    notify(params: {
        readonly entities: ReadonlyArray<NotifiableEntity>;
    }): Promise<IndexNowNotifyResult>;
}
