import type { Accommodation } from '@repo/schemas';
import type { ServiceContext } from '../../types';

/**
 * The actor's current publish eligibility, computed by querying the
 * billing layer for active or historical subscriptions.
 *
 * - `has_active_sub`: the owner already holds a live accommodation-domain
 *   subscription on an `owner`/`complex`-category plan. The publish flow may
 *   proceed without touching billing.
 * - `first_publish`: the owner holds no such subscription BUT is still eligible
 *   for an accommodation free trial (HOS-1012 D-2: eligibility is keyed on
 *   `(customerId, productDomain)`, so spending the gastronomy trial leaves the
 *   accommodation one intact). Publishing is ALLOWED and starts a
 *   Hospeda-owned, no-card trial in the same transaction as the lifecycle flip
 *   — see {@link AccommodationPublishDeps.startLocalTrial}.
 * - `subscription_required`: no live owner subscription and no trial left in
 *   this vertical (or no billing customer row at all, or billing is disabled).
 *   Publishing is rejected and the owner is sent to the plans page.
 *
 * ## History — the meaning of `first_publish` has flipped twice
 *
 * It originally granted a no-card trial mid-publish. HOS-171 (card-first) kept
 * the name but inverted the behaviour: a trial WAS a MercadoPago preapproval,
 * so no free days could exist before a card was authorized, and `first_publish`
 * rejected to the plans page exactly like `subscription_required`. HOS-1012
 * takes the trial back off MercadoPago — it is now a local row with
 * `mp_subscription_id = NULL` — so publishing can grant it again, and this
 * value once more means "publish, and start the clock".
 *
 * The two remaining states are distinguishable to the front-end on purpose: one
 * offers a trial, the other asks for a renewal.
 */
export type PublishEligibility = 'first_publish' | 'has_active_sub' | 'subscription_required';

/**
 * A {@link ServiceContext} whose transaction client is guaranteed present.
 *
 * `ServiceContext.tx` is optional because most call sites may or may not run
 * inside a transaction. {@link AccommodationPublishDeps.startLocalTrial} is not
 * one of them: it is only ever invoked from inside `publish()`'s
 * `withServiceTransaction` block, and enlisting its INSERT in that transaction
 * is the entire point (HOS-1012 G-2). Requiring `tx` in the type makes a call
 * site that hoists the invocation out of the transaction a COMPILE error rather
 * than a silent loss of atomicity.
 */
export type PublishTransactionContext = ServiceContext & {
    readonly tx: NonNullable<ServiceContext['tx']>;
};

/**
 * What {@link AccommodationPublishDeps.startLocalTrial} returns when it created
 * a trial subscription.
 */
export interface StartLocalTrialResult {
    /** The id of the freshly-inserted `status='trialing'` subscription row. */
    readonly subscriptionId: string;
    /**
     * The billing customer the trial belongs to. Returned so the caller can
     * clear that customer's entitlement cache AFTER the publish transaction
     * commits (INV-1) — the creator deliberately does not, because clearing
     * before the commit would publish entitlements for a row that may still be
     * rolled back.
     */
    readonly customerId: string;
    /** When the trial expires and the listing is unpublished (HOS-1012 D-3). */
    readonly trialEnd: Date;
}

/**
 * External dependency required by `AccommodationService.publish`.
 *
 * The API layer (`apps/api`) wires this by querying the billing layer. Publish
 * calls `checkEligibility` before any write and either proceeds
 * (`has_active_sub`), starts a local trial and proceeds (`first_publish`), or
 * rejects to the plans page (`subscription_required`).
 *
 * ## This is NOT the pre-HOS-171 `startTrial` / `cancelTrial` pair
 *
 * The deps used to carry `startTrial` + `cancelTrial`, and they were a SAGA:
 * `startTrial` created a MercadoPago preapproval (an external HTTP call, hence
 * an 8s timeout, hence outside the transaction), and if the local write then
 * failed `cancelTrial` compensated — logging "CRITICAL: manual reconciliation
 * required" when the compensation ALSO failed.
 *
 * None of that comes back. HOS-1012's trial is a local `billing_subscriptions`
 * row with `mp_subscription_id = NULL` and no provider object at all, so it goes
 * INSIDE the publish transaction, where the database rolls it back for free.
 * There is no timeout, no compensating call and no reconciliation hazard,
 * because there is nothing outside the transaction left to reconcile.
 *
 * The whole object is optional at the type level so consumers who never call
 * `publish()` can keep instantiating `AccommodationService` without wiring
 * billing. At runtime, calling `publish()` without it results in
 * `CONFIGURATION_ERROR`.
 */
export interface AccommodationPublishDeps {
    /** Resolves the publish eligibility for a given owner. */
    checkEligibility: (ownerId: string, ctx?: ServiceContext) => Promise<PublishEligibility>;

    /**
     * Inserts a Hospeda-owned, no-card trial subscription for the owner —
     * INSIDE the caller's transaction (HOS-1012 T-008).
     *
     * Deliberately NOT named `startTrial`: that name belonged to the deleted
     * MercadoPago saga described above, and reusing it would invite someone to
     * restore the timeout and the compensating cancel that spec guard G-2
     * exists to keep out. This one performs local reads and a single local
     * INSERT — no external call may ever be added to it, because it runs with a
     * transaction open (ADR-019).
     *
     * Called by `publish()` only when `checkEligibility` answered
     * `first_publish`, and exactly once per publish.
     *
     * @param input.ownerId - The accommodation owner's user id.
     * @param input.ctx - The publish transaction's context. `ctx.tx` is
     *   guaranteed present (see {@link PublishTransactionContext}) and MUST be
     *   the client every write uses, or the trial escapes the transaction and
     *   a rolled-back publish leaves a live trial behind.
     * @returns The created trial, or `null` when it could not be created (no
     *   billing customer row, the trial plan is missing, or billing is
     *   disabled). `publish()` treats `null` as `subscription_required` and
     *   rejects — a listing must never go live without a clock.
     */
    startLocalTrial: (input: {
        readonly ownerId: string;
        readonly ctx: PublishTransactionContext;
    }) => Promise<StartLocalTrialResult | null>;

    /**
     * Post-commit side effects for a trial started by
     * {@link AccommodationPublishDeps.startLocalTrial}.
     *
     * Exists because of INV-1 and because of WHERE the cache lives: the
     * entitlement cache is an `apps/api` process-local map, so `service-core`
     * cannot clear it itself, and the clear must happen AFTER the publish
     * transaction commits — clearing it earlier would publish entitlements for a
     * row that can still be rolled back. A local trial has no preapproval and
     * therefore no webhook, so nothing else will ever clear it: skip this and
     * the owner keeps seeing their previous (empty) entitlements for up to the
     * full 5-minute TTL, immediately after being told they are live.
     *
     * Best-effort by contract: `publish()` has already committed by the time
     * this runs, so it must not turn a successful publish into an error.
     */
    onTrialStarted: (input: StartLocalTrialResult) => Promise<void>;
}

/**
 * Outcome of `AccommodationService.createForOnboarding`.
 *
 * As of BETA-197, `createForOnboarding` always creates — the auto-resume branch
 * (returning an existing active DRAFT instead of inserting a new one) was removed.
 * The web now calls `GET /host-onboarding/precheck` before showing the form and
 * decides create/resume/delete/upgrade itself; by the time this endpoint is
 * called, the caller has already committed to creating. `status` is kept (rather
 * than dropped) as a literal `'created'` so the `/host-onboarding/start` response
 * shape stays stable for existing consumers.
 *
 * A fresh DRAFT was inserted for the actor and the onboarding flow promotes them
 * from `USER` to `HOST` so they can access host surfaces. When the actor is
 * already `HOST` (or higher) the role promotion is a no-op but a new DRAFT is
 * still created so they don't lose their input.
 */
export type HostOnboardingResult = { status: 'created'; accommodation: Accommodation };

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
    deletedEntity?: { id?: string; destinationId?: string; slug: string; type?: string };
    /** Entity data captured before restore for post-restore side effects (revalidation). */
    restoredAccommodation?: { id?: string; slug: string; destinationId?: string; type?: string };
    /** ID of the entity being hard-deleted, used for Cloudinary media cleanup. */
    deletedEntityId?: string;
    /**
     * The `lifecycleState` value captured from the entity before an update.
     * Used in `_afterUpdate` to detect transitions (e.g., DRAFT → ACTIVE)
     * and trigger side effects such as HOST role auto-assignment.
     */
    previousLifecycleState?: string;
    /**
     * Whether the accommodation was publicly visible (lifecycle ACTIVE + visibility
     * PUBLIC) BEFORE an update. Captured by `_beforeUpdate` and read by `_afterUpdate`
     * to decide whether public-page revalidation is warranted (HOS-203). `undefined`
     * when the pre-update state could not be resolved — treated as "revalidate" (safe).
     */
    previousPubliclyVisible?: boolean;
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
    /** Auto-regenerated slug for an unpublished rename (HOS-784 stage 1). */
    regeneratedSlug?: string;
}
