/**
 * HOS-376 T-023 — the five denormalised `host_trades` aggregates, against a
 * real database.
 *
 * This suite is deliberately an INTEGRATION test rather than a unit test with
 * a mocked client. The whole substance of the recalculation is the aggregation
 * SQL — `count(distinct …)`, the `filter (where …)` clause, the moderation and
 * soft-delete predicates, the numeric(3,2) rounding. A mock would assert that
 * the query was built, which is exactly the part that cannot be wrong in an
 * interesting way.
 */
import type { DrizzleClient } from '@repo/db';
import {
    destinations,
    eq,
    hostTradeBenefitUsages,
    hostTradeReviews,
    hostTrades,
    users
} from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import {
    recalculateHostTradeAggregates,
    reconcileAllHostTradeAggregates
} from '../../../src/services/hostTrade/host-trade-aggregates';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

/** Inserts a user and returns its id. */
async function insertUser(tx: DrizzleClient): Promise<string> {
    const id = crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);
    await tx.insert(users).values({
        id,
        email: `ht-agg-${uid}@example.com`,
        displayName: 'Aggregate Test User',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);
    return id;
}

/** Inserts a destination + provider listing and returns the listing id. */
async function insertHostTrade(tx: DrizzleClient, ownerUserId: string): Promise<string> {
    const destinationId = crypto.randomUUID();
    const hostTradeId = crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(destinations).values({
        id: destinationId,
        slug: `ht-agg-dest-${uid}`,
        name: 'Aggregate Test Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/ht-agg/dest-${uid}`,
        summary: 'Aggregate destination summary',
        description: 'Aggregate destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/ht-agg-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);

    await tx.insert(hostTrades).values({
        id: hostTradeId,
        slug: `ht-agg-${uid}`,
        name: 'Aggregate Test Plumber',
        category: 'PLOMERIA',
        contact: '+54 9 3442 000000',
        benefit: '10% de descuento',
        destinationId,
        ownerUserId
    } as typeof hostTrades.$inferInsert);

    return hostTradeId;
}

/** Inserts one usage row. */
async function insertUsage(
    tx: DrizzleClient,
    options: {
        readonly hostTradeId: string;
        readonly hostUserId: string;
        readonly status?: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'EXPIRED';
        readonly deleted?: boolean;
    }
): Promise<void> {
    const status = options.status ?? 'CONFIRMED';
    // The extras-carril CHECK constraints (T-011) require the resolution
    // stamp to match the status, so a fixture cannot fake a bare CONFIRMED.
    const resolvedAt = new Date('2026-08-02T00:00:00Z');

    await tx.insert(hostTradeBenefitUsages).values({
        id: crypto.randomUUID(),
        hostTradeId: options.hostTradeId,
        hostUserId: options.hostUserId,
        declaredBy: 'HOST',
        declaredById: options.hostUserId,
        creationChannel: 'QR',
        status,
        servicedAt: '2026-08-01',
        expiresAt: new Date('2026-09-01T00:00:00Z'),
        confirmedAt: status === 'CONFIRMED' ? resolvedAt : null,
        confirmedById: status === 'CONFIRMED' ? options.hostUserId : null,
        rejectedAt: status === 'REJECTED' ? resolvedAt : null,
        rejectedById: status === 'REJECTED' ? options.hostUserId : null,
        deletedAt: options.deleted ? new Date('2026-08-05T00:00:00Z') : null
    } as typeof hostTradeBenefitUsages.$inferInsert);
}

/** Inserts one review row. */
async function insertReview(
    tx: DrizzleClient,
    options: {
        readonly hostTradeId: string;
        readonly hostUserId: string;
        readonly overallRating: number;
        readonly respectedBenefit?: boolean;
        readonly moderationState?: 'PENDING' | 'APPROVED' | 'REJECTED';
        readonly deleted?: boolean;
    }
): Promise<void> {
    await tx.insert(hostTradeReviews).values({
        id: crypto.randomUUID(),
        hostTradeId: options.hostTradeId,
        hostUserId: options.hostUserId,
        overallRating: options.overallRating,
        respectedBenefit: options.respectedBenefit ?? true,
        moderationState: options.moderationState ?? 'APPROVED',
        deletedAt: options.deleted ? new Date('2026-08-05T00:00:00Z') : null
    } as typeof hostTradeReviews.$inferInsert);
}

/** Reads the five denormalised columns back off the listing. */
async function readAggregates(tx: DrizzleClient, hostTradeId: string) {
    const [row] = await tx
        .select({
            confirmedUsesCount: hostTrades.confirmedUsesCount,
            distinctHostsCount: hostTrades.distinctHostsCount,
            reviewsCount: hostTrades.reviewsCount,
            averageRating: hostTrades.averageRating,
            benefitRespectedCount: hostTrades.benefitRespectedCount
        })
        .from(hostTrades)
        .where(eq(hostTrades.id, hostTradeId));
    return row;
}

afterAll(async () => {
    await closeServiceTestPool();
});

describe.skipIf(!dbAvailable)('recalculateHostTradeAggregates — usage counters', () => {
    /**
     * The case most easily implemented wrong: three visits by ONE host are
     * three usages but one client. `distinctHostsCount` is the anti-collusion
     * signal on the public card ("40 usos · 2 anfitriones" delata solo), so
     * counting rows instead of hosts would erase exactly what it exists for.
     */
    it('counts three confirmed usages from one host as 3 uses and 1 host', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const host = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            for (let i = 0; i < 3; i++) {
                await insertUsage(tx, { hostTradeId, hostUserId: host });
            }

            await recalculateHostTradeAggregates({ hostTradeId, tx });

            const row = await readAggregates(tx, hostTradeId);
            expect(row?.confirmedUsesCount).toBe(3);
            expect(row?.distinctHostsCount).toBe(1);
        });
    });

    it('counts usages from two hosts as 3 uses and 2 hosts', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const hostA = await insertUser(tx);
            const hostB = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertUsage(tx, { hostTradeId, hostUserId: hostA });
            await insertUsage(tx, { hostTradeId, hostUserId: hostA });
            await insertUsage(tx, { hostTradeId, hostUserId: hostB });

            await recalculateHostTradeAggregates({ hostTradeId, tx });

            const row = await readAggregates(tx, hostTradeId);
            expect(row?.confirmedUsesCount).toBe(3);
            expect(row?.distinctHostsCount).toBe(2);
        });
    });

    it.each(['PENDING', 'REJECTED', 'EXPIRED'] as const)('ignores a %s usage', async (status) => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const host = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertUsage(tx, { hostTradeId, hostUserId: host, status });

            await recalculateHostTradeAggregates({ hostTradeId, tx });

            const row = await readAggregates(tx, hostTradeId);
            expect(row?.confirmedUsesCount).toBe(0);
            expect(row?.distinctHostsCount).toBe(0);
        });
    });

    it('ignores a soft-deleted confirmed usage', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const host = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertUsage(tx, { hostTradeId, hostUserId: host });
            await insertUsage(tx, { hostTradeId, hostUserId: host, deleted: true });

            await recalculateHostTradeAggregates({ hostTradeId, tx });

            const row = await readAggregates(tx, hostTradeId);
            expect(row?.confirmedUsesCount).toBe(1);
        });
    });

    it('never counts another listing’s usages', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const host = await insertUser(tx);
            const mine = await insertHostTrade(tx, owner);
            const theirs = await insertHostTrade(tx, owner);

            await insertUsage(tx, { hostTradeId: theirs, hostUserId: host });

            await recalculateHostTradeAggregates({ hostTradeId: mine, tx });

            const row = await readAggregates(tx, mine);
            expect(row?.confirmedUsesCount).toBe(0);
        });
    });
});

describe.skipIf(!dbAvailable)('recalculateHostTradeAggregates — review counters', () => {
    it('averages only APPROVED reviews and counts the honoured benefit', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertReview(tx, {
                hostTradeId,
                hostUserId: await insertUser(tx),
                overallRating: 5,
                respectedBenefit: true
            });
            await insertReview(tx, {
                hostTradeId,
                hostUserId: await insertUser(tx),
                overallRating: 3,
                respectedBenefit: false
            });

            await recalculateHostTradeAggregates({ hostTradeId, tx });

            const row = await readAggregates(tx, hostTradeId);
            expect(row?.reviewsCount).toBe(2);
            expect(row?.averageRating).toBe(4);
            expect(row?.benefitRespectedCount).toBe(1);
        });
    });

    /** AC-19's other half: a held review is invisible to the public average. */
    it.each(['PENDING', 'REJECTED'] as const)('ignores a %s review', async (moderationState) => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertReview(tx, {
                hostTradeId,
                hostUserId: await insertUser(tx),
                overallRating: 5
            });
            await insertReview(tx, {
                hostTradeId,
                hostUserId: await insertUser(tx),
                overallRating: 1,
                moderationState
            });

            await recalculateHostTradeAggregates({ hostTradeId, tx });

            const row = await readAggregates(tx, hostTradeId);
            expect(row?.reviewsCount).toBe(1);
            expect(row?.averageRating).toBe(5);
        });
    });

    it('ignores a soft-deleted approved review', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertReview(tx, {
                hostTradeId,
                hostUserId: await insertUser(tx),
                overallRating: 4
            });
            await insertReview(tx, {
                hostTradeId,
                hostUserId: await insertUser(tx),
                overallRating: 1,
                deleted: true
            });

            await recalculateHostTradeAggregates({ hostTradeId, tx });

            const row = await readAggregates(tx, hostTradeId);
            expect(row?.reviewsCount).toBe(1);
            expect(row?.averageRating).toBe(4);
        });
    });

    /** `numeric(3,2)` — an average that does not fit would be a write error. */
    it('rounds the average to two decimals', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            for (const rating of [5, 4, 4]) {
                await insertReview(tx, {
                    hostTradeId,
                    hostUserId: await insertUser(tx),
                    overallRating: rating
                });
            }

            await recalculateHostTradeAggregates({ hostTradeId, tx });

            const row = await readAggregates(tx, hostTradeId);
            expect(row?.averageRating).toBe(4.33);
        });
    });

    /**
     * Zero, never null. The columns are NOT NULL with a 0 default, and a
     * provider whose only review was just rejected must fall back to "no
     * rating" rather than keep the stale one.
     */
    it('resets every counter to zero when nothing qualifies', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const host = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertUsage(tx, { hostTradeId, hostUserId: host });
            await insertReview(tx, { hostTradeId, hostUserId: host, overallRating: 5 });
            await recalculateHostTradeAggregates({ hostTradeId, tx });

            await tx
                .update(hostTradeReviews)
                .set({ moderationState: 'REJECTED' })
                .where(eq(hostTradeReviews.hostTradeId, hostTradeId));
            await tx
                .update(hostTradeBenefitUsages)
                .set({ status: 'REJECTED', rejectedAt: new Date('2026-08-06T00:00:00Z') })
                .where(eq(hostTradeBenefitUsages.hostTradeId, hostTradeId));

            await recalculateHostTradeAggregates({ hostTradeId, tx });

            const row = await readAggregates(tx, hostTradeId);
            expect(row).toEqual({
                confirmedUsesCount: 0,
                distinctHostsCount: 0,
                reviewsCount: 0,
                averageRating: 0,
                benefitRespectedCount: 0
            });
        });
    });
});

describe.skipIf(!dbAvailable)('recalculateHostTradeAggregates — return value', () => {
    it('returns what it wrote, so callers do not have to re-read the row', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const host = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertUsage(tx, { hostTradeId, hostUserId: host });
            await insertReview(tx, { hostTradeId, hostUserId: host, overallRating: 4 });

            const { aggregates } = await recalculateHostTradeAggregates({ hostTradeId, tx });

            expect(aggregates).toEqual(await readAggregates(tx, hostTradeId));
        });
    });
});

// ---------------------------------------------------------------------------
// The weekly backstop (T-044, AC-29)
// ---------------------------------------------------------------------------

/**
 * The reconciliation is the one path whose whole job is to find a number that
 * is ALREADY wrong, so it cannot be exercised by writing through the normal
 * flow — every write that moves a counter recomputes it. The stored value has
 * to be corrupted by hand, which is what these tests do.
 *
 * Its cron suite mocks this function entirely, so nothing above this layer has
 * ever seen it read, compare, or write.
 */
describe.skipIf(!dbAvailable)('reconcileAllHostTradeAggregates', () => {
    /** Writes a deliberately wrong counter straight onto the listing. */
    async function corruptStoredCount(
        tx: DrizzleClient,
        hostTradeId: string,
        confirmedUsesCount: number
    ): Promise<void> {
        await tx
            .update(hostTrades)
            .set({ confirmedUsesCount })
            .where(eq(hostTrades.id, hostTradeId));
    }

    it('corrects a counter that was tampered with, and reports what it changed', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const host = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertUsage(tx, { hostTradeId, hostUserId: host });
            await recalculateHostTradeAggregates({ hostTradeId, tx });
            await corruptStoredCount(tx, hostTradeId, 37);

            const { corrected } = await reconcileAllHostTradeAggregates({ tx });

            // AC-29 — the correction is only half of it. A run that silently
            // fixed the number would destroy the evidence that a write path has
            // a hole, which is the only reason this cron exists.
            const drift = corrected.find((d) => d.hostTradeId === hostTradeId);
            expect(drift).toBeDefined();
            expect(drift?.stored.confirmedUsesCount).toBe(37);
            expect(drift?.recomputed.confirmedUsesCount).toBe(1);

            expect((await readAggregates(tx, hostTradeId))?.confirmedUsesCount).toBe(1);
        });
    });

    it('reports nothing for a listing whose counters are already right', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const host = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertUsage(tx, { hostTradeId, hostUserId: host });
            await recalculateHostTradeAggregates({ hostTradeId, tx });

            const { corrected } = await reconcileAllHostTradeAggregates({ tx });

            expect(corrected.map((d) => d.hostTradeId)).not.toContain(hostTradeId);
        });
    });

    /**
     * `dryRun` is what lets the check be pointed at production to SEE the drift
     * before deciding to paper over it, so the promise it makes — reporting
     * without writing — is the whole feature. A dry run that corrected would be
     * indistinguishable from a real one until someone looked at the rows.
     */
    it('reports the drift without writing when asked to run dry', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const host = await insertUser(tx);
            const hostTradeId = await insertHostTrade(tx, owner);

            await insertUsage(tx, { hostTradeId, hostUserId: host });
            await recalculateHostTradeAggregates({ hostTradeId, tx });
            await corruptStoredCount(tx, hostTradeId, 37);

            const { corrected } = await reconcileAllHostTradeAggregates({ dryRun: true, tx });

            expect(corrected.find((d) => d.hostTradeId === hostTradeId)).toBeDefined();
            expect((await readAggregates(tx, hostTradeId))?.confirmedUsesCount).toBe(37);
        });
    });

    it('counts every listing it looked at, drifted or not', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await insertUser(tx);
            const first = await insertHostTrade(tx, owner);
            const second = await insertHostTrade(tx, owner);

            const { checked } = await reconcileAllHostTradeAggregates({ dryRun: true, tx });

            expect(checked).toBeGreaterThanOrEqual(2);
            expect([first, second]).toHaveLength(2);
        });
    });
});
