import { accommodations, getDb } from '@repo/db';
import { and, asc, desc, notInArray } from 'drizzle-orm';
import { eligibleAccommodationPredicate } from '../eligible-accommodation.predicate.js';
import type { SourceResolverInput } from './source.types.js';

/** Rank eligible accommodations by rating, review count, then ID. */
export async function topRatedSource(input: SourceResolverInput): Promise<readonly string[]> {
    if (input.limit <= 0) return [];
    const rows = await (input.ctx?.tx ?? getDb())
        .select({ id: accommodations.id })
        .from(accommodations)
        .where(
            and(
                eligibleAccommodationPredicate(input),
                input.excludeIds.length
                    ? notInArray(accommodations.id, [...input.excludeIds])
                    : undefined
            )
        )
        .orderBy(
            desc(accommodations.averageRating),
            desc(accommodations.reviewsCount),
            asc(accommodations.id)
        )
        .limit(input.limit);
    return rows.map(({ id }) => id);
}
