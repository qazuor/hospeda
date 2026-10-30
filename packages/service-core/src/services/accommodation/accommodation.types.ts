import type { Accommodation } from '@repo/schemas';

/**
 * Every value {@link PublishEligibility} can take, in declaration order.
 *
 * The union is derived FROM this tuple rather than written beside it so the
 * type and the runtime list cannot drift: adding a fourth verdict is one edit,
 * and {@link publishEligibilityAllowsPublish} recognises it on the same commit
 * that introduces it. A hand-maintained second list would reintroduce, in the
 * predicate, exactly the two-sided-rule-updated-on-one-side failure this whole
 * change exists to remove (HOS-1183 R-2).
 */
export const PUBLISH_ELIGIBILITY_VALUES = [
    'first_publish',
    'has_active_sub',
    'subscription_required'
] as const;

/**
 * The actor's current publish eligibility, computed by querying the
 * billing layer for active or historical subscriptions.
 *
 * - `has_active_sub`: the owner already holds a live accommodation-domain
 *   subscription on an `owner`/`complex`-category plan. The publish flow may
 *   proceed without touching billing.
 * - `first_publish`: the owner holds no such subscription BUT is still eligible
 *   for an accommodation free trial (HOS-1012 D-2: eligibility is keyed on
 *   `(customerId, productDomain)`, so spending the venue trial leaves the
 *   accommodation one intact). Publishing is ALLOWED and starts a
 *   Hospeda-owned, no-card trial in the same transaction as the lifecycle flip
 *   (`AccommodationService.publish()` did this until V6.9b retired it, HOS-1641).
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
export type PublishEligibility = (typeof PUBLISH_ELIGIBILITY_VALUES)[number];

/**
 * The one verdict that DENIES publishing. Everything else proceeds.
 *
 * Named as a constant so the rule has a single spelling: a bare
 * `=== 'subscription_required'` scattered across call sites is what let the two
 * sides of this rule drift apart in the first place.
 */
const PUBLISH_DENIED_ELIGIBILITY: PublishEligibility = 'subscription_required';

/**
 * Does this verdict allow the listing to go live?
 *
 * The single place the publish/deny rule is stated. `publish()` and `update()`'s
 * ACTIVE-transition guard both called it (HOS-1183 AC-4) until V6.9b retired
 * both with the legacy listing columns (HOS-1641); publishing now goes through
 * the listing publication machine. The read route `GET /publish-eligibility` that also called
 * it was removed by HOS-1668: the publish card now reads the subscribe
 * destination the server itself consults.
 *
 * ## Why the rule is stated by EXCLUSION
 *
 * `publish()` does not grant publishing to a listed set of verdicts — it
 * *rejects* one:
 *
 * ```ts
 * if (eligibility === 'subscription_required') throw FORBIDDEN;
 * ```
 *
 * Mirroring that as an inclusion (`=== 'first_publish' || === 'has_active_sub'`)
 * would agree with the server today and diverge the moment a fourth verdict is
 * added: the server would publish it, this predicate would deny it, and the
 * button would vanish for an owner the server was about to let through — the
 * HOS-1183 bug, rebuilt from the other side. Exclusion makes a new verdict
 * permissive by default on BOTH sides, which is the side the server is already
 * on.
 *
 * ## Why an unrecognised value is still denied
 *
 * Exclusion is about verdicts the resolver can actually return, not about
 * arbitrary strings. A value outside {@link PUBLISH_ELIGIBILITY_VALUES} is not a
 * fourth verdict — it is a parse failure wearing one's clothes (a typo'd
 * literal, a mangled payload), and treating garbage as permission to publish
 * would grant free days on noise. So unknown input returns `false`.
 *
 * That is deliberately NOT the same thing as the web's fail-open on a failed
 * fetch (AC-10): there, no verdict was obtained at all and the button stays
 * visible so a transient billing hiccup cannot strand a paying host. Here, a
 * verdict *was* produced and is not a verdict. The two live in different layers
 * precisely so neither has to compromise.
 *
 * @param eligibility - The verdict returned by `checkEligibility`.
 * @returns `true` when the listing may be published.
 */
export function publishEligibilityAllowsPublish(eligibility: PublishEligibility): boolean {
    if (!PUBLISH_ELIGIBILITY_VALUES.includes(eligibility)) {
        return false;
    }
    return eligibility !== PUBLISH_DENIED_ELIGIBILITY;
}

/**
 * The one verdict that GRANTS a trial. Everything else publishes without one.
 */
const PUBLISH_TRIAL_GRANTING_ELIGIBILITY: PublishEligibility = 'first_publish';

/**
 * Does publishing under this verdict start a Hospeda-owned local trial?
 *
 * A second question about the same verdict, and deliberately NOT the negation of
 * {@link publishEligibilityAllowsPublish}: `has_active_sub` publishes and starts
 * nothing, because the owner is already paying.
 *
 * ## It is stated by INCLUSION, and that asymmetry is the point
 *
 * Publishing fails OPEN on a verdict this file has not been taught about,
 * because that mirrors what `publish()` does and keeps the button honest. Trial
 * granting fails CLOSED, because it writes a `billing_subscriptions` row that
 * hands out thirty free days: a verdict nobody has reasoned about must not be
 * able to mint one by default. A future `grace_period` should publish
 * immediately and grant nothing until someone decides otherwise.
 *
 * The same asymmetric read appears in `subscriptionMatchesDomain` for the same
 * reason — the permissive default belongs to the side that was already
 * permissive, never to the side that spends money.
 *
 * @param eligibility - The verdict returned by `checkEligibility`.
 * @returns `true` when publishing must insert a local trial subscription.
 */
export function publishEligibilityStartsLocalTrial(eligibility: PublishEligibility): boolean {
    return eligibility === PUBLISH_TRIAL_GRANTING_ELIGIBILITY;
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
     * Whether the accommodation was publicly visible (`publicationStatus`
     * `PUBLISHED`) BEFORE an update. Captured by `_beforeUpdate` and read by `_afterUpdate`
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
    /**
     * The fields the create/update wrote, as they reached `_before*` (HOS-1499).
     * Read by `_after*` to build the owner-act event's "what changed" list.
     */
    ownerActPayload?: Readonly<Record<string, unknown>>;
    /** The row as it stood before the update (HOS-1499), for the event's old values. */
    ownerActBefore?: Readonly<Record<string, unknown>> | null;
}

/**
 * `reason` carried by the `NEW_PAID_SIGNUPS_FROZEN` refusal of a FIRST publish
 * (one that would start a trial) while an admin has paused new signups.
 *
 * The code is shared with the checkout routes; the reason is what lets a
 * client say "your listing was kept as a draft" instead of the checkout copy.
 */
export const FIRST_PUBLISH_PAUSED_REASON = 'FIRST_PUBLISH_PAUSED' as const;
