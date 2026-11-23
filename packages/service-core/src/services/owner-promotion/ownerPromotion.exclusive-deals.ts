/**
 * Accommodation slugs for the exclusive-deals list (owner decision 17, Mi
 * cuenta UI epic).
 *
 * The tourist's `/mi-cuenta/ofertas-exclusivas` renders each deal tied to one
 * accommodation as a real link to its public page, which is addressed by slug.
 * The list used to carry only the id, so the web resolved the slug with one
 * extra public read per click. The slugs are now read here, in ONE query for
 * the whole page.
 */

import type { AccommodationModel, DrizzleClient } from '@repo/db';
import { ownerPromotions } from '@repo/db/schemas';
import type { OwnerPromotion, TouristAudienceEnum } from '@repo/schemas';
import { inArray, type SQL } from 'drizzle-orm';

/**
 * Builds the SQL condition that scopes results to the given tourist audience
 * tiers (HOS-21 D1). `scope` is additive — pass `['plus', 'vip']` for a vip
 * caller so they see both tiers, or `['plus']` alone for plus.
 *
 * @param params - The server-computed `scope`.
 * @returns The `touristAudience IN (...)` condition.
 */
export function buildTouristAudienceCondition({
    scope
}: {
    readonly scope: readonly TouristAudienceEnum[];
}): SQL {
    return inArray(ownerPromotions.touristAudience, [...scope]);
}

/** An exclusive deal with the public slug of the accommodation it targets. */
export type OwnerPromotionWithAccommodationSlug = OwnerPromotion & {
    /** `null` for an owner-wide deal, or when the accommodation is not public. */
    readonly accommodationSlug: string | null;
};

/** Input of {@link attachAccommodationSlugs}. RO-RO. */
export interface AttachAccommodationSlugsInput {
    readonly items: readonly OwnerPromotion[];
    readonly accommodationModel: Pick<AccommodationModel, 'findByIds'>;
    readonly tx?: DrizzleClient;
}

/**
 * The accommodation a promotion targets. Dual read (HOS-2270, release N): the
 * target is `entityId`, falling back to the legacy `accommodationId`.
 *
 * @param params - The `promotion`.
 * @returns The accommodation id, or `null` for an owner-wide promotion.
 */
function targetAccommodationId({
    promotion
}: {
    readonly promotion: OwnerPromotion;
}): string | null {
    return promotion.entityId ?? promotion.accommodationId ?? null;
}

/**
 * Adds `accommodationSlug` to every deal. A slug is given only for an
 * accommodation that is still public (`PUBLISHED`, not soft-deleted): a link
 * to anything else would land on a 404.
 *
 * @param input - See {@link AttachAccommodationSlugsInput}.
 * @returns The same deals, in order, each with its `accommodationSlug`.
 */
export async function attachAccommodationSlugs({
    items,
    accommodationModel,
    tx
}: AttachAccommodationSlugsInput): Promise<OwnerPromotionWithAccommodationSlug[]> {
    const ids = [
        ...new Set(
            items
                .map((promotion) => targetAccommodationId({ promotion }))
                .filter((id): id is string => id !== null)
        )
    ];
    if (ids.length === 0)
        return items.map((promotion) => ({ ...promotion, accommodationSlug: null }));
    const accommodations = await accommodationModel.findByIds(ids, tx);
    const slugById = new Map(
        accommodations
            .filter((row) => row.publicationStatus === 'PUBLISHED' && !row.deletedAt)
            .map((row) => [row.id, row.slug] as const)
    );
    return items.map((promotion) => {
        const id = targetAccommodationId({ promotion });
        return { ...promotion, accommodationSlug: id ? (slugById.get(id) ?? null) : null };
    });
}

/** Input of {@link withAccommodationSlugs}. RO-RO. */
export interface WithAccommodationSlugsInput {
    /** The pending page read of exclusive deals. */
    readonly found: Promise<{ readonly items: OwnerPromotion[]; readonly total: number }>;
    readonly accommodationModel: Pick<AccommodationModel, 'findByIds'>;
}

/**
 * Awaits a page of exclusive deals and attaches their accommodation slugs.
 *
 * @param input - See {@link WithAccommodationSlugsInput}.
 * @returns The page, its deals carrying `accommodationSlug`.
 */
export async function withAccommodationSlugs({
    found,
    accommodationModel
}: WithAccommodationSlugsInput): Promise<{
    items: OwnerPromotionWithAccommodationSlug[];
    total: number;
}> {
    const { items, total } = await found;
    return { items: await attachAccommodationSlugs({ items, accommodationModel }), total };
}
