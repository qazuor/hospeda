import type { Accommodation } from '@repo/schemas';
import type { ServiceContext } from '../../types';

/**
 * The actor's current publish eligibility, computed by querying the
 * billing layer for active or historical subscriptions.
 *
 * - `first_publish`: the owner has never had a subscription. The publish flow
 *   must create a trial subscription before transitioning the accommodation
 *   to `ACTIVE`.
 * - `has_active_sub`: the owner has at least one subscription in `trialing`
 *   or `active` status. The publish flow may proceed without creating a new
 *   subscription.
 * - `subscription_required`: the owner has had subscriptions before, but none
 *   are currently active. The publish flow must reject the request and direct
 *   the user to the plans page.
 */
export type PublishEligibility = 'first_publish' | 'has_active_sub' | 'subscription_required';

/**
 * External dependencies required by `AccommodationService.publish` to do its
 * job atomically without violating the "external API call outside the
 * transaction" rule documented in service-core CLAUDE.md.
 *
 * The API layer (`apps/api`) wires these by adapting `TrialService` and the
 * `QZPayBilling` client. The publish flow then orchestrates them:
 *
 *  1. `checkEligibility` runs before any write to determine the branch.
 *  2. `startTrial` runs OUTSIDE any transaction (it does the HTTP call to
 *     QZPay and persists the local `billing_subscriptions` row through the
 *     qzpay-drizzle adapter).
 *  3. The local DB writes (lifecycleState change, role promotion, audit log)
 *     run inside `withServiceTransaction`.
 *  4. If the post-trial transaction fails, `cancelTrial` is invoked as
 *     compensation against the external QZPay subscription. If compensation
 *     also fails, the inconsistency is logged for manual reconciliation.
 *
 * All three callbacks are optional only at the type level so that consumers
 * who never call `publish()` can keep instantiating `AccommodationService`
 * without wiring billing. At runtime, calling `publish()` without these wired
 * results in `CONFIGURATION_ERROR`.
 */
export interface AccommodationPublishDeps {
    /** Resolves the publish eligibility for a given owner. */
    checkEligibility: (ownerId: string, ctx?: ServiceContext) => Promise<PublishEligibility>;
    /**
     * Creates a new trial subscription for the owner. MUST run outside any
     * transaction. Returns the QZPay subscription identifier on success.
     *
     * `accommodationId` is the accommodation whose publish triggered the trial.
     * Trials are per-owner, so this id is purely *referential* ("triggered by")
     * — it does NOT mean the subscription belongs to a single accommodation. It
     * is threaded through for observability (logging / Sentry linkage) and as a
     * referential marker on the MercadoPago creation payload (SPEC-222).
     */
    startTrial: (input: {
        ownerId: string;
        accommodationId: string;
    }) => Promise<{ subscriptionId: string }>;
    /**
     * Cancels a previously created trial subscription. Used as compensation
     * when the post-trial transaction fails.
     */
    cancelTrial: (subscriptionId: string) => Promise<void>;
}

/**
 * Outcome of `AccommodationService.createForOnboarding`.
 *
 * - `created`: a fresh DRAFT was inserted for the actor and the onboarding flow
 *   promotes them from `USER` to `HOST` so they can access host surfaces.
 * - `resumed`: the actor already had an active DRAFT — that one is returned and the
 *   caller should resume the onboarding flow on it instead of creating a new one.
 * - `already_host`: the actor is already `HOST` (or higher). No draft is created;
 *   the caller is expected to redirect to the admin panel directly.
 */
export type HostOnboardingResult =
    | { status: 'created'; accommodation: Accommodation }
    | { status: 'resumed'; accommodation: Accommodation }
    | { status: 'already_host'; accommodation: null };

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
     * Translatable field values captured from the entity BEFORE an update
     * (SPEC-212, AC-5). Set by `_beforeUpdate`, read by `_afterUpdate` to
     * emit a translate call only for fields whose Spanish source text changed.
     *
     * Keys: `name`, `summary`, `description`, `richDescription`.
     * `undefined` value means the field was absent on the pre-update entity.
     */
    previousTranslatableFields?: Readonly<Record<string, string | undefined>>;
}
