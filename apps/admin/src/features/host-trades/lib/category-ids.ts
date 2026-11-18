/**
 * @file category-ids.ts
 * @description Bridges the host-trade read shape and the category picker
 * (HOS-919 T-045).
 *
 * The read API returns `categories: [{ id, slug, nameI18n, groupSlug }]`, while
 * the form field is keyed `categoryIds` (the write shape). The form prefills
 * from `entity[field.id]`, so the read entity is given a `categoryIds` before
 * it reaches the form.
 */

/**
 * Adds `categoryIds` to a host-trade read entity.
 *
 * An existing `categoryIds` wins, so values already in the form (for instance
 * after a failed save) are not overwritten by the server copy.
 *
 * @param input - Object with the entity as read from the API.
 * @returns The entity with `categoryIds` set.
 */
export function withCategoryIds<
    T extends Record<string, unknown> & {
        readonly categories?: ReadonlyArray<{ readonly id: string }> | null;
        readonly categoryIds?: readonly string[];
    }
>({ entity }: { readonly entity: T }): T & { readonly categoryIds: readonly string[] } {
    return {
        ...entity,
        categoryIds: entity.categoryIds ?? (entity.categories ?? []).map((category) => category.id)
    };
}
