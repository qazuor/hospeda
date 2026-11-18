import type { DrizzleClient, PartnerTypeModel } from '@repo/db';
import { type PartnerPublicType, PartnerTypeEnum, type PartnerTypeRef } from '@repo/schemas';

/**
 * Helpers shared by every partner write and read that touches the type
 * catalog (HOS-2336): the release-N dual-write of the legacy enum column and
 * the read-side hydration of the type row.
 */

/** Legacy `partner_type_enum` values, which are also their catalog slugs. */
const LEGACY_PARTNER_TYPE_VALUES: ReadonlySet<string> = new Set(Object.values(PartnerTypeEnum));

/**
 * Maps a catalog slug to the legacy enum value dual-written to
 * `partners.type` during release N.
 *
 * The three legacy values are their own slugs (`business`, `ngo`,
 * `institution`). Any other slug (`media`, `person`, an admin-made type) has no
 * legacy value and is stored as `NULL`, which is why release N made the column
 * nullable.
 *
 * @param input.slug - Catalog slug.
 * @returns The legacy enum value, or `null`.
 *
 * @example
 * ```ts
 * legacyPartnerTypeFor({ slug: 'ngo' }); // 'ngo'
 * legacyPartnerTypeFor({ slug: 'media' }); // null
 * ```
 */
export function legacyPartnerTypeFor(input: { readonly slug: string }): PartnerTypeEnum | null {
    return LEGACY_PARTNER_TYPE_VALUES.has(input.slug) ? (input.slug as PartnerTypeEnum) : null;
}

/**
 * Reduces a type ref to the public shape (spec D5): slug, the Spanish name as
 * `name` and every locale in `nameI18n`.
 *
 * @param input.ref - The hydrated type, or `null`/`undefined`.
 * @returns The public type, or `null` when the partner has no type yet.
 */
export function toPartnerPublicType(input: {
    readonly ref: PartnerTypeRef | null | undefined;
}): PartnerPublicType | null {
    const { ref } = input;
    if (!ref) return null;
    return { slug: ref.slug, name: ref.nameI18n.es, nameI18n: ref.nameI18n };
}

/**
 * Attaches `partnerType` (the catalog ref) to each partner in ONE batched
 * query, whatever the type's state: a partner keeps its type after the type is
 * deactivated or deleted (AC-5.3). Partners without `typeId` get `null`.
 *
 * @param input.items - Partners (or partner-shaped rows) carrying `typeId`.
 * @param input.model - The partner type model.
 * @param input.tx - Optional transaction client.
 * @returns New objects with `partnerType` set; input order is preserved.
 */
export async function hydratePartnerTypeRefs<T extends { readonly typeId?: string | null }>(input: {
    readonly items: readonly T[];
    readonly model: PartnerTypeModel;
    readonly tx?: DrizzleClient;
}): Promise<Array<T & { partnerType: PartnerTypeRef | null }>> {
    const ids = input.items.flatMap((item) => (item.typeId ? [item.typeId] : []));
    const refs = await input.model.findRefsByIds(ids, input.tx);
    return input.items.map((item) => ({
        ...item,
        partnerType: item.typeId ? (refs.get(item.typeId) ?? null) : null
    }));
}
