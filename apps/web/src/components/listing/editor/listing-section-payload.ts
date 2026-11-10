/**
 * @file listing-section-payload.ts
 * @description Which PATCH keys each listing editor section owns (HOS-1080).
 *
 * Splitting the listing editor into one page per section split its single save
 * into eight. `buildPatchPayload` was NOT rewritten to match — it carries a
 * decade of per-field contracts (`priceFrom` omits, `priceUnit` nulls,
 * `contactInfo` ships wholesale, the duration is diffed JOINED, `media` never
 * ships at all) and rewriting it per section is how those contracts get
 * flattened. It still builds the full diff; this module then keeps only the keys
 * the page being saved is responsible for.
 *
 * In practice a foreign key can rarely appear in that diff anyway — a section
 * page only renders its own controls, so nothing else can change. The
 * restriction is the belt to that suspenders: it makes "this page cannot
 * clobber another section's data" a property of the code rather than a property
 * of what happens to be on screen, which is the same guarantee
 * `useAccommodationSectionForm`'s `ownFields` gives the accommodation editor.
 *
 * ## The map is derived from the catalog (DEC-FAC-040)
 *
 * The catalog's `fields` are the single source of truth for what a section
 * owns; this module no longer keeps a second, hand-maintained copy. A field
 * that moves sections moves here automatically, and a field the catalog assigns
 * to two sections fails `listing-section-payload.test.ts` instead of letting
 * two pages fight over it.
 *
 * `price` and other section ids are shared by venue and experience, so the
 * catalog lookup is the UNION of that section's fields across both verticals.
 * A page only renders its own vertical's controls, so a union entry the other
 * vertical owns is inert — it simply never appears in that page's diff.
 *
 * `menu` is deliberately absent: it is not a form section (`menuUrl` is saved
 * by the carta's own PATCH, and the structured carta has its own endpoints), so
 * it never contributes to the listing PATCH.
 */

import { LISTING_SECTIONS } from '@repo/schemas';

export type ListingEditorFormSectionId =
    | 'basicInfo'
    | 'meetingPoint'
    | 'practicalInfo'
    | 'openingHours'
    | 'price'
    | 'amenities'
    | 'contact'
    | 'nightInfo'
    | 'translations';

/**
 * Section ids `ListingEditor` renders as a form page.
 *
 * The type above is the compile-time half of this list; this constant is the
 * runtime half the derivation walks. They are not merged into one generic type
 * because `Record<ListingEditorFormSectionId, …>` is what gives callers a
 * closed key set.
 */
const FORM_SECTION_IDS: readonly ListingEditorFormSectionId[] = [
    'basicInfo',
    'meetingPoint',
    'practicalInfo',
    'openingHours',
    'price',
    'amenities',
    'contact',
    'nightInfo',
    'translations'
];

/**
 * Catalog fields per section id, unioned across every vertical that declares
 * the section.
 *
 * Built from the catalog rather than compared against a section-id literal:
 * G-FAC-05 scans the editor files for those comparisons.
 */
const CATALOG_FIELDS_BY_SECTION: Readonly<Record<string, readonly string[]>> = (() => {
    const bySection: Record<string, string[]> = {};

    for (const sections of Object.values(LISTING_SECTIONS)) {
        for (const section of sections as ReadonlyArray<{
            readonly id: string;
            readonly fields: readonly string[];
        }>) {
            const fields = bySection[section.id] ?? [];
            for (const field of section.fields) {
                if (!fields.includes(field)) {
                    fields.push(field);
                }
            }
            bySection[section.id] = fields;
        }
    }

    return bySection;
})();

/**
 * Keys INSIDE `policies` a section claims (`policyKeys`, HOS-2060), unioned
 * across verticals like {@link CATALOG_FIELDS_BY_SECTION}.
 *
 * `policies` is one JSONB field owned by the amenities section, but the venue
 * `nightInfo` section claims three of its keys (`minAge`, `dressCode`,
 * `dressCodeNote`). Restricting by top-level field alone would let the
 * amenities page send night keys and drop every key the nightInfo page edits.
 */
const POLICY_KEYS_BY_SECTION: Readonly<Record<string, readonly string[]>> = (() => {
    const bySection: Record<string, string[]> = {};

    for (const sections of Object.values(LISTING_SECTIONS)) {
        for (const section of sections as ReadonlyArray<{
            readonly id: string;
            readonly policyKeys?: readonly string[];
        }>) {
            const keys = bySection[section.id] ?? [];
            for (const key of section.policyKeys ?? []) {
                if (!keys.includes(key)) keys.push(key);
            }
            bySection[section.id] = keys;
        }
    }

    return bySection;
})();

/** Every policy key some section claims; the rest belong to the `policies` owner. */
const CLAIMED_POLICY_KEYS: ReadonlySet<string> = new Set(
    Object.values(POLICY_KEYS_BY_SECTION).flat()
);

/**
 * Fields the listing PATCH accepts, but that the catalog deliberately does not
 * assign to a section. Each one needs its reason here.
 *
 * `businessLines` is structural: the business-line rules assign it, the PATCH
 * does not classify it by section, so the catalog has no home for it. The owner
 * selector lives on the basic-info page and that is the save that persists it
 * (HOS-1787 leaf 5.6).
 */
const UI_ONLY_FIELDS_BY_SECTION: Readonly<Record<string, readonly string[]>> = {
    basicInfo: ['businessLines']
};

const derivedEntries = FORM_SECTION_IDS.map((sectionId) => [
    sectionId,
    [
        ...(CATALOG_FIELDS_BY_SECTION[sectionId] ?? []),
        ...(UI_ONLY_FIELDS_BY_SECTION[sectionId] ?? [])
    ]
]);

// TYPE-WORKAROUND: `Object.fromEntries` widens the closed section-id keys to `string`, so the assertion restores the `ListingEditorFormSectionId` domain the consumers rely on.
const derivedKeys = Object.fromEntries(derivedEntries) as unknown as Record<
    ListingEditorFormSectionId,
    readonly string[]
>;

/** PATCH keys per section id, matching `buildListingEditorSections`. */
export const LISTING_SECTION_PAYLOAD_KEYS: Readonly<
    Record<ListingEditorFormSectionId, readonly string[]>
> = Object.freeze(derivedKeys);

/**
 * Drops every key the given section does not own.
 *
 * @param params - The full diff and the section being saved.
 * @returns The subset of the payload this page may persist. A section with no
 * entry in the map owns nothing, so it gets an empty body — which the editor
 * reads as "no changes" rather than as a save of everything.
 */
export function restrictPayloadToSection({
    payload,
    sectionId
}: {
    readonly payload: Record<string, unknown>;
    readonly sectionId: ListingEditorFormSectionId;
}): Record<string, unknown> {
    const owned = LISTING_SECTION_PAYLOAD_KEYS[sectionId] ?? [];
    const restricted: Record<string, unknown> = {};

    for (const key of owned) {
        if (key === 'policies') continue;
        if (key in payload) {
            restricted[key] = payload[key];
        }
    }

    const policies = restrictPoliciesToSection({
        policies: payload.policies,
        sectionId,
        ownsPoliciesField: owned.includes('policies')
    });
    if (policies !== undefined) {
        restricted.policies = policies;
    }

    return restricted;
}

/**
 * Keeps the `policies` keys a section owns (HOS-2060).
 *
 * The section owning the `policies` FIELD keeps every key no section claims;
 * a section with `policyKeys` keeps exactly those. `policies: null` (clear the
 * whole object) only passes for the field owner.
 *
 * @returns The restricted object, or `undefined` when nothing of it is owned.
 */
function restrictPoliciesToSection({
    policies,
    sectionId,
    ownsPoliciesField
}: {
    readonly policies: unknown;
    readonly sectionId: ListingEditorFormSectionId;
    readonly ownsPoliciesField: boolean;
}): Record<string, unknown> | null | undefined {
    if (policies === null) return ownsPoliciesField ? null : undefined;
    if (typeof policies !== 'object' || policies === undefined) return undefined;

    const claimedHere = POLICY_KEYS_BY_SECTION[sectionId] ?? [];
    const kept = Object.entries(policies as Record<string, unknown>).filter(
        ([key]) => claimedHere.includes(key) || (ownsPoliciesField && !CLAIMED_POLICY_KEYS.has(key))
    );

    return kept.length > 0 ? Object.fromEntries(kept) : undefined;
}
