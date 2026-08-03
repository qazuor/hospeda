/**
 * @fileoverview
 * Adapter interface for CDN cache invalidation backends.
 *
 * Implementations receive connection config in the constructor and expose an
 * invalidate-by-tag API. Adapters MUST never throw — errors are captured in the
 * result object, because every caller is a fire-and-forget hook running
 * alongside a content write that must not fail because a purge did.
 *
 * HOS-369 W1-1 turned this interface from paths to tags. The old shape was
 * already fiction for the production adapter: it accepted paths and then purged
 * the entire zone, discarding them. Now the argument is what is actually sent.
 */

/**
 * Result of invalidating one target.
 *
 * "Target" rather than "path" or "tag" because the two invalidation modes name
 * different things: a tag purge targets a tag, a whole-zone flush targets
 * everything. The `revalidation_log.target` column is named to match.
 */
export interface RevalidateTargetResult {
    /** What was invalidated — a cache tag, or `*` for a whole-zone flush. */
    readonly target: string;
    /** Whether the invalidation request succeeded */
    readonly success: boolean;
    /** Error message if success is false */
    readonly error?: string;
    /** Time taken for the operation in milliseconds */
    readonly durationMs: number;
}

/** The target recorded for a whole-zone flush. */
export const WHOLE_ZONE_TARGET = '*';

/**
 * Adapter interface for CDN cache invalidation.
 *
 * Implementations must be safe to call concurrently and must never throw.
 */
export interface RevalidationAdapter {
    /** Human-readable adapter name for logging and diagnostics */
    readonly name: string;

    /**
     * Invalidate every response carrying a single cache tag.
     * Must never throw — errors are captured in the result.
     *
     * @param params.tag - The cache tag to purge (e.g. `accom-hotel-paradise`)
     * @returns Result with success flag, duration, and optional error message
     */
    revalidate(params: { readonly tag: string }): Promise<RevalidateTargetResult>;

    /**
     * Invalidate every response carrying any of the given cache tags.
     *
     * Implementations are free to satisfy this with a single upstream request —
     * Cloudflare's purge API takes up to 100 tags at once — and to report the
     * same outcome for each input tag. Callers must not assume one network
     * round-trip per tag.
     *
     * @param params.tags - Cache tags to purge
     * @returns One result per input tag, in input order
     */
    revalidateMany(params: {
        readonly tags: ReadonlyArray<string>;
    }): Promise<ReadonlyArray<RevalidateTargetResult>>;

    /**
     * Flush the entire zone.
     *
     * The deliberate escape hatch (spec §7.3), kept for deploys — when every
     * asset hash changes at once, enumerating tags is both pointless and
     * slower. It is a separate method rather than a flag on the others so that
     * "purge everything" can never be reached by accident from a content
     * write: reading a call site tells you which one it is.
     *
     * @param params.reason - Human-readable justification, recorded in the log
     * @returns Result targeting {@link WHOLE_ZONE_TARGET}
     */
    purgeEverything(params: { readonly reason?: string }): Promise<RevalidateTargetResult>;
}
