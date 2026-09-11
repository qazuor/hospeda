/**
 * @file commerce-section-payload.ts
 * @description Which PATCH keys each commerce editor section owns (HOS-1080).
 *
 * Splitting the commerce editor into one page per section split its single save
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
 * ## The invariant that matters
 *
 * Every key `buildPatchPayload` can emit belongs to EXACTLY ONE section. A key
 * owned by none is a field the owner can edit and never save; a key owned by two
 * is a field two pages fight over. `commerce-section-payload.test.ts` asserts
 * both directions against the real source of `buildPatchPayload`, so adding a
 * field without giving it a home fails CI rather than shipping silently
 * unsaveable.
 */

/**
 * The sections that are edited through the listing PATCH, i.e. the ones
 * `CommerceListingEditor` can render.
 *
 * `media` and `faqs` are deliberately NOT here: they persist through their own
 * endpoints and never contribute to the listing PATCH at all — see
 * `MediaSection` (HOS-372) and `CommerceFaqManager` (HOS-811). Their routes
 * mount those components directly, with no form and no save button, exactly as
 * the accommodation editor's `fotos` and `preguntas` pages do.
 */
export type CommerceEditorFormSectionId =
    | 'basicInfo'
    | 'meetingPoint'
    | 'practicalInfo'
    | 'openingHours'
    | 'price'
    | 'amenities'
    | 'contact'
    | 'translations';

/** PATCH keys per section id, matching `buildCommerceEditorSections`. */
export const COMMERCE_SECTION_PAYLOAD_KEYS: Readonly<
    Record<CommerceEditorFormSectionId, readonly string[]>
> = {
    basicInfo: [
        'name',
        'destinationId',
        'type',
        'summary',
        'description',
        'richDescription',
        // Not a field of its own: the opt-in checkbox that rides along with a
        // name change on a published listing (HOS-784), rendered by
        // `BasicInfoSection`.
        'refreshSlugFromName'
    ],
    meetingPoint: [
        'meetingPoint',
        'meetingPointLat',
        'meetingPointLong',
        // HOS-1049 — the paid half, on the same page as the free half. Both are
        // one errand for the owner ("where do we meet, and how do you get
        // there"), and splitting them into two nav items would have made the
        // entitlement look like a different subject rather than a deeper tier.
        'meetingPointDirections'
    ],
    practicalInfo: [
        'durationMinutes',
        'whatToBring',
        'requirements',
        'cancellationPolicy',
        'acceptsPrivateGroups'
    ],
    openingHours: ['openingHours'],
    price: ['priceRange', 'menuUrl', 'isPriceOnRequest', 'priceFrom', 'priceUnit'],
    amenities: ['amenityIds', 'featureIds'],
    contact: ['contactInfo', 'socialNetworks'],
    translations: ['nameI18n', 'summaryI18n', 'descriptionI18n', 'richDescriptionI18n']
};

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
    readonly sectionId: CommerceEditorFormSectionId;
}): Record<string, unknown> {
    const owned = COMMERCE_SECTION_PAYLOAD_KEYS[sectionId] ?? [];
    const restricted: Record<string, unknown> = {};

    for (const key of owned) {
        if (key in payload) {
            restricted[key] = payload[key];
        }
    }

    return restricted;
}
