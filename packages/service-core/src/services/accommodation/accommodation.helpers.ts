import { AccommodationModel } from '@repo/db';
import type { Accommodation } from '@repo/schemas';
import { createUniqueSlug } from '@repo/utils';

/**
 * Flattens nested join rows produced by Drizzle's `with` clause into a single
 * merged record per relation, exposing BOTH the join metadata and the related
 * entity fields at the top level.
 *
 * Drizzle's `findFirst({ with: { amenities: { with: { amenity: true } } } })`
 * returns junction rows shaped as
 * `[{ accommodationId, amenityId, isOptional, additionalCost, amenity: Amenity }, ...]`.
 *
 * Downstream response schemas pick different subsets of those fields:
 * - `AccommodationPublicSchema.amenities` picks `{ amenityId, slug, icon, isOptional, additionalCost }`
 *   — a merge of junction (`amenityId`, `isOptional`, `additionalCost`) and entity (`slug`, `icon`).
 *   SPEC-266: the catalog `name` column was dropped; `slug` is the i18n key.
 * - `AccommodationProtectedSchema.amenities` / `AccommodationAdminSchema.amenities` pick the
 *   entity-only shape (`{ id, slug, icon, ... }`).
 *
 * By merging `{ ...joinRow, ...joinRow[nestedKey] }` per row we produce a flat
 * object that satisfies all three schemas — Zod's `.pick()` strips whatever each
 * tier doesn't declare. The nested entity wrapper key (`amenity` / `feature`) is
 * removed so it doesn't leak into the response payload.
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
                if (!row || typeof row !== 'object') return null;
                const rec = row as Record<string, unknown>;
                if (!(nestedKey in rec)) return rec;
                const nested = rec[nestedKey];
                if (!nested || typeof nested !== 'object') {
                    // No nested entity to merge in — drop the nestedKey to avoid
                    // leaking the wrapper and return the bare junction row.
                    const { [nestedKey]: _drop, ...rest } = rec;
                    return rest;
                }
                // Merge nested entity fields on top of join fields. Entity fields
                // (slug, icon, ...) win for keys that exist in both; join-only
                // fields (amenityId, isOptional, additionalCost) survive intact.
                const { [nestedKey]: _drop, ...joinFields } = rec;
                return { ...joinFields, ...(nested as Record<string, unknown>) };
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
 * Convenience wrapper around {@link flattenAccommodationJoinRelations} for use
 * in list/search lifecycle hooks. Applies the in-place flattening to every item
 * in a paginated result and returns the same array reference so the result
 * envelope can be spread without an extra allocation.
 *
 * @param items - List of accommodation entities (may be empty)
 * @returns The same array, with each entity's `amenities`/`features` flattened.
 */
export function flattenAccommodationJoinRelationsList<T extends Accommodation>(items: T[]): T[] {
    for (const item of items) {
        flattenAccommodationJoinRelations(item);
    }
    return items;
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
