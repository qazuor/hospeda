import type { Accommodation } from '@repo/schemas';
import type { ServiceContext } from '../../types';

/**
 * The actor's current publish eligibility, computed by querying the
 * billing layer for active or historical subscriptions.
 *
 * - `first_publish`: the owner has never had a subscription. Publishing is
 *   rejected and the owner is sent to the plans page, where they enter a card
 *   and their free trial begins (HOS-171). This used to silently grant a
 *   no-card trial mid-publish instead; card-first has no way to give away
 *   access without the payer authorizing a card at MercadoPago first.
 * - `has_active_sub`: the owner has at least one subscription in `trialing`
 *   or `active` status. The publish flow may proceed.
 * - `subscription_required`: the owner has had subscriptions before, but none
 *   are currently active. Publishing is rejected, same as `first_publish`.
 *
 * The two rejecting states are kept distinct even though `publish` treats them
 * identically: they are a truthful read of the billing state, and the front-end
 * has grounds to word them differently ("start your free trial" vs "renew").
 */
export type PublishEligibility = 'first_publish' | 'has_active_sub' | 'subscription_required';

/**
 * External dependency required by `AccommodationService.publish`.
 *
 * The API layer (`apps/api`) wires this by querying the billing layer. Publish
 * calls it before any write, and either proceeds (`has_active_sub`) or rejects
 * to the plans page.
 *
 * This used to carry `startTrial` / `cancelTrial` too: publish granted a
 * no-card trial mid-flow, so it needed an external call outside the
 * transaction and a compensating cancel if the local write then failed. Under
 * card-first (HOS-171) publish creates nothing at MercadoPago — the owner goes
 * to checkout and authorizes a card there — so the external call, the
 * compensation and the whole reconciliation hazard are gone.
 *
 * The callback is optional only at the type level so that consumers who never
 * call `publish()` can keep instantiating `AccommodationService` without wiring
 * billing. At runtime, calling `publish()` without it results in
 * `CONFIGURATION_ERROR`.
 */
export interface AccommodationPublishDeps {
    /** Resolves the publish eligibility for a given owner. */
    checkEligibility: (ownerId: string, ctx?: ServiceContext) => Promise<PublishEligibility>;
}

/**
 * Outcome of `AccommodationService.createForOnboarding`.
 *
 * - `created`: a fresh DRAFT was inserted for the actor and the onboarding flow
 *   promotes them from `USER` to `HOST` so they can access host surfaces. When the
 *   actor is already `HOST` (or higher) the role promotion is a no-op but a new
 *   DRAFT is still created so they don't lose their input.
 * - `resumed`: the actor already had an active DRAFT — that one is returned and the
 *   caller should resume the onboarding flow on it instead of creating a new one.
 */
export type HostOnboardingResult =
    | { status: 'created'; accommodation: Accommodation }
    | { status: 'resumed'; accommodation: Accommodation };

/**
 * Per-request hook state for AccommodationService lifecycle hooks.
 * Replaces mutable instance fields with request-scoped context.
 */
export interface AccommodationHookState extends Record<string, unknown> {
    /**
     * ID of the entity being updated. Set by the public `update()` override so
     * that `_beforeUpdate` can fetch the pre-update entity (SPEC-212 AC-5).
     */
    updateId?: string;
    /** Entity data captured before soft-delete for post-delete side effects (revalidation). */
    deletedEntity?: { destinationId?: string; slug: string; type?: string };
    /** Entity data captured before restore for post-restore side effects (revalidation). */
    restoredAccommodation?: { slug: string; destinationId?: string; type?: string };
    /** ID of the entity being hard-deleted, used for Cloudinary media cleanup. */
    deletedEntityId?: string;
    /**
     * The `lifecycleState` value captured from the entity before an update.
     * Used in `_afterUpdate` to detect transitions (e.g., DRAFT → ACTIVE)
     * and trigger side effects such as HOST role auto-assignment.
     */
    previousLifecycleState?: string;
    /**
     * Amenity UUIDs extracted from create/update input (SPEC-172 write-only sync).
     * Stored here by `_beforeCreate`/`_beforeUpdate` so `_afterCreate`/`_afterUpdate`
     * can perform the transactional junction sync without re-reading the original input.
     * `undefined` → field was absent in the input (no-op contract).
     * `[]` → clear all relations.
     * `[…]` → sync to exact set.
     */
    pendingAmenityIds?: readonly string[];
    /**
     * Feature UUIDs extracted from create/update input (SPEC-172 write-only sync).
     * Same three-way contract as `pendingAmenityIds`.
     */
    pendingFeatureIds?: readonly string[];
    /**
     * AI-assisted field type values extracted from the update input
     * (SPEC-198.1). Stored here by `_beforeUpdate` so `_afterUpdate` can
     * persist them into the accommodation's `extraInfo` JSONB column for
     * audit / analytics.
     * `undefined` → field was absent in the input (no-op).
     * `[…]` → list of AiTextImproveFieldType values.
     */
    pendingAiAssistedFields?: readonly string[];
    /**
     * Media value extracted from CREATE input (SPEC-204, T-007).
     * Stored here by `_beforeCreate` so `_afterCreate` can mirror it into the
     * `accommodation_media` relational table inside the same transaction.
     *
     * SPEC-204 DIRECT CUTOVER: this field is NO LONGER captured for UPDATE.
     * The `accommodation_media` table is the sole source of truth for photos;
     * gallery management on the update path goes through dedicated media
     * endpoints, not the bulk update path.
     *
     * Three-way contract (create path only):
     * - `undefined` → field was absent in the input (no-op; leave existing rows untouched).
     * - `null`      → media was explicitly cleared; delete all rows.
     * - defined     → full replace (delete-all then re-insert).
     */
    pendingMedia?: import('@repo/schemas').Media | null;
    /**
     * Translatable field values captured from the entity BEFORE an update
     * (SPEC-212, AC-5). Set by `_beforeUpdate`, read by `_afterUpdate` to
     * emit a translate call only for fields whose Spanish source text changed.
     *
     * Keys: `name`, `summary`, `description`, `richDescription`.
     * `undefined` value means the field was absent on the pre-update entity.
     */
    previousTranslatableFields?: Readonly<Record<string, string | undefined>>;
}
