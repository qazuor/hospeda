/**
 * experience.types.ts
 *
 * Per-request hook state and supplementary types for ExperienceService (SPEC-240 T-018).
 *
 * Extends CommerceListingHookState so the base-class junction-sync machinery
 * keeps working without modification. Add experience-specific transient state
 * here if future hooks require it.
 */

import type { CommerceListingHookState } from '../commerce/commerce.types';

/**
 * Per-request hook state for ExperienceService lifecycle hooks.
 *
 * Currently a pure alias of {@link CommerceListingHookState} — no
 * experience-specific transient state is needed yet. The explicit alias keeps the
 * pattern consistent with other services (AccommodationHookState, GastronomyHookState)
 * and makes future extension trivial.
 *
 * Stored in `ctx.hookState` (a `Record<string, unknown>` scoped to a single
 * service invocation), NOT on instance fields, to achieve concurrency safety.
 */
export interface ExperienceHookState extends CommerceListingHookState {
    /**
     * Experience entity data captured before soft-delete for post-delete side effects.
     * Overrides the base `deletedEntity` to carry experience-specific fields.
     */
    deletedExperience?: { ownerId?: string; slug?: string; type?: string };
    /**
     * Experience entity data captured before restore for post-restore side effects.
     */
    restoredExperience?: { ownerId?: string; slug?: string };
}
