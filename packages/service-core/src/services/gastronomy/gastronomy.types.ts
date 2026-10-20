/**
 * gastronomy.types.ts
 *
 * Per-request hook state and supplementary types for GastronomyService (SPEC-239 T-038).
 *
 * Extends ListingHookState so the base-class junction-sync machinery
 * keeps working without modification. Add gastronomy-specific transient state
 * here if future hooks require it.
 */

import type { ListingHookState } from '../listing/listing.types';

/**
 * Per-request hook state for GastronomyService lifecycle hooks.
 *
 * Currently a pure alias of {@link ListingHookState} — no
 * gastronomy-specific transient state is needed yet. The explicit alias keeps the
 * pattern consistent with other services (AccommodationHookState, EventHookState)
 * and makes future extension trivial.
 *
 * Stored in `ctx.hookState` (a `Record<string, unknown>` scoped to a single
 * service invocation), NOT on instance fields, to achieve concurrency safety.
 */
export interface GastronomyHookState extends ListingHookState {
    /**
     * Gastronomy entity data captured before soft-delete for post-delete side effects.
     * Overrides the base `deletedEntity` to carry gastronomy-specific fields.
     */
    deletedGastronomy?: { ownerId?: string; slug?: string; type?: string };
    /**
     * Gastronomy entity data captured before restore for post-restore side effects.
     */
    restoredGastronomy?: { ownerId?: string; slug?: string };
}
