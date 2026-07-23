/**
 * commerce-completeness.ts
 *
 * Publish-readiness ("complete") contract for commerce listings (HOS-166 §6.6).
 *
 * "Complete" is deliberately NOT "passes the Create schema" — the create
 * schemas are permissive by design (`slug`, `ownerId`, `destinationId` are all
 * `.optional()` on `GastronomyAdminCreateInputSchema`), so a listing that
 * satisfies Create can still be unpublishable garbage. This module defines a
 * separate, explicit, per-vertical publish-readiness contract, evaluated by a
 * single pure function with THREE intended callers (§6.6):
 *
 * 1. The protected checkout route (PR-B) — 422 with `missing` when incomplete.
 * 2. The visibility reconciler (PR-B) — keeps an incomplete-but-paid listing
 *    `PRIVATE` (G-3 defense in depth).
 * 3. The web owner surface (PR-C) — renders the "what's missing" checklist.
 *
 * One definition, three consumers. A second definition anywhere is a bug
 * (R-5). This function is PURE — no DB access, no I/O — so it is trivially
 * unit-testable and safe to call from any layer.
 *
 * D-4 compliance: this module has never heard of `commerce_leads` and must
 * never import `CommerceLeadService` or reference lead data — see spec §6.1's
 * anti-pattern table and the AC-14 static guard (enforced in PR-C).
 *
 * @module commerce-completeness
 */

import type { CommerceEntityType, ContactInfo, Media, OpeningHours } from '@repo/schemas';
import { CommerceEntityTypeEnum } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum `summary` length required for publish. Mirrors the WRITE-side
 * minimum enforced by `CommerceIdentityFields.summary` in
 * `packages/schemas/src/common/commerce-identity.schema.ts` — kept as a
 * separate named constant here because that schema module does not export a
 * bare numeric constant to import.
 */
const SUMMARY_MIN_LENGTH = 10;

/**
 * Minimum `description` length required for publish. Mirrors
 * `CommerceIdentityFields.description`'s WRITE-side minimum — see
 * {@link SUMMARY_MIN_LENGTH} for why this is a local constant rather than an
 * import.
 */
const DESCRIPTION_MIN_LENGTH = 20;

/** The seven day keys of {@link OpeningHours.days}, in schema order. */
const OPENING_HOURS_DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * The subset of a commerce listing's fields `resolveListingCompleteness`
 * reads. Deliberately a standalone structural type rather than the full
 * `Gastronomy` / `Experience` entity type: at draft time a real DB row can
 * legitimately violate those schemas' non-nullish invariants (e.g.
 * `destinationId` is `.optional()` at create — spec §6.6), so every field
 * here is nullable/optional to match what a genuinely incomplete draft looks
 * like on the wire, independent of how the full entity schema types it.
 *
 * Callers pass whatever listing shape they have (a service read result, a
 * DB row, a partial form payload) — only the fields below are read.
 */
export interface CommerceListingCompletenessListing {
    /** Listing display name. Required, non-empty. */
    readonly name?: string | null;
    /** Short marketing summary. Required, ≥ {@link SUMMARY_MIN_LENGTH} chars. */
    readonly summary?: string | null;
    /** Full description. Required, ≥ {@link DESCRIPTION_MIN_LENGTH} chars. */
    readonly description?: string | null;
    /** Linked destination UUID. Required (optional at create; required to publish). */
    readonly destinationId?: string | null;
    /** Owning user UUID. Required — ownership + billing anchor. */
    readonly ownerId?: string | null;
    /** Vertical-specific sub-category (e.g. `RESTAURANT`, `TOUR_GUIDE`). Required. */
    readonly type?: string | null;
    /** Media block. Required to carry a `featuredImage`. */
    readonly media?: Pick<Media, 'featuredImage'> | null;
    /** Contact channels. Required: at least one phone OR email field set. */
    readonly contactInfo?: ContactInfo | null;
    /** Weekly opening hours. Gastronomy-only requirement. */
    readonly openingHours?: OpeningHours | null;
    /** Price-range tier. Gastronomy-only requirement. */
    readonly priceRange?: string | null;
}

/** Input to {@link resolveListingCompleteness}. */
export interface ResolveListingCompletenessInput {
    /** Which commerce vertical the listing belongs to. Drives per-vertical rules. */
    readonly entityType: CommerceEntityType;
    /** The listing snapshot to evaluate. See {@link CommerceListingCompletenessListing}. */
    readonly listing: CommerceListingCompletenessListing;
}

/** Result of {@link resolveListingCompleteness}. */
export interface ResolveListingCompletenessResult {
    /** `true` only when `missing` is empty. */
    readonly complete: boolean;
    /**
     * Field names (in the shared/spec §6.6 vocabulary — e.g. `'name'`,
     * `'media.featuredImage'`, `'contactInfo'`) that are missing or invalid.
     * Empty when `complete` is `true`. Order is deterministic (declaration
     * order below), so UI checklists render consistently.
     */
    readonly missing: readonly string[];
}

// ---------------------------------------------------------------------------
// Field-level predicates
// ---------------------------------------------------------------------------

/** `true` when `value` is a non-empty (after trim) string. */
function isNonEmptyString(value: string | null | undefined): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/** `true` when `value` is a non-empty string at least `minLength` characters long. */
function meetsMinLength(value: string | null | undefined, minLength: number): boolean {
    return isNonEmptyString(value) && value.trim().length >= minLength;
}

/**
 * `true` when `contactInfo` carries at least one reachable channel — any
 * phone field (`homePhone` / `workPhone` / `mobilePhone` / `whatsapp`) or any
 * email field (`personalEmail` / `workEmail`).
 */
function hasReachableContactChannel(contactInfo: ContactInfo | null | undefined): boolean {
    if (!contactInfo) {
        return false;
    }
    const phoneFields = [
        contactInfo.homePhone,
        contactInfo.workPhone,
        contactInfo.mobilePhone,
        contactInfo.whatsapp
    ];
    const emailFields = [contactInfo.personalEmail, contactInfo.workEmail];
    return [...phoneFields, ...emailFields].some(isNonEmptyString);
}

/**
 * `true` when `openingHours.days` has at least one day with at least one
 * shift defined (spec §6.6: "≥ 1 day with ≥ 1 shift defined").
 */
function hasAtLeastOneOpeningShift(openingHours: OpeningHours | null | undefined): boolean {
    if (!openingHours?.days) {
        return false;
    }
    return OPENING_HOURS_DAY_KEYS.some((day) => {
        const schedule = openingHours.days[day];
        return (schedule?.shifts?.length ?? 0) > 0;
    });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Evaluates whether a commerce listing is complete enough to publish.
 *
 * Pure function — no DB access, no I/O. Evaluates the SHARED required-field
 * block (both verticals: `name`, `summary`, `description`, `destinationId`,
 * `ownerId`, `type`, `media.featuredImage`, `contactInfo`), then applies
 * per-vertical additions:
 *
 * - `gastronomy` — additionally requires `openingHours` (≥ 1 day with ≥ 1
 *   shift) and `priceRange`.
 * - `experience` — currently evaluates the shared block only. The spec
 *   explicitly leaves experience-specific required fields to a follow-up
 *   (unverified against the experience entity's field set at spec-authoring
 *   time) — see the TODO below.
 *
 * Deliberately does NOT require: `menuUrl`, `richDescription`,
 * `socialNetworks`, `amenityIds`, `featureIds`, gallery beyond the featured
 * image, SEO fields, or i18n variants — those are quality, not viability
 * (spec §6.6).
 *
 * @param input - {@link ResolveListingCompletenessInput}
 * @returns {@link ResolveListingCompletenessResult}
 *
 * @example
 * ```ts
 * const { complete, missing } = resolveListingCompleteness({
 *   entityType: 'gastronomy',
 *   listing: gastronomyRow,
 * });
 * if (!complete) {
 *   throw new HTTPException(422, { message: 'Listing incomplete', cause: { missing } });
 * }
 * ```
 */
export function resolveListingCompleteness(
    input: ResolveListingCompletenessInput
): ResolveListingCompletenessResult {
    const { entityType, listing } = input;
    const missing: string[] = [];

    // ── Shared required-field block (both verticals) ─────────────────────
    if (!isNonEmptyString(listing.name)) {
        missing.push('name');
    }
    if (!meetsMinLength(listing.summary, SUMMARY_MIN_LENGTH)) {
        missing.push('summary');
    }
    if (!meetsMinLength(listing.description, DESCRIPTION_MIN_LENGTH)) {
        missing.push('description');
    }
    if (!isNonEmptyString(listing.destinationId)) {
        missing.push('destinationId');
    }
    if (!isNonEmptyString(listing.ownerId)) {
        missing.push('ownerId');
    }
    if (!isNonEmptyString(listing.type)) {
        missing.push('type');
    }
    if (!listing.media?.featuredImage) {
        missing.push('media.featuredImage');
    }
    if (!hasReachableContactChannel(listing.contactInfo)) {
        missing.push('contactInfo');
    }

    // ── Gastronomy-specific required fields ───────────────────────────────
    if (entityType === CommerceEntityTypeEnum.GASTRONOMY) {
        if (!hasAtLeastOneOpeningShift(listing.openingHours)) {
            missing.push('openingHours');
        }
        if (!isNonEmptyString(listing.priceRange)) {
            missing.push('priceRange');
        }
    }

    // ── Experience-specific required fields ───────────────────────────────
    // TODO(HOS-166 PR-B): confirm experience-specific required fields against
    // the experience entity schema (`packages/schemas/src/entities/experience/`)
    // and add them here. The spec explicitly did not enumerate these — only
    // the shared block above is binding for experience today.

    return { complete: missing.length === 0, missing };
}
