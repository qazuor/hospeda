/**
 * commerce.types.ts
 *
 * Shared hook-state and type definitions for commerce listing services (SPEC-239).
 * Mirrors the pattern established by accommodation.types.ts.
 */

/**
 * Per-request hook state for BaseCommerceListingService lifecycle hooks.
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
export interface CommerceListingHookState extends Record<string, unknown> {
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
}
