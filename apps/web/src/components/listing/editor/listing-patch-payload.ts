/**
 * @file listing-patch-payload.ts
 * @description The PATCH body of the listing owner editor: the diff between the
 * edited form and the last persisted snapshot (moved out of
 * `ListingEditor.client.tsx` to keep that island under 500 lines, HOS-2415
 * AC-12). The per-field contracts documented on {@link buildPatchPayload} are
 * unchanged.
 */

import { buildAmenityAttributesPayload } from '@/components/host/editor/amenity-attributes-payload';
import {
    buildListingPoliciesPatch,
    LISTING_BASE_POLICY_KEYS,
    type ListingPolicyKey
} from '@/lib/listing/listing-policies';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';
import { buildSlugRefreshPayload } from '@/lib/listing-slug-refresh';
import { type ListingEditData, SOCIAL_KEYS } from './listing-edit-data';
import { buildLocationPatch } from './location-values';
import { joinDuration } from './PracticalInfoSection.client';

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
 * */
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
 *  - The `nameI18n` / `summaryI18n` / `descriptionI18n` / `richDescriptionI18n`
 *    keys are NEVER sent (HOS-2658, AC-22). Translations are written per pair
 *    by the editor's translations section (`PUT .../translations`), and the
 *    owner PATCH schema strips those keys anyway. `entryNoteI18n` still travels:
 *    it carries the Spanish source of the entry note (the service keeps the
 *    stored `en`/`pt`, AC-25).
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
export function buildPatchPayload({
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

    // HOS-2256: the venue WhatsApp number rides the same merged `contactInfo`
    // block, and like the landline its key travels only when it changed, so a
    // listing that never had one is not given an explicit `null` (an experience
    // never changes it, so it never reaches that payload).
    const whatsappChanged = current.whatsapp !== baseline.whatsapp;
    if (!sameValue(current.contact, baseline.contact) || whatsappChanged) {
        payload.contactInfo = {
            mobilePhone: nullWhenEmpty(current.contact.mobilePhone),
            // HOS-2042: the landline is optional and MERGED server-side, so a
            // listing that never had one must not get an explicit `null` written
            // just because another contact field changed (AC-3: stored data stays
            // as it was). The key travels only when there is a value to save or a
            // stored value to clear.
            ...(current.contact.workPhone !== '' || baseline.contact.workPhone !== ''
                ? { workPhone: nullWhenEmpty(current.contact.workPhone) }
                : {}),
            workEmail: nullWhenEmpty(current.contact.workEmail),
            ...(whatsappChanged ? { whatsapp: nullWhenEmpty(current.whatsapp) } : {})
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
    // HOS-2061: the same `amenityAttributes` contract as the accommodation
    // editor — only the CHECKED amenities with a declaration, sent only when
    // the effective list changed by value.
    Object.assign(
        payload,
        buildAmenityAttributesPayload({
            values: {
                amenityIds: [...current.amenityIds],
                amenityAttributes: current.amenityAttributes
            },
            baseline: {
                amenityIds: [...baseline.amenityIds],
                amenityAttributes: baseline.amenityAttributes
            }
        })
    );

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
    venue: [
        ...LISTING_BASE_POLICY_KEYS,
        'reservations',
        'minAge',
        'minAgeScope',
        'dressCode',
        'dressCodeNote'
    ],
    experience: [...LISTING_BASE_POLICY_KEYS, 'privateGroups', 'cancellation']
};

/** The two form snapshots one vertical's own field diff reads. */
interface VerticalPatchFieldsArgs {
    readonly current: ListingEditData;
    readonly baseline: ListingEditData;
}

/** Visibility a venue WhatsApp number gets when the owner never picked one (HOS-2557). */
const DEFAULT_WHATSAPP_VISIBILITY = 'PUBLIC';

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
    // HOS-2256: who may see the WhatsApp button. Writable only through the
    // venue update schema, hence here and not in the shared diff.
    if (current.whatsappVisibility !== baseline.whatsappVisibility) {
        payload.whatsappVisibility = current.whatsappVisibility || null;
    } else if (
        // HOS-2557: "public" is the default. The radio shows it while nothing is
        // stored, so a number entered for the first time saves it with the number
        // (an owner's explicit pick, sent above, always wins).
        current.whatsappVisibility === '' &&
        current.whatsapp !== '' &&
        current.whatsapp !== baseline.whatsapp
    ) {
        payload.whatsappVisibility = DEFAULT_WHATSAPP_VISIBILITY;
    }
    const location = buildLocationPatch({ current: current.location, baseline: baseline.location });
    if (location) {
        payload.location = location;
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
