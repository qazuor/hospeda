/**
 * @file amenity-attributes-payload.ts
 * @description Builds the `amenityAttributes` PATCH field for the services
 * page (HOS-2058).
 *
 * The API contract (`syncAmenityJunction`): when `amenityAttributes` is sent it
 * is applied to the FINAL linked set. Listed amenities get the listed values,
 * linked amenities that are not listed are reset to NULL, and an entry for an
 * amenity that is not linked is a validation error. So the list sent here must
 * contain exactly the CHECKED amenities that carry a declaration, and nothing
 * for an unchecked one, even though the form keeps those declarations in state
 * so re-checking restores them.
 *
 * HOS-2084: `extraCharge` is merged per key by the API (omitted keeps the stored
 * value), so an entry whose box was explicitly UNCHECKED is still sent, with
 * `extraCharge: false`, otherwise the stored flag could never be cleared.
 *
 * The field is only sent when the effective list differs from the baseline's,
 * compared by value. Diffing the map by identity would mark the form dirty when
 * a host changes a value and then puts it back.
 */

import type { AmenityAttributeValue } from '@/lib/api/types';

/** One `amenityAttributes` entry as the API expects it. */
export interface AmenityAttributesEntry {
    readonly amenityId: string;
    readonly scope: AmenityAttributeValue['scope'];
    readonly availability: AmenityAttributeValue['availability'];
    /** HOS-2084: omitted = keep the stored value; `false` clears it. */
    readonly extraCharge?: boolean;
}

/** The two inputs the effective list is derived from. */
interface AttributesSource {
    readonly amenityIds: readonly string[];
    readonly amenityAttributes?: Readonly<Record<string, AmenityAttributeValue>>;
}

/**
 * Projects the declarations onto the checked amenities.
 *
 * @param params.amenityIds - Currently checked amenity ids (order preserved)
 * @param params.amenityAttributes - Declarations keyed by amenity id
 * @returns One entry per checked amenity with at least one declared value
 */
export function buildAmenityAttributesList({
    amenityIds,
    amenityAttributes
}: AttributesSource): readonly AmenityAttributesEntry[] {
    const map = amenityAttributes ?? {};
    const seen = new Set<string>();
    const entries: AmenityAttributesEntry[] = [];
    for (const amenityId of amenityIds) {
        if (seen.has(amenityId)) continue;
        seen.add(amenityId);
        const value = map[amenityId];
        if (
            !value ||
            (value.scope === null && value.availability === null && value.extraCharge === undefined)
        ) {
            continue;
        }
        entries.push({
            amenityId,
            scope: value.scope,
            availability: value.availability,
            extraCharge: value.extraCharge
        });
    }
    return entries;
}

/** Order-insensitive key for comparing two lists by value. */
function listKey(entries: readonly AmenityAttributesEntry[]): string {
    return (
        entries
            // An entry declaring nothing (HOS-2084: extraCharge false/unset) is
            // equivalent to no entry, so toggling a box on and off is not a change.
            .filter((e) => e.scope !== null || e.availability !== null || e.extraCharge === true)
            .map(
                (e) =>
                    `${e.amenityId}:${e.scope ?? ''}:${e.availability ?? ''}:${e.extraCharge ? 1 : 0}`
            )
            .sort()
            .join('|')
    );
}

/**
 * Returns `{ amenityAttributes }` when the effective declarations changed
 * against the baseline, and `{}` otherwise.
 *
 * @param params.values - Current form values
 * @param params.baseline - Last saved values
 * @returns The extra PATCH fields, if any
 */
export function buildAmenityAttributesPayload({
    values,
    baseline
}: {
    readonly values: AttributesSource;
    readonly baseline: AttributesSource;
}): { readonly amenityAttributes?: readonly AmenityAttributesEntry[] } {
    const current = buildAmenityAttributesList(values);
    const previous = buildAmenityAttributesList(baseline);
    if (listKey(current) === listKey(previous)) return {};
    return { amenityAttributes: current };
}
