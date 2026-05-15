import { AccommodationModel } from '@repo/db';
import type { Accommodation } from '@repo/schemas';
import { createUniqueSlug } from '@repo/utils';

/**
 * Flattens nested join rows produced by Drizzle's `with` clause into the canonical
 * `Amenity[]` / `Feature[]` shapes that `AccommodationAdminSchema` declares.
 *
 * Drizzle's `findFirst({ with: { amenities: true, features: true } })` returns
 * join-table rows shaped as `[{ accommodationId, amenityId, amenity: Amenity }, ...]`.
 * Schema consumers expect a flat array of the related entity, so we lift the
 * nested `amenity` / `feature` field to the top level and discard the join metadata.
 *
 * Mutates and returns the same entity reference for parity with `flattenPostTagsRelation`
 * in `PostService` (SPEC-117 A-6 fix).
 *
 * @param entity - Accommodation entity with raw join rows (or null/undefined)
 * @returns The same entity reference, with `amenities`/`features` flattened in-place.
 */
export function flattenAccommodationJoinRelations<T extends Accommodation | null | undefined>(
    entity: T
): T {
    if (!entity) return entity;
    const flattenJoin = <K extends string>(field: K, nestedKey: K) => {
        // TYPE-WORKAROUND: Drizzle's `with`-clause join shape is opaque to TypeScript; the entity
        // is treated as a generic record so we can read the join column by computed key name.
        const raw = (entity as unknown as Record<string, unknown>)[field];
        if (!Array.isArray(raw)) return;
        const flat = raw
            .map((row: unknown) => {
                if (row && typeof row === 'object' && nestedKey in row) {
                    const nested = (row as Record<string, unknown>)[nestedKey];
                    return nested ?? null;
                }
                return row ?? null;
            })
            .filter((item: unknown) => item !== null && item !== undefined);
        // TYPE-WORKAROUND: same generic-record cast as above to write the flattened relation back
        // into the entity at the same computed key, preserving the Accommodation reference identity.
        (entity as unknown as Record<string, unknown>)[field] = flat;
    };
    flattenJoin('amenities', 'amenity');
    flattenJoin('features', 'feature');
    return entity;
}

/**
 * Generates a unique slug for an accommodation based on its type and name.
 * It combines the type and name, creates a slugified version, and ensures
 * its uniqueness in the database by checking against existing accommodations.
 * If a generated slug already exists, it appends a unique suffix.
 *
 * @param type The type of the accommodation (e.g., "hotel", "apartment").
 * @param name The name of the accommodation.
 * @returns A promise that resolves to a unique slug string.
 */
export async function generateSlug(type: string, name: string): Promise<string> {
    const baseString = `${type} ${name}`;
    const model = new AccommodationModel();
    return createUniqueSlug(baseString, async (slug) => {
        const exists = await model.findOne({ slug });
        return !!exists;
    });
}
