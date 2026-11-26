import { accommodations, entityViews, getDb } from '@repo/db';
import { EntityTypeEnum } from '@repo/schemas';
import { and, asc, count, desc, eq, gte, notInArray } from 'drizzle-orm';
import { eligibleAccommodationPredicate } from '../eligible-accommodation.predicate.js';
import type { SourceResolverInput } from './source.types.js';

/** Count views in the injected clock's window, preserving zero-view candidates. */
export async function mostViewedSource(input: SourceResolverInput): Promise<readonly string[]> {
    if (input.limit <= 0) return [];
    const since = new Date(
        input.now.getTime() - (input.block.params.windowDays ?? 30) * 86_400_000
    );
    const rows = await (input.ctx?.tx ?? getDb())
        .select({ id: accommodations.id })
        .from(accommodations)
        .leftJoin(
            entityViews,
            and(
                eq(entityViews.entityType, EntityTypeEnum.ACCOMMODATION),
                eq(entityViews.entityId, accommodations.id),
                gte(entityViews.viewedAt, since)
            )
        )
        .where(
            and(
                eligibleAccommodationPredicate(input),
                input.excludeIds.length
                    ? notInArray(accommodations.id, [...input.excludeIds])
                    : undefined
            )
        )
        .groupBy(accommodations.id)
        .orderBy(desc(count(entityViews.id)), asc(accommodations.id))
        .limit(input.limit);
    return rows.map(({ id }) => id);
}
