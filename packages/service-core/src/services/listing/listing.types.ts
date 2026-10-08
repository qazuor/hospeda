/**
 * listing.types.ts
 *
 * Shared hook-state and type definitions for listing services (SPEC-239).
 * Mirrors the pattern established by accommodation.types.ts.
 */

/**
 * Per-request hook state for BaseListingService lifecycle hooks.
 *
 * Stored in `ctx.hookState` (a `Record<string, unknown>` scoped to a single
 * service invocation) so hooks can communicate without using mutable instance
 * fields (which are NOT concurrency-safe in singleton services).
 *
 * Three-way junction-sync contract:
 *  - `undefined`  → field absent in payload; no-op (leave existing rows untouched)
 *  - `[]`         → clear all junction rows for this entity
 *  - `[id, …]`   → sync to exactly that set
 */
export interface ListingHookState extends Record<string, unknown> {
    /** ID of the entity being updated, injected by `update()` for draft slug sync. */
    updateId?: string;
    /**
     * Amenity UUIDs extracted from create/update input (write-only sync).
     * Set by `_beforeCreate` / `_beforeUpdate`; consumed by the
     * junction-sync helper called from `_afterCreate` / `_afterUpdate`.
     */
    pendingAmenityIds?: readonly string[];
    /**
     * Feature UUIDs extracted from create/update input (write-only sync).
     * Same three-way contract as `pendingAmenityIds`.
     */
    pendingFeatureIds?: readonly string[];
    /**
     * Entity data captured before soft-delete for post-delete side effects.
     * Used by `_afterSoftDelete` for cache revalidation / auditing.
     */
    deletedEntity?: { ownerId?: string; slug?: string };
    /**
     * Entity data captured before restore for post-restore side effects.
     */
    restoredEntity?: { ownerId?: string; slug?: string };
    /** Auto-regenerated slug for an unpublished rename (HOS-784 stage 1). */
    regeneratedSlug?: string;
    /**
     * The fields the create/update wrote, as they reached `_before*` (HOS-1499).
     * Read by `_after*` to build the owner-act event's "what changed" list.
     */
    ownerActPayload?: Readonly<Record<string, unknown>>;
    /** The row as it stood before the update (HOS-1499), for the event's old values. */
    ownerActBefore?: Readonly<Record<string, unknown>> | null;
}
