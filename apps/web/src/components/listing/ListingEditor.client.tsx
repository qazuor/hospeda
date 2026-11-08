/**
 * @file ListingEditor.client.tsx
 * @description Editor island for ONE section of a listing owner's listing
 * (SPEC-249 Part A, extended in SPEC-253 and HOS-166 D-1; split one-page-per-
 * section in HOS-1080). Native HTML form (no TanStack Form, per web
 * conventions) that persists changes through the vertical's protected PATCH
 * endpoint (`updateOwn`).
 *
 * ## One island, one section (HOS-1080)
 *
 * Until HOS-1080 this component rendered every field group at once on a single
 * route, with an in-page scrollspy nav — the long form HOS-892 reported. It now
 * takes a `sectionId` and renders exactly that section, one per route, matching
 * the accommodation editor the two surfaces already shared their `ActionBar`
 * and section styling with.
 *
 * What deliberately did NOT change is `buildPatchPayload`. Its per-field
 * contracts (`priceFrom` omits, `priceUnit` nulls, `contactInfo` ships
 * wholesale, the duration is diffed JOINED, `media` never ships) are the kind of
 * thing a per-section rewrite flattens without anything failing. It still builds
 * the full diff from the whole form state; `restrictPayloadToSection` then keeps
 * only the keys this page owns, so a section can never persist another's data
 * even if a future edit lets a foreign value into state.
 *
 * `slug` stays out of this form — the owner never edits it directly. The server
 * keeps it in sync with the name while the listing is still a draft, then stops
 * auto-changing it once the listing is published (HOS-784 stage 1).
 *
 * Field-group coverage (SPEC-253 additions marked *, HOS-166 D-1 marked †):
 *   † name + destinationId (SPEC-239 decision #5 reversed — the owner now
 *     loads their own identity, see `VenueOwnerUpdateInputSchema`'s JSDoc)
 *   * type select (per-vertical enum, T-020)
 *   * summary textarea (min 10 / max 300, T-020)
 *   T-012 mechanics + richDescription
 *   T-013 simple fields (contactInfo — no website per AC-4)
 *   T-013 social networks (facebook/instagram/twitter/tiktok/youtube + *linkedIn)
 *   T-014 structured fields (openingHours)
 *   T-014 price group (venue: priceRange | experience: isPriceOnRequest + *priceFrom + *priceUnit)
 *   menuUrl lives in the carta section, not the price group (DEC-FAC-062)
 *   HOS-1048 meeting point (experience only: meetingPoint + optional lat/long)
 *   T-015 media gallery
 *   T-016 amenities / features
 */

import {
    ExperienceOwnerUpdateInputSchema,
    type OpeningHours,
    VenueOwnerUpdateInputSchema
} from '@repo/schemas';
import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ZodTypeAny } from 'zod';
import { ActionBar } from '@/components/host/editor/ActionBar.client';
import type { DestinationOption } from '@/components/listing/destination-option';
import { resolveBusinessLinesFieldError } from '@/components/listing/editor/BusinessLinesField.client';
import { apiClient } from '@/lib/api/client';
import type { AmenityData } from '@/lib/api/types';
import { buildEditorHubUrl } from '@/lib/editor/editor-registry';
import { createListingEditorRegistry } from '@/lib/editor/listing-editor-sections';
import { useUnsavedChangesGuard } from '@/lib/forms/use-unsaved-changes-guard';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    buildListingPoliciesPatch,
    LISTING_BASE_POLICY_KEYS,
    type ListingPolicyKey,
    parseListingPolicyValues,
    setListingPolicy
} from '@/lib/listing/listing-policies';
import { LISTING_VERTICAL_FORM_CONFIG } from '@/lib/listing/listing-vertical-form-config';
import type { ListingDetail, VenueOrExperience } from '@/lib/listing/owner-listings';
import {
    buildSlugRefreshPayload,
    shouldOfferPublishedSlugRefresh
} from '@/lib/listing-slug-refresh';
import { refineStrictContactPhone } from '@/lib/phone-editor-validation';
import { addToast } from '@/store/toast-store';
import {
    LISTING_AGGREGATE_FIELDS,
    LISTING_FIELD_ID_SUFFIXES,
    LISTING_FIELD_PREFIX
} from './editor/field-ids';
import {
    type ContactValues,
    type ListingEditData,
    SOCIAL_KEYS,
    type SocialValues
} from './editor/listing-edit-data';
import {
    type ListingEditorFormSectionId,
    restrictPayloadToSection
} from './editor/listing-section-payload';
import type { ListingPolicyChange } from './editor/PoliciesPanel.client';
import { joinDuration, splitDuration } from './editor/PracticalInfoSection.client';
import { LISTING_SECTION_RENDERERS } from './editor/section-renderers';
import styles from './ListingEditor.module.css';
import { type ListingI18nValues, parseListingI18nValues } from './ListingTranslationPanel.client';

export interface ListingEditorProps {
    /** Which vertical this listing belongs to (drives the PATCH endpoint + price group). */
    readonly vertical: VenueOrExperience;
    /**
     * Which section this page edits (HOS-1080). Decides what renders AND what
     * the save may persist — see `listing-section-payload.ts`.
     */
    readonly sectionId: ListingEditorFormSectionId;
    /** UUID of the listing being edited. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** Current operational + identity values fetched from the protected getById. */
    readonly initialData: ListingDetail;
    /** Amenity catalog for the multi-select (fetched SSR from the public endpoint). */
    readonly amenities?: readonly AmenityData[];
    /** Feature catalog for the multi-select (fetched SSR from the public endpoint). */
    readonly features?: readonly AmenityData[];
    /**
     * Destination options for the destination select (HOS-166 D-1). Fetched
     * SSR by the hosting page, same pattern as `amenities`/`features`.
     */
    readonly destinations?: readonly DestinationOption[];
    /**
     * `true` when the SSR destination catalog fetch failed (as opposed to
     * succeeding with a genuinely empty catalog). `destinationId` is REQUIRED
     * for publish-readiness (`resolveListingCompleteness`), so silently
     * hiding the select on a failed fetch (the old `destinations.length > 0`
     * gate) left the owner with no way to ever complete their listing and no
     * indication why the field was missing. Defaults to `false` so existing
     * callers/tests that omit it keep the prior behaviour.
     */
    readonly destinationsLoadFailed?: boolean;
}

type SaveStatus =
    | { readonly kind: 'idle' }
    | { readonly kind: 'saving' }
    | { readonly kind: 'success' }
    | { readonly kind: 'error' };

/** Read a nullable string field from an unknown record as a form-friendly string. */
function strField(source: Record<string, unknown>, key: string): string {
    const value = source[key];
    return typeof value === 'string' ? value : '';
}

/**
 * Read a nullable numeric field as `number | null` (HOS-1048).
 *
 * Deliberately NOT `Number(value) || null`: a persisted `0` is a legitimate
 * coordinate and the falsy check would erase it into "no pin".
 */
function numField(source: Record<string, unknown>, key: string): number | null {
    const value = source[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Read a `text[]` column as a readonly array of strings (HOS-1046).
 *
 * Anything that is not an array of strings collapses to `[]` — including the
 * key being absent, which is what a listing saved before the column existed
 * looks like. Non-string entries are dropped rather than coerced: `String(x)`
 * would turn a stray `null` into the literal item `"null"` and publish it as a
 * bullet on the ficha.
 */
function strArrayField(source: Record<string, unknown>, key: string): readonly string[] {
    const value = source[key];
    if (!Array.isArray(value)) return [];
    return value.filter((entry): entry is string => typeof entry === 'string');
}

/** Read one `{ es, en, pt }` JSONB field as three form-friendly strings. */
function i18nTextField(
    source: Record<string, unknown>,
    key: string
): { readonly es: string; readonly en: string; readonly pt: string } {
    const value = source[key];
    const record =
        typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

    return {
        es: strField(record, 'es'),
        en: strField(record, 'en'),
        pt: strField(record, 'pt')
    };
}

/** Whether every locale of a localized note is empty. */
function isEmptyI18nText(value: {
    readonly es: string;
    readonly en: string;
    readonly pt: string;
}): boolean {
    return value.es.trim() === '' && value.en.trim() === '' && value.pt.trim() === '';
}

/** Shallow equality for the two checklist arrays, used by the PATCH diff. */
function sameStringList(a: readonly string[], b: readonly string[]): boolean {
    return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Map an emptied field to an explicit `null` rather than to `undefined`.
 *
 * `contactInfo` (HOS-1190) and `socialNetworks` (HOS-1262) are MERGEABLE JSONB
 * columns on `VenueModel` and `ExperienceModel` (following the `users`
 * precedent of HOS-375), so
 * the PATCH is shallow-merged into the stored object with PostgreSQL `||`
 * instead of replacing it. Under merge semantics an OMITTED key means "leave
 * the stored value alone", so expressing a clear by omission would make an
 * emptied field silently un-saveable: the owner blanks their phone (or their
 * Instagram), the request succeeds, and the old value is still on the ficha.
 *
 * `null` is the clear. Every field of the shared `ContactInfoSchema` and
 * `SocialNetworkSchema` is `.nullish()` for exactly this reason, so `null`
 * validates while an invalid non-empty phone reports `zodError.common.contact.phone.argentina`,
 * `zodError.common.social.*.invalid`) — the empty string is not an option here.
 */
function nullWhenEmpty(value: string): string | null {
    return value || null;
}

/**
 * Structural comparison for the nested values (openingHours, media, i18n).
 *
 * A serialization compare is key-order sensitive, so it can report a change
 * where none exists. That direction is harmless: a false positive sends a
 * redundant-but-correct value in the PATCH. The dangerous direction — reporting
 * "unchanged" for a real edit, which would silently drop the owner's work —
 * cannot be produced by key reordering, only by equal content. Every value
 * compared here is rebuilt by spreading the previous object, so ordering is
 * stable in practice anyway.
 *
 * `i18nValues`'s four members are diffed and sent ONE AT A TIME (HOS-902), not
 * as the single blob this used to be, so editing only `summaryI18n` never
 * re-sends `nameI18n`/`descriptionI18n`/`richDescriptionI18n` at all. This
 * matters because `parseListingI18nValues` is intentionally fallback-free —
 * `current`/`baseline` always hold the REAL stored i18n values, nothing
 * fabricated — but `nameI18n`/`summaryI18n`/`descriptionI18n`/
 * `richDescriptionI18n` are each a single JSONB column replaced WHOLESALE on
 * save, not merged per locale (`venue.model.ts`/`experience.model.ts`
 * do not list them in `mergeableJsonbColumns`, only `contactInfo` is there —
 * see `packages/db/src/base/base.model.ts:387-393`). So a per-FIELD diff
 * (not per-locale) is exactly right: it must still send the whole
 * `I18nLocaleValues` object of a changed field (all three locales — the
 * column can't be updated one locale at a time), while never touching a
 * sibling field the owner did not edit.
 */
function sameValue(a: unknown, b: unknown): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Set equality by membership (order-independent). */
function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
    return a.size === b.size && [...a].every((id) => b.has(id));
}

/**
 * Build the PATCH body as the diff between the edited form and the last
 * persisted snapshot.
 *
 * This is NOT a uniform per-leaf diff, and the asymmetries are load-bearing:
 *
 *  - `contactInfo` / `socialNetworks` are JSONB blocks that ship WHOLE whenever
 *    any member changed. Both are MERGED (`||`) at the DB layer (HOS-1190,
 *    HOS-1262), so the whole block is no longer strictly required — it is kept
 *    because it is what makes the clear explicit: every member is sent, and an
 *    emptied one is sent as `null` via `nullWhenEmpty`, because under merge an
 *    omitted key means "keep the stored value".
 *  - The four i18n fields are diffed and sent INDEPENDENTLY, per field (HOS-902;
 *    they used to travel together as one unit). Each field is still a single
 *    JSONB column replaced wholesale (all three locales at once — see
 *    `sameValue`'s JSDoc above for the DB-level reason), so editing
 *    `nameI18n.en` sends the WHOLE `nameI18n` object including its untouched
 *    `es`/`pt`. That is safe ONLY because `parseListingI18nValues` never
 *    fabricates a value — the ES display fallback for an empty i18n field
 *    lives exclusively in `ListingTranslationPanel`'s render path
 *    (`resolveDisplayValue`) and is never written into `current`/`baseline`.
 *    An earlier version of this fix baked that fallback into
 *    `parseListingI18nValues` itself, which broke exactly this case: editing
 *    ONE locale of a field would re-send its OTHER locale's fallback display
 *    text as if the owner had typed it, permanently overwriting the i18n
 *    column with content the plain `name`/`summary`/`description`/
 *    `richDescription` column held instead.
 *  - Venue's `priceRange` is `.nullish()` on the domain schema
 *    and clears to an explicit `null`. `priceUnit` now joins it (H-156 made the
 *    column nullable), so clearing it sends `null` rather than omitting the key
 *    — the old omit-instead-of-null rule (T-021) meant the owner could never
 *    actually clear a unit once set. Experience's `priceFrom` is still NOT
 *    nullable and keeps omitting the key.
 *  - `menuUrl` is NOT part of this diff any more (DEC-FAC-062): it belongs to
 *    the carta section and is saved by `VenueMenuLinkField` with its own
 *    one-key PATCH, never by the price page.
 *  - Experience's three `meetingPoint*` fields (HOS-1048) follow the `priceUnit`
 *    rule, not the `priceFrom` one: all three are `.nullish()`, so clearing one
 *    sends an explicit `null`. They ship only on the experience branch, because
 *    they exist only on `ExperienceOwnerUpdateInputSchema`.
 *  - `media` is absent by design (HOS-372): photos are persisted per operation
 *    by `MediaSection` against the relational media endpoints, so re-sending a
 *    buffered `media` block here would overwrite the rows the owner just saved.
 */
function buildPatchPayload({
    current,
    baseline,
    vertical,
    publicationStatus
}: {
    current: ListingEditData;
    baseline: ListingEditData;
    vertical: VenueOrExperience;
    publicationStatus?: string | null;
}): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (current.name !== baseline.name) {
        payload.name = current.name;
    }
    if (current.destinationId !== baseline.destinationId) {
        payload.destinationId = current.destinationId || undefined;
    }
    if (current.listingType !== baseline.listingType) {
        payload.type = current.listingType || undefined;
    }
    if (!sameStringList(current.businessLines, baseline.businessLines)) {
        // `[]` is not a legitimate state (the selector keeps one minimum), so
        // an empty diff can only be the initial load of a row with no column.
        payload.businessLines = [...current.businessLines];
    }
    if (current.summary !== baseline.summary) {
        payload.summary = current.summary || undefined;
    }
    if (current.description !== baseline.description) {
        payload.description = current.description || undefined;
    }
    Object.assign(
        payload,
        buildSlugRefreshPayload({
            currentPublicationStatus: publicationStatus,
            initialName: baseline.name,
            currentName: current.name,
            refreshSlugFromName: current.refreshSlugFromName
        })
    );
    if (current.richDescription !== baseline.richDescription) {
        payload.richDescription = current.richDescription;
    }

    // HOS-902: per-FIELD, NOT the whole `i18nValues` object at once — see the
    // JSDoc above `buildPatchPayload` and above `sameValue` for why this keeps
    // an untouched sibling field out of the payload entirely (each field is
    // still sent whole across its three locales, never a fabricated value).
    if (!sameValue(current.i18nValues.nameI18n, baseline.i18nValues.nameI18n)) {
        payload.nameI18n = current.i18nValues.nameI18n;
    }
    if (!sameValue(current.i18nValues.summaryI18n, baseline.i18nValues.summaryI18n)) {
        payload.summaryI18n = current.i18nValues.summaryI18n;
    }
    if (!sameValue(current.i18nValues.descriptionI18n, baseline.i18nValues.descriptionI18n)) {
        payload.descriptionI18n = current.i18nValues.descriptionI18n;
    }
    if (
        !sameValue(current.i18nValues.richDescriptionI18n, baseline.i18nValues.richDescriptionI18n)
    ) {
        payload.richDescriptionI18n = current.i18nValues.richDescriptionI18n;
    }

    if (!sameValue(current.contact, baseline.contact)) {
        payload.contactInfo = {
            mobilePhone: nullWhenEmpty(current.contact.mobilePhone),
            workEmail: nullWhenEmpty(current.contact.workEmail)
        };
    }

    if (SOCIAL_KEYS.some((key) => current.social[key] !== baseline.social[key])) {
        payload.socialNetworks = {
            facebook: nullWhenEmpty(current.social.facebook),
            instagram: nullWhenEmpty(current.social.instagram),
            twitter: nullWhenEmpty(current.social.twitter),
            tiktok: nullWhenEmpty(current.social.tiktok),
            youtube: nullWhenEmpty(current.social.youtube),
            linkedIn: nullWhenEmpty(current.social.linkedIn)
        };
    }

    if (!sameValue(current.openingHours, baseline.openingHours)) {
        payload.openingHours = current.openingHours;
    }

    if (!sameSet(current.amenityIds, baseline.amenityIds)) {
        payload.amenityIds = [...current.amenityIds];
    }
    if (!sameSet(current.featureIds, baseline.featureIds)) {
        payload.featureIds = [...current.featureIds];
    }

    Object.assign(payload, VERTICAL_PATCH_FIELDS[vertical]({ current, baseline }));

    // HOS-2060: house rules travel as a PATCH object — only the keys that
    // changed, `null` for a removed key — because the API shallow-merges
    // `policies` per key. `restrictPayloadToSection` then keeps the keys the
    // page's catalog section owns (nightInfo's three, or the rest).
    const policies = buildListingPoliciesPatch({
        current: current.policies,
        baseline: baseline.policies,
        keys: VERTICAL_POLICY_KEYS[vertical]
    });
    if (policies) {
        payload.policies = policies;
    }

    return payload;
}

/**
 * The policy keys each vertical's owner update schema accepts (HOS-2060):
 * the shared base plus the vertical's own (`VenuePoliciesSchema`,
 * `ExperiencePoliciesSchema`). A record, not a branch on a vertical literal
 * (G-FAC-05).
 */
const VERTICAL_POLICY_KEYS: Readonly<Record<VenueOrExperience, readonly ListingPolicyKey[]>> = {
    venue: [...LISTING_BASE_POLICY_KEYS, 'reservations', 'minAge', 'dressCode', 'dressCodeNote'],
    experience: [...LISTING_BASE_POLICY_KEYS, 'privateGroups', 'cancellation']
};

/** The two form snapshots one vertical's own field diff reads. */
interface VerticalPatchFieldsArgs {
    readonly current: ListingEditData;
    readonly baseline: ListingEditData;
}

/**
 * Fields only the venue update schema owns: the price tier and nightInfo.
 *
 * Per-vertical payload rules live in a record of builders rather than in an
 * `if (vertical === 'venue')` branch: G-FAC-05 (leaf 5.8) forbids the editor
 * from deciding by a vertical literal. Behaviour is unchanged.
 *
 * Every writable nightInfo field clears to `null`; `entryPriceUpdatedAt` is
 * server-managed and never appears here. Changing `entryKind` to `null` is what
 * makes the server drop both the price and its timestamp (4.2), so the price is
 * not forcibly cleared alongside it.
 */
function buildVenuePatchFields({
    current,
    baseline
}: VerticalPatchFieldsArgs): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (current.priceRange !== baseline.priceRange) {
        payload.priceRange = current.priceRange || null;
    }
    if (current.entryKind !== baseline.entryKind) {
        payload.entryKind = current.entryKind || null;
    }
    if (current.entryPriceFrom !== baseline.entryPriceFrom) {
        payload.entryPriceFrom = current.entryPriceFrom;
    }
    if (!sameValue(current.entryNoteI18n, baseline.entryNoteI18n)) {
        payload.entryNoteI18n = isEmptyI18nText(current.entryNoteI18n)
            ? null
            : current.entryNoteI18n;
    }

    return payload;
}

/**
 * Fields only the experience update schema owns: price-on-request, the starting
 * price and unit, the meeting point and the practical info.
 *
 * See {@link buildVenuePatchFields} for why this is a record entry rather than
 * an `else` branch.
 */
function buildExperiencePatchFields({
    current,
    baseline
}: VerticalPatchFieldsArgs): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (current.isPriceOnRequest !== baseline.isPriceOnRequest) {
        payload.isPriceOnRequest = current.isPriceOnRequest;
    }
    if (current.priceFrom !== baseline.priceFrom) {
        payload.priceFrom = current.priceFrom ?? undefined;
    }
    if (current.priceUnit !== baseline.priceUnit) {
        // H-156: `priceUnit` is nullable now, so clearing it sends an
        // explicit `null` (the venue `priceRange` pattern) instead of
        // omitting the key. Omitting used to be the only option — a `null`
        // failed validation — but it also meant the owner could never
        // actually clear the unit after ticking "price on request": the PATCH
        // silently dropped the change and the stale unit stayed on the row.
        payload.priceUnit = current.priceUnit || null;
    }
    // HOS-1048: the meeting point clears to an explicit `null`, like the
    // venue price fields and unlike `priceFrom`. The column is nullable
    // and the schema is `.nullish()`, so `null` is the only way to say "I
    // removed the address I had" — omitting the key would mean "no change"
    // and the stale meeting point would survive the save silently, which is
    // exactly the bug H-156 had to fix for `priceUnit`.
    if (current.meetingPoint !== baseline.meetingPoint) {
        payload.meetingPoint = current.meetingPoint || null;
    }
    if (current.meetingPointLat !== baseline.meetingPointLat) {
        payload.meetingPointLat = current.meetingPointLat;
    }
    if (current.meetingPointLong !== baseline.meetingPointLong) {
        payload.meetingPointLong = current.meetingPointLong;
    }
    // HOS-1049: `[]` is a meaningful value, not an absence — it is how the
    // owner removes every instruction, exactly as with `whatToBring`. The
    // key ships whenever the list differs, empty or not.
    //
    // Deliberately NOT also guarded on `meetingPointDirectionsEnabled`. A
    // first draft was, and the guard turned out to be unreachable: current
    // and baseline are seeded from the same payload, so they can only differ
    // after an edit, and an unentitled provider's control is `disabled` and
    // cannot be edited. An unreachable branch that no test can kill is worse
    // than no branch — it reads as protection and provides none. The
    // affordance is `disabled`; the ENFORCEMENT is the API's field gate,
    // which refuses this key with a 403 regardless of what any client sends.
    if (!sameStringList(current.meetingPointDirections, baseline.meetingPointDirections)) {
        payload.meetingPointDirections = [...current.meetingPointDirections];
    }

    // HOS-898: two boxes, one column. The diff has to be taken on the JOINED
    // value, not on the two halves — a change from 90 minutes to 1 h 30 min
    // moves both boxes and changes nothing the row can tell apart, and
    // emitting it would mark the form dirty and trip the unsaved-changes
    // guard over a no-op.
    const currentDuration = joinDuration({
        hours: current.durationHours,
        minutes: current.durationMinutesPart
    });
    const baselineDuration = joinDuration({
        hours: baseline.durationHours,
        minutes: baseline.durationMinutesPart
    });
    if (currentDuration !== baselineDuration) {
        // Explicit `null` when both boxes are emptied, for the same reason
        // as the meeting point: omitting the key means "no change" and the
        // stale duration would survive the save in silence.
        payload.durationMinutes = currentDuration;
    }

    // HOS-1046: `[]` is a meaningful value here, not an absence — it is how
    // the owner removes every item. So the key ships whenever the list
    // differs, empty or not; only an UNCHANGED list is omitted.
    if (!sameStringList(current.whatToBring, baseline.whatToBring)) {
        payload.whatToBring = [...current.whatToBring];
    }
    if (!sameStringList(current.requirements, baseline.requirements)) {
        payload.requirements = [...current.requirements];
    }

    return payload;
}

/** The extra per-vertical field diff each vertical's update schema accepts. */
const VERTICAL_PATCH_FIELDS: Readonly<
    Record<VenueOrExperience, (args: VerticalPatchFieldsArgs) => Record<string, unknown>>
> = {
    venue: buildVenuePatchFields,
    experience: buildExperiencePatchFields
};

/**
 * Client-side validation schemas: the real owner-update schemas (the same ones
 * {@link LISTING_VERTICAL_FORM_CONFIG} declares as `updateSchema`) plus the
 * strict Argentine phone rule (HOS-2034). The shared schema stays permissive so
 * stored legacy phones keep validating; only the editor refuses a too-short
 * `+54` value.
 */
const EDITOR_SCHEMAS: Readonly<Record<VenueOrExperience, ZodTypeAny>> = {
    venue: VenueOwnerUpdateInputSchema.superRefine(refineStrictContactPhone),
    experience: ExperienceOwnerUpdateInputSchema.superRefine(refineStrictContactPhone)
};

/**
 * Owner editor for ONE section. Tracks which field groups changed and PATCHes
 * only the dirty subset of the keys this section owns, so a save here can never
 * re-submit — let alone clobber — another section's data.
 */
export function ListingEditor({
    vertical,
    sectionId,
    listingId,
    locale,
    initialData,
    amenities = [],
    features = [],
    destinations = [],
    destinationsLoadFailed = false
}: ListingEditorProps): JSX.Element {
    const { t } = createTranslations(locale);
    // Per-vertical data (update schema, PATCH endpoint, business-line presence)
    // read from the shared record instead of compared against a literal.
    const { patchPath, showsBusinessLines } = LISTING_VERTICAL_FORM_CONFIG[vertical];

    // Field-level validation is delegated to the shared `useZodForm` primitive
    // (HOS-190 slice 3) against the REAL per-vertical owner-update schema — the
    // exact schema `PATCH /api/v1/protected/{venues|experiences}/:id`
    // validates the request body against (`apps/api/src/routes/.../protected/patch.ts`).
    // Validating the full dirty-field payload against it (instead of the two ad
    // hoc summary/priceFrom checks this editor had) closes contact
    // (mobilePhone/workEmail), social networks, opening hours, and the
    // priceFrom/priceUnit null-vs-undefined bug (see `buildPayload` below).
    const schema = EDITOR_SCHEMAS[vertical];
    const { fieldErrors, formError, validate, handleApiError, setFormError } = useZodForm({
        schema,
        t,
        // HOS-373: a failed submit focuses the first invalid field on the page.
        // HOS-385: derived from the Zod key by the same `buildFieldId` the
        // sections render with, so this is a namespace plus the genuine
        // exceptions — not a table that can disagree with the markup.
        fieldIdPrefix: LISTING_FIELD_PREFIX,
        fieldIdSuffixes: LISTING_FIELD_ID_SUFFIXES,
        // HOS-814: `openingHours` is 7 days x N shifts under one Zod key, so
        // every rejection arrives at a nested path and nothing read the bare
        // key — the section's <FieldError> and the focus move were both dead.
        // Rolling the first nested message up revives both.
        aggregateFields: LISTING_AGGREGATE_FIELDS
    });

    // TYPE-WORKAROUND: the detail is a venue|experience union; we read heterogeneous operational fields by key, which the union type cannot express.
    const data = initialData as unknown as Record<string, unknown>;
    const initialContact = (data.contactInfo ?? {}) as Record<string, unknown>;
    const initialSocial = (data.socialNetworks ?? {}) as Record<string, unknown>;

    // HOS-372: media is not buffered in this editor's state at all. MediaSection
    // is self-contained (per-operation persistence against the relational
    // venue_media / experience_media endpoints — see its file header) and
    // hydrates its own state from the API; since HOS-1080 it is mounted by its
    // own route rather than by this island, so nothing about photos reaches
    // here.

    // HOS-166 D-1: name + destinationId + description are identity fields the
    // owner may edit (description was widened alongside name/destinationId on
    // the schema — see `VenueOwnerUpdateInputSchema`/
    // `ExperienceOwnerUpdateInputSchema` — but the FORM never exposed it,
    // leaving it settable only at create, contradicting AC-19).
    const buildInitialEditData = (): ListingEditData => ({
        name: strField(data, 'name'),
        destinationId: strField(data, 'destinationId'),
        description: strField(data, 'description'),
        // T-020: type select state (per-vertical enum value)
        listingType: strField(data, 'type'),
        // HOS-1787 leaf 5.6 — the venue's current business lines, read from the
        // protected detail (VenueProtectedSchema) so the selector opens seeded.
        businessLines: strArrayField(data, 'businessLines'),
        // T-020: summary (min 10 / max 300) — validated by `schema` through
        // `fieldErrors.summary`; no local ad hoc check.
        summary: strField(data, 'summary'),
        richDescription: strField(data, 'richDescription'),
        // T-020: website removed from contact per AC-4; mobilePhone + workEmail only
        contact: {
            mobilePhone: strField(initialContact, 'mobilePhone'),
            workEmail: strField(initialContact, 'workEmail')
        },
        // T-020: added linkedIn to social per AC-4
        social: {
            facebook: strField(initialSocial, 'facebook'),
            instagram: strField(initialSocial, 'instagram'),
            twitter: strField(initialSocial, 'twitter'),
            tiktok: strField(initialSocial, 'tiktok'),
            youtube: strField(initialSocial, 'youtube'),
            linkedIn: strField(initialSocial, 'linkedIn')
        },
        openingHours: (data.openingHours as OpeningHours | null | undefined) ?? null,
        priceRange: strField(data, 'priceRange'),
        isPriceOnRequest: data.isPriceOnRequest === true,
        // T-021: experience-only pricing fields
        priceFrom: typeof data.priceFrom === 'number' ? data.priceFrom : null,
        priceUnit: strField(data, 'priceUnit'),
        // HOS-1787 leaf 5.1: nightlife fields. The two notes are always all
        // three locales as strings; clearing every locale is a `null` in the
        // PATCH, so `buildPatchPayload` decides that, not this loader.
        entryKind: strField(data, 'entryKind'),
        entryNoteI18n: i18nTextField(data, 'entryNoteI18n'),
        entryPriceFrom: numField(data, 'entryPriceFrom'),
        entryPriceUpdatedAt:
            typeof data.entryPriceUpdatedAt === 'string'
                ? data.entryPriceUpdatedAt
                : data.entryPriceUpdatedAt instanceof Date
                  ? data.entryPriceUpdatedAt.toISOString()
                  : null,
        // HOS-1048: experience-only; a venue listing simply reads them as
        // empty/null and `buildPatchPayload` never emits them for that vertical.
        meetingPoint: strField(data, 'meetingPoint'),
        meetingPointLat: numField(data, 'meetingPointLat'),
        meetingPointLong: numField(data, 'meetingPointLong'),
        // HOS-1049: the value round-trips for everyone; the flag beside it is
        // what decides whether the control is editable. Absent reads as NOT
        // entitled — the one direction where guessing gives the product away.
        meetingPointDirections: strArrayField(data, 'meetingPointDirections'),
        meetingPointDirectionsEnabled: data.meetingPointDirectionsEnabled === true,
        // HOS-898: one stored column, two boxes. `splitDuration` runs ONCE here
        // and never again on re-render, which is what stops the boxes from
        // rewriting themselves while the owner types.
        durationHours: splitDuration({ totalMinutes: numField(data, 'durationMinutes') }).hours,
        durationMinutesPart: splitDuration({
            totalMinutes: numField(data, 'durationMinutes')
        }).minutes,
        // HOS-1046: experience-only, same as the meeting point above — a venue
        // listing reads them as empty and `buildPatchPayload` never emits them
        // for that vertical.
        whatToBring: strArrayField(data, 'whatToBring'),
        requirements: strArrayField(data, 'requirements'),
        // HOS-2060: house rules, including the venue night keys and the
        // experience cancellation text / private groups.
        policies: parseListingPolicyValues({ raw: data.policies }),
        amenityIds: new Set((data.amenityIds as string[] | undefined) ?? []),
        featureIds: new Set((data.featureIds as string[] | undefined) ?? []),
        // T-023: i18n fields (nameI18n, summaryI18n, descriptionI18n, richDescriptionI18n)
        i18nValues: parseListingI18nValues(data),
        refreshSlugFromName: false
    });

    const [formData, setFormData] = useState<ListingEditData>(buildInitialEditData);
    // The PATCH diff is computed against this MUTABLE baseline, resynced to the
    // persisted values after every successful save — mirroring the accommodation
    // editor (HOS-190 F6). Diffing against the load-time `initialData` prop
    // instead would make reverting a just-saved field produce an empty diff
    // while the DB still held the new value, leaving the owner unable to undo
    // the change without a full page reload.
    const [baseline, setBaseline] = useState<ListingEditData>(buildInitialEditData);

    const currentPublicationStatus = String(data.publicationStatus ?? 'DRAFT');

    const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

    /**
     * Generic single-field change, shared by every scalar input in the form —
     * the venue/experience counterpart of the accommodation editor's
     * `handleTextFieldChange`. Resets any stale save status, exactly as the
     * former `markDirty` did.
     */
    const onFieldChange = useCallback(
        <K extends keyof ListingEditData>(field: K, value: ListingEditData[K]) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            setStatus({ kind: 'idle' });
        },
        []
    );

    const updateContact = useCallback((patch: Partial<ContactValues>) => {
        setFormData((prev) => ({ ...prev, contact: { ...prev.contact, ...patch } }));
        setStatus({ kind: 'idle' });
    }, []);

    const updateSocial = useCallback((key: keyof SocialValues, val: string) => {
        setFormData((prev) => ({ ...prev, social: { ...prev.social, [key]: val } }));
        setStatus({ kind: 'idle' });
    }, []);

    /** Sets or removes (`undefined`) one house-rule key (HOS-2060). */
    const onPolicyChange: ListingPolicyChange = useCallback((key, value) => {
        setFormData((prev) => ({
            ...prev,
            policies: setListingPolicy({ policies: prev.policies, key, value })
        }));
        setStatus({ kind: 'idle' });
    }, []);

    const toggleAmenity = useCallback((id: string) => {
        setFormData((prev) => {
            const next = new Set(prev.amenityIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { ...prev, amenityIds: next };
        });
        setStatus({ kind: 'idle' });
    }, []);

    const toggleFeature = useCallback((id: string) => {
        setFormData((prev) => {
            const next = new Set(prev.featureIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { ...prev, featureIds: next };
        });
        setStatus({ kind: 'idle' });
    }, []);

    /**
     * Handle i18n panel changes. The callback always carries the FULL
     * `ListingI18nValues` shape (that is the panel's state), but the PATCH
     * diff (`buildPatchPayload`) still compares and sends each of the four
     * fields independently — see its JSDoc (HOS-902).
     */
    const handleI18nChange = useCallback((updated: ListingI18nValues) => {
        setFormData((prev) => ({ ...prev, i18nValues: updated }));
        setStatus({ kind: 'idle' });
    }, []);

    /**
     * The PATCH body: the diff between the edited form and the last persisted
     * snapshot (see `buildPatchPayload` for the per-field contract). Memoized so
     * `canSave` can be derived from it without rebuilding the payload on every
     * render.
     */
    const patchPayload = useMemo(
        () =>
            restrictPayloadToSection({
                payload: buildPatchPayload({
                    current: formData,
                    baseline,
                    vertical,
                    publicationStatus: currentPublicationStatus
                }),
                sectionId
            }),
        [formData, baseline, vertical, currentPublicationStatus, sectionId]
    );

    // HOS-1787 leaf 5.7: a type change revalidates the business lines. An
    // invalid selection must block the save and show the catalog's reason, never
    // silently drop a line (removing one hides the content it owns). The helper
    // is the web's only `validateBusinessLines` caller (G-FAC-09/G-FAC-03).
    const businessLinesError = showsBusinessLines
        ? resolveBusinessLinesFieldError({
              vertical,
              type: formData.listingType,
              selected: formData.businessLines,
              t
          })
        : undefined;

    const shouldOfferSlugRefresh = shouldOfferPublishedSlugRefresh({
        currentPublicationStatus,
        initialName: baseline.name,
        currentName: formData.name
    });

    useEffect(() => {
        if (!shouldOfferSlugRefresh && formData.refreshSlugFromName) {
            setFormData((prev) => ({ ...prev, refreshSlugFromName: false }));
        }
    }, [formData.refreshSlugFromName, shouldOfferSlugRefresh]);

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            // HOS-816: retire the previous attempt's banner as this one STARTS.
            // Nothing else ever cleared it: `handleApiError` only ever sets a
            // message, and the success branch below left whatever was on screen
            // untouched — so a save that failed and then succeeded showed the
            // green toast and the red banner at the same time, and the banner
            // is the one a person believes. It has to run before the no-changes
            // early return too, or the stale banner outlives that path as well.
            // Every other consumer of `useZodForm` (PostEditor, EventEditor,
            // ProfileEditForm, PartnerEditForm, HostTradeEditForm,
            // use-accommodation-section-form) already opens its submit this way;
            // this editor and `ListingCreateForm` were the two that did not.
            setFormError(null);
            if (Object.keys(patchPayload).length === 0) {
                // Never save silently (HOS-190): "Guardar" always visibly does
                // something. This used to be a bare `return`, which was
                // invisible but harmless while the button was disabled with
                // nothing to save. The shared `ActionBar` keeps Save enabled, so
                // without this the owner would press a live button and get no
                // response at all.
                addToast({
                    type: 'info',
                    message: t('listing.owner.editor.noChanges', 'No hay cambios para guardar')
                });
                return;
            }

            // A selection the new type does not admit blocks the save before it
            // reaches the API. The field already renders the same reason; this
            // keeps the form from sending a write the server would reject and
            // whose section effects the owner has not seen.
            if (businessLinesError) {
                setFormError(businessLinesError);
                return;
            }

            const payload = patchPayload;
            // Snapshot the values this request persists, so the baseline resync
            // below records exactly what was saved even if the owner keeps
            // typing while the request is in flight.
            const persisted = formData;

            // Full payload validation against the real per-vertical owner-update
            // schema (see `schema` above) — replaces the two ad hoc
            // summary/priceFrom checks this editor previously ran by hand.
            const parsed = validate(payload);
            if (!parsed.success) {
                return;
            }

            setStatus({ kind: 'saving' });

            const result = await apiClient.patch<unknown>({
                path: patchPath(listingId),
                body: payload
            });

            if (result.ok) {
                setBaseline({ ...persisted, refreshSlugFromName: false });
                setFormData((prev) => ({ ...prev, refreshSlugFromName: false }));
                setStatus({ kind: 'idle' });
                addToast({
                    type: 'success',
                    message: t('listing.owner.editor.success', 'Cambios guardados.')
                });
            } else {
                // A section the listing's business lines no longer own (409
                // SECTION_ABSENT) has its own copy: "no longer applies to your
                // venue's business lines" names the cause, while the generic
                // save-failed banner would hide it.
                if (result.error?.status === 409 && result.error.reason === 'SECTION_ABSENT') {
                    setFormError(
                        t(
                            'listing.owner.editor.errors.sectionAbsent',
                            'Esa sección ya no aplica a los rubros de tu local.'
                        )
                    );
                    setStatus({ kind: 'error' });
                    return;
                }
                // Previously discarded `result.error` entirely and always showed
                // a fixed banner string. `handleApiError` maps per-field details
                // when the API sent them, falling back to a real (translated)
                // banner message otherwise — see `field-errors.ts` module doc.
                handleApiError(
                    result.error,
                    t('listing.owner.editor.error', 'No se pudieron guardar los cambios.')
                );
                setStatus({ kind: 'error' });
            }
        },
        [
            patchPayload,
            formData,
            patchPath,
            listingId,
            businessLinesError,
            validate,
            handleApiError,
            setFormError,
            t
        ]
    );

    const isSaving = status.kind === 'saving';

    /**
     * Announces that this island has hydrated, by setting `data-hydrated` on the
     * form once mounted (HOS-1080).
     *
     * Every control in every section is server-rendered, so "the input is
     * visible and editable" is true long before React attaches a single
     * handler — the false gate HOS-371 already had to fix once, when writing
     * into a not-yet-listening node left the form clean and Save silent. Its fix
     * was to wait for `.ProseMirror`, which TipTap creates at runtime; that
     * worked while the editor was ONE page carrying the rich-text field. With
     * one page per section, seven of the eight sections have no client-created
     * DOM at all, so there is nothing on them to wait for.
     *
     * A parent effect is the strongest signal available and needs no per-section
     * table: React runs child effects BEFORE parent effects, so by the time this
     * fires every section component below has finished mounting — strictly later
     * than `.ProseMirror` appearing, not merely equivalent to it.
     *
     * Set through a ref rather than through state so it costs no extra render.
     * React never rewrites an attribute it does not itself render, so it
     * survives every subsequent update.
     */
    const formRef = useRef<HTMLFormElement>(null);
    useEffect(() => {
        formRef.current?.setAttribute('data-hydrated', 'true');
    }, []);

    /**
     * Leaves the section for the editor hub.
     *
     * HOS-1080 changed the destination, not the mechanism: with one page per
     * section, "Cancelar" means "leave this section", and the hub is the page
     * every section was reached from. Dropping the owner all the way back to
     * `mi-cuenta/comercio` from a section page would discard their place in the
     * editor as well as their edits.
     *
     * `ActionBar` renders Cancel as a `<button>`, so this navigates in JS. The
     * bespoke bar this replaced used an `<a href>`, which middle-click and
     * "open in new tab" understood and this does not — accepted deliberately in
     * exchange for the three content editors sharing one action bar.
     */
    const handleCancel = useCallback(() => {
        window.location.href = buildEditorHubUrl({
            locale,
            registry: createListingEditorRegistry({ vertical, sections: [] }),
            entityId: listingId
        });
    }, [locale, vertical, listingId]);

    // HOS-373: warns before leaving with unsaved edits. Reuses the same diff as
    // `canSave`, so the guard goes quiet the moment a save resyncs the baseline.
    useUnsavedChangesGuard({
        isDirty: Object.keys(patchPayload).length > 0,
        title: t('common.confirmations.unsavedChanges.title', 'Cambios sin guardar'),
        confirmLabel: t('common.confirmations.unsavedChanges.confirm', 'Sí, descartar'),
        cancelLabel: t('common.confirmations.unsavedChanges.cancel', 'Seguir editando'),
        message: t(
            'listing.owner.editor.unsavedChanges',
            'Tenés cambios sin guardar. Si salís ahora se pierden. ¿Querés salir igual?'
        )
    });

    return (
        <form
            ref={formRef}
            className={styles.editor}
            onSubmit={handleSubmit}
            aria-busy={isSaving}
            noValidate
        >
            {LISTING_SECTION_RENDERERS[sectionId]({
                locale,
                vertical,
                data: formData,
                errors: businessLinesError
                    ? {
                          ...fieldErrors,
                          businessLines: fieldErrors.businessLines ?? businessLinesError
                      }
                    : fieldErrors,
                destinations,
                destinationsLoadFailed,
                amenities,
                features,
                onFieldChange,
                onPolicyChange,
                onContactChange: updateContact,
                onSocialChange: updateSocial,
                onToggleAmenity: toggleAmenity,
                onToggleFeature: toggleFeature,
                onI18nChange: handleI18nChange,
                shouldOfferSlugRefresh,
                listingId
            })}

            {formError && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {formError}
                </p>
            )}

            <ActionBar
                locale={locale}
                isSaving={isSaving}
                onCancel={handleCancel}
            />
        </form>
    );
}
