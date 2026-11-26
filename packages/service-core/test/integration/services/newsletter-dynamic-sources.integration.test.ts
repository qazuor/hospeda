import type { DrizzleClient } from '@repo/db';
import { accommodationMedia, accommodations, entityViews } from '@repo/db';
import type { DynamicBlockConfig } from '@repo/schemas';
import {
    applyDynamicBlockDefaults,
    NewsletterDynamicEntityTypeEnum,
    NewsletterDynamicSourceEnum,
    PublicationStatusEnum
} from '@repo/schemas';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { DrizzleDynamicSource } from '../../../src/services/newsletter/dynamic/drizzle-dynamic-source.js';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    seedAccommodation,
    withServiceTestTransaction
} from './helpers.js';

const now = new Date('2026-11-26T12:00:00Z');
const run = it.skipIf(!isServiceTestDbAvailable());

function config(
    input: {
        readonly source?: NewsletterDynamicSourceEnum;
        readonly params?: DynamicBlockConfig['params'];
    } = {}
) {
    return applyDynamicBlockDefaults({
        dynamicBlockCount: 1,
        config: {
            blockKey: 'integration-block',
            entityType: NewsletterDynamicEntityTypeEnum.ACCOMMODATION,
            source: input.source ?? NewsletterDynamicSourceEnum.NEWEST,
            count: 3,
            params: input.params
        }
    });
}

function port(input: { readonly tx: DrizzleClient }) {
    return new DrizzleDynamicSource({
        siteUrl: 'https://newsletter.example.test/',
        ctx: { tx: input.tx }
    });
}

async function fixtures(input: { readonly tx: DrizzleClient }) {
    const first = await seedAccommodation(input.tx);
    const second = await seedAccommodation(input.tx);
    const third = await seedAccommodation(input.tx);
    const ids = [first.accommodationId, second.accommodationId, third.accommodationId].sort();
    await input.tx
        .update(accommodations)
        .set({ destinationId: first.destinationId, createdAt: now })
        .where(inArray(accommodations.id, ids));
    return { ids, destinationId: first.destinationId };
}

describe('newsletter dynamic sources against PostgreSQL', () => {
    afterAll(closeServiceTestPool);

    run(
        'newest orders by creation date and ID, applies destination, exclusions and limit',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ids, destinationId } = await fixtures({ tx });
                const source = port({ tx });
                const block = config({ params: { destinationId } });
                expect(
                    await source.fetchCandidates({ block, now, excludeIds: [], limit: 3 })
                ).toEqual(ids);
                await tx
                    .update(accommodations)
                    .set({ createdAt: new Date(now.getTime() + 1000) })
                    .where(eq(accommodations.id, ids[2]!));
                expect(
                    await source.fetchCandidates({ block, now, excludeIds: [ids[0]!], limit: 1 })
                ).toEqual([ids[2]]);
                expect(
                    await source.fetchCandidates({
                        block: config({ params: { destinationId: crypto.randomUUID() } }),
                        now,
                        excludeIds: [],
                        limit: 3
                    })
                ).toEqual([]);
            });
        }
    );

    run(
        'most_viewed counts only accommodation views within the configured window (AC-F1-4)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ids, destinationId } = await fixtures({ tx });
                for (const [index, total] of [10, 5, 20].entries()) {
                    await tx.insert(entityViews).values(
                        Array.from({ length: total }, (_, i) => ({
                            entityType: 'ACCOMMODATION' as const,
                            entityId: ids[index]!,
                            visitorHash: `viewer-${index}-${i}`,
                            viewedAt: new Date(now.getTime() - (index === 2 ? 40 : 7) * 86_400_000)
                        }))
                    );
                }
                await tx.insert(entityViews).values(
                    Array.from({ length: 30 }, (_, i) => ({
                        entityType: 'POST' as const,
                        entityId: ids[2]!,
                        visitorHash: `post-${i}`,
                        viewedAt: now
                    }))
                );
                const source = port({ tx });
                const block = config({
                    source: NewsletterDynamicSourceEnum.MOST_VIEWED,
                    params: { destinationId, windowDays: 30 }
                });
                expect(
                    await source.fetchCandidates({ block, now, excludeIds: [], limit: 2 })
                ).toEqual(ids.slice(0, 2));
                expect(
                    await source.fetchCandidates({
                        block: { ...block, params: { destinationId, windowDays: 1 } },
                        now,
                        excludeIds: [],
                        limit: 3
                    })
                ).toEqual(ids);
            });
        }
    );

    run(
        'most_viewed includes the exact window boundary and breaks positive-count ties by ID',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { ids, destinationId } = await fixtures({ tx });
                await tx.insert(entityViews).values(
                    ids.map((entityId) => ({
                        entityType: 'ACCOMMODATION' as const,
                        entityId,
                        visitorHash: entityId,
                        viewedAt: new Date(now.getTime() - 30 * 86_400_000)
                    }))
                );
                const source = port({ tx });
                const block = config({
                    source: NewsletterDynamicSourceEnum.MOST_VIEWED,
                    params: { destinationId }
                });
                expect(
                    await source.fetchCandidates({ block, now, excludeIds: [], limit: 3 })
                ).toEqual(ids);
                expect(
                    await source.fetchCandidates({ block, now, excludeIds: [ids[0]!], limit: 1 })
                ).toEqual([ids[1]]);
            });
        }
    );

    run('top_rated filters minReviews and orders by rating, reviews, ID (AC-F1-6)', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { ids, destinationId } = await fixtures({ tx });
            await tx
                .update(accommodations)
                .set({ averageRating: 4.5, reviewsCount: 10 })
                .where(inArray(accommodations.id, ids));
            await tx
                .update(accommodations)
                .set({ averageRating: 5, reviewsCount: 2 })
                .where(eq(accommodations.id, ids[0]!));
            const source = port({ tx });
            const block = config({
                source: NewsletterDynamicSourceEnum.TOP_RATED,
                params: { destinationId }
            });
            expect(await source.fetchCandidates({ block, now, excludeIds: [], limit: 3 })).toEqual(
                ids.slice(1)
            );
            expect(await source.revalidate({ block, ids, now })).toEqual({
                validIds: ids.slice(1),
                dropped: [{ id: ids[0], reason: 'below_min_reviews' }]
            });
            await tx
                .update(accommodations)
                .set({ reviewsCount: 11 })
                .where(eq(accommodations.id, ids[2]!));
            expect(await source.fetchCandidates({ block, now, excludeIds: [], limit: 3 })).toEqual([
                ids[2],
                ids[1]
            ]);
            expect(
                await source.fetchCandidates({
                    block: { ...block, params: { destinationId, minReviews: 11 } },
                    now,
                    excludeIds: [],
                    limit: 3
                })
            ).toEqual([ids[2]]);
        });
    });

    run('all sources and revalidation reject unpublished and deleted accommodations', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { ids, destinationId } = await fixtures({ tx });
            await tx
                .update(accommodations)
                .set({ reviewsCount: 10 })
                .where(inArray(accommodations.id, ids));
            await tx
                .update(accommodations)
                .set({ publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING })
                .where(eq(accommodations.id, ids[0]!));
            await tx
                .update(accommodations)
                .set({ deletedAt: now })
                .where(eq(accommodations.id, ids[1]!));
            const source = port({ tx });
            for (const value of [
                NewsletterDynamicSourceEnum.NEWEST,
                NewsletterDynamicSourceEnum.MOST_VIEWED,
                NewsletterDynamicSourceEnum.TOP_RATED
            ]) {
                const block = config({ source: value, params: { destinationId } });
                expect(
                    await source.fetchCandidates({ block, now, excludeIds: [], limit: 3 })
                ).toEqual([ids[2]]);
                expect(await source.revalidate({ block, ids, now })).toEqual({
                    validIds: [ids[2]],
                    dropped: [
                        { id: ids[0], reason: 'not_published' },
                        { id: ids[1], reason: 'deleted' }
                    ]
                });
            }
            const missing = crypto.randomUUID();
            expect(
                await source.revalidate({
                    block: config({ params: { destinationId: crypto.randomUUID() } }),
                    ids: [ids[2]!, missing],
                    now
                })
            ).toEqual({
                validIds: [],
                dropped: [
                    { id: ids[2], reason: 'destination_mismatch' },
                    { id: missing, reason: 'deleted' }
                ]
            });
        });
    });

    run(
        'cards use localized text with Spanish fallback, featured media and the injected origin (AC-F1-14)',
        async () => {
            await withServiceTestTransaction(async (tx) => {
                const { accommodationId: id } = await seedAccommodation(tx);
                await tx
                    .update(accommodations)
                    .set({
                        slug: 'hotel-test',
                        name: 'Nombre español',
                        summary: 'Resumen español',
                        nameI18n: { es: '', en: '', pt: 'Nome' },
                        summaryI18n: { es: '', en: 'English summary', pt: ' ' }
                    })
                    .where(eq(accommodations.id, id));
                await tx.insert(accommodationMedia).values({
                    accommodationId: id,
                    url: 'https://images.example.test/cover.jpg',
                    publicId: 'test-cover',
                    isFeatured: true,
                    sortOrder: 0
                });
                const source = port({ tx });
                const cards = await source.loadCards({ ids: [id], locales: ['es', 'en', 'pt'] });
                expect(cards.get(id)?.en).toEqual({
                    name: 'Nombre español',
                    summary: 'English summary',
                    imageUrl: 'https://images.example.test/cover.jpg',
                    url: 'https://newsletter.example.test/en/alojamientos/hotel-test/'
                });
                expect(cards.get(id)?.pt).toMatchObject({
                    name: 'Nome',
                    summary: 'Resumen español'
                });
                expect(cards.get(id)?.es).toMatchObject({
                    name: 'Nombre español',
                    summary: 'Resumen español'
                });
                await tx
                    .update(accommodationMedia)
                    .set({ url: 'http://images.example.test/cover.jpg' })
                    .where(eq(accommodationMedia.accommodationId, id));
                expect(
                    (await source.loadCards({ ids: [id], locales: ['en'] })).get(id)?.en?.imageUrl
                ).toBeNull();
                await tx
                    .update(accommodationMedia)
                    .set({ url: 'https://images.example.test/cover.jpg', deletedAt: now })
                    .where(eq(accommodationMedia.accommodationId, id));
                expect(
                    (await source.loadCards({ ids: [id], locales: ['en'] })).get(id)?.en?.imageUrl
                ).toBeNull();
            });
        }
    );

    run('empty requests return empty collections', async () => {
        await withServiceTestTransaction(async (tx) => {
            const source = port({ tx });
            expect(
                await source.fetchCandidates({ block: config(), now, excludeIds: [], limit: 0 })
            ).toEqual([]);
            expect(await source.revalidate({ block: config(), ids: [], now })).toEqual({
                validIds: [],
                dropped: []
            });
            expect(await source.loadCards({ ids: [], locales: ['en'] })).toEqual(new Map());
        });
    });
});
