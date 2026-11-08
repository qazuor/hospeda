/**
 * amenity-relation-attributes.ts
 *
 * The relation-attribute half of every amenity junction sync (HOS-2058 for
 * `r_accommodation_amenity`, HOS-2061 for `r_venue_amenity` and
 * `r_experience_amenity`). One implementation, so the three verticals can
 * never drift into different meanings of "not declared".
 *
 * Contract (shared by every vertical):
 * - the attribute list is applied to the FINAL linked set;
 * - a listed amenity gets exactly its listed `scope` / `availability`;
 * - a linked amenity that is NOT listed is reset to NULL ("not declared");
 * - an entry for an amenity that will not be linked is a `VALIDATION_ERROR`,
 *   raised before any write so nothing is rolled back half-way.
 *
 * @module utils/amenity-relation-attributes
 */

import {
    type AmenityAvailabilityEnum,
    type AmenityRelationAttributes,
    type AmenityScopeEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '../types';

/** Declared attribute values of one relation row. NULL = not declared. */
export interface AmenityAttributeValues {
    readonly scope: AmenityScopeEnum | null;
    readonly availability: AmenityAvailabilityEnum | null;
}

/** Desired attribute values, keyed by amenity id. */
export type DesiredAmenityAttributes = ReadonlyMap<string, AmenityAttributeValues>;

/**
 * Builds the desired attribute map for the final linked set, or throws when an
 * entry names an amenity that will not be linked.
 *
 * @param input.amenityAttributes - The attribute list sent by the caller.
 * @param input.finalIds - Amenity ids linked once the sync completes.
 * @returns One entry per linked amenity; unlisted ones are all-NULL.
 * @throws {ServiceError} `VALIDATION_ERROR` when an entry names an unlinked amenity.
 */
export function resolveDesiredAmenityAttributes({
    amenityAttributes,
    finalIds
}: {
    readonly amenityAttributes: readonly AmenityRelationAttributes[];
    readonly finalIds: ReadonlySet<string>;
}): DesiredAmenityAttributes {
    const listed = new Map(amenityAttributes.map((item) => [item.amenityId, item]));
    const unlinked = [...listed.keys()].filter((id) => !finalIds.has(id));
    if (unlinked.length > 0) {
        throw new ServiceError(
            ServiceErrorCode.VALIDATION_ERROR,
            `amenityAttributes references amenities that are not linked: ${unlinked.join(', ')}`
        );
    }
    const desired = new Map<string, AmenityAttributeValues>();
    for (const id of finalIds) {
        const item = listed.get(id);
        desired.set(id, {
            scope: item?.scope ?? null,
            availability: item?.availability ?? null
        });
    }
    return desired;
}

/**
 * Whether a stored row already holds the desired attribute values, so the
 * caller can skip a no-op UPDATE.
 *
 * @param input.row - The stored relation row (missing columns read as NULL).
 * @param input.want - The desired values.
 * @returns `true` when both attributes already match.
 */
export function amenityAttributesMatch({
    row,
    want
}: {
    readonly row: {
        readonly scope?: AmenityScopeEnum | null;
        readonly availability?: AmenityAvailabilityEnum | null;
    };
    readonly want: AmenityAttributeValues;
}): boolean {
    return (row.scope ?? null) === want.scope && (row.availability ?? null) === want.availability;
}
