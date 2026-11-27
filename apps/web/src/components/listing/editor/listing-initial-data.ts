/**
 * @file listing-initial-data.ts
 * @description Builds the listing owner editor's form state from the protected
 * detail (moved out of `ListingEditor.client.tsx`, HOS-2415 AC-12). Every
 * reader is fallback-free in the direction that matters: a missing value reads
 * as empty, never as a fabricated one.
 */

import type { OpeningHours } from '@repo/schemas';
import { extractAmenityAttributes } from '@/lib/api/amenity-attributes';
import { parseListingPolicyValues } from '@/lib/listing/listing-policies';
import type { ListingDetail } from '@/lib/listing/owner-listings';
import type { ListingEditData } from './listing-edit-data';
import { parseLocationValues } from './location-values';
import { splitDuration } from './PracticalInfoSection.client';

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

/**
 * The editor form state for one listing, read from its protected detail.
 *
 * @param params - `initialData` is the protected getById payload.
 * @returns The form state; the editor seeds both `formData` and `baseline` from it.
 */
export function buildListingInitialEditData({
    initialData
}: {
    readonly initialData: ListingDetail;
}): ListingEditData {
    // TYPE-WORKAROUND: the detail is a venue|experience union; we read heterogeneous operational fields by key, which the union type cannot express.
    const data = initialData as unknown as Record<string, unknown>;
    const initialContact = (data.contactInfo ?? {}) as Record<string, unknown>;
    const initialSocial = (data.socialNetworks ?? {}) as Record<string, unknown>;

    return {
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
        // T-020: website removed from contact per AC-4; mobilePhone + workPhone (landline, HOS-2042) + workEmail only
        contact: {
            mobilePhone: strField(initialContact, 'mobilePhone'),
            workPhone: strField(initialContact, 'workPhone'),
            workEmail: strField(initialContact, 'workEmail')
        },
        // HOS-2189: venue postal address; an experience reads it as empty and
        // `buildPatchPayload` never emits it for that vertical.
        // HOS-2256: venue WhatsApp number and who may see the button; an
        // experience reads them as empty and never sends them.
        whatsapp: strField(initialContact, 'whatsapp'),
        whatsappVisibility: strField(data, 'whatsappVisibility'),
        location: parseLocationValues({ raw: data.location }),
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
        // HOS-2061: declared scope/availability read back by the protected getById.
        amenityAttributes: extractAmenityAttributes(
            data.amenityAttributes as readonly Record<string, unknown>[] | undefined
        ),
        featureIds: new Set((data.featureIds as string[] | undefined) ?? []),
        refreshSlugFromName: false
    };
}
