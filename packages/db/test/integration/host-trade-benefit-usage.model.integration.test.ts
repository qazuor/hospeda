/**
 * Integration tests for the HOS-376 benefit-usage and review models (T-018).
 *
 * Covers the four domain finders the usage service is built on, plus the
 * table wiring of the two review models.
 *
 * Each test wraps its writes in `withTestTransaction` so they are always
 * rolled back — no TRUNCATE overhead, parallel-safe via MVCC isolation.
 *
 * IMPORTANT: PostgreSQL's `now()` returns the TRANSACTION start time, so every
 * row inserted inside one `withTestTransaction` block shares an identical
 * `defaultNow()` timestamp. Any test that asserts ordering or a time window
 * must therefore set the relevant timestamp column EXPLICITLY in its fixture.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setDb } from '../../src/client.ts';
import { HostTradeBenefitUsageModel } from '../../src/models/hostTrade/host-trade-benefit-usage.model.ts';
import { HostTradeReviewModel } from '../../src/models/hostTrade/host-trade-review.model.ts';
import { HostTradeReviewReplyModel } from '../../src/models/hostTrade/host-trade-review-reply.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { hostTrades } from '../../src/schemas/host-trade/host_trade.dbschema.ts';
import { hostTradeBenefitUsages } from '../../src/schemas/host-trade/host_trade_benefit_usage.dbschema.ts';
import { hostTradeReviews } from '../../src/schemas/host-trade/host_trade_review.dbschema.ts';
import { hostTradeReviewReplies } from '../../src/schemas/host-trade/host_trade_review_reply.dbschema.ts';
import * as allSchemas from '../../src/schemas/index.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, testData, withTestTransaction } from './helpers.ts';

beforeAll(() => {
    setDb(getTestDb());
});

afterAll(async () => {
    await closeTestPool();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal `host_trades` row. `id`/`slug` randomised to avoid collisions. */
function tradeFixture(
    destinationId: string,
    overrides: Partial<typeof hostTrades.$inferInsert> = {}
): typeof hostTrades.$inferInsert {
    const uid = crypto.randomUUID().slice(0, 8);
    return {
        id: crypto.randomUUID(),
        slug: `trade-${uid}`,
        name: `Trade ${uid}`,
        category: 'PLOMERIA' as const,
        contact: '+54 999 000 001',
        benefit: '10% descuento',
        destinationId,
        is24h: false,
        isActive: true,
        ...overrides
    };
}

/**
 * Minimal `host_trade_benefit_usages` row.
 *
 * Defaults to the provider-declared PENDING shape (the QR-less path), since
 * that is the one every finder cares about most.
 */
function usageFixture(
    hostTradeId: string,
    hostUserId: string,
    overrides: Partial<typeof hostTradeBenefitUsages.$inferInsert> = {}
): typeof hostTradeBenefitUsages.$inferInsert {
    return {
        id: crypto.randomUUID(),
        hostTradeId,
        hostUserId,
        declaredBy: 'PROVIDER' as const,
        declaredById: hostUserId,
        creationChannel: 'LINKED_SELECTOR' as const,
        status: 'PENDING' as const,
        servicedAt: '2026-08-01',
        expiresAt: new Date(Date.now() + 30 * 86_400_000),
        ...overrides
    };
}

/**
 * Seeds a destination + provider + host user and returns their IDs.
 * Every finder test needs this same scaffolding.
 */
async function seedProviderAndHost(tx: DrizzleClient) {
    const owner = testData.user();
    const host = testData.user();
    const dest = testData.destination();
    await tx.insert(users).values([owner, host]);
    await tx.insert(destinations).values(dest);
    const trade = tradeFixture(dest.id, { ownerUserId: owner.id });
    await tx.insert(hostTrades).values(trade);
    return { ownerId: owner.id, hostId: host.id, tradeId: trade.id as string };
}

// ---------------------------------------------------------------------------
// findPendingForUser
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageModel.findPendingForUser', () => {
    const model = new HostTradeBenefitUsageModel();

    it('returns PENDING usages awaiting this host, newest first', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const older = usageFixture(tradeId, hostId, {
                createdAt: new Date('2026-07-01T00:00:00Z')
            });
            const newer = usageFixture(tradeId, hostId, {
                createdAt: new Date('2026-08-01T00:00:00Z')
            });
            // Two PENDING rows for the same pair would violate the partial
            // unique index, so the second one uses a second provider.
            const dest2 = testData.destination();
            await tx.insert(destinations).values(dest2);
            const trade2 = tradeFixture(dest2.id);
            await tx.insert(hostTrades).values(trade2);
            newer.hostTradeId = trade2.id as string;

            await tx.insert(hostTradeBenefitUsages).values([older, newer]);

            const results = await model.findPendingForUser(hostId, tx);

            expect(results.map((r) => r.id)).toEqual([newer.id, older.id]);
        });
    });

    it('excludes usages the host declared himself — they are not his to resolve', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            // Declared by the HOST via QR: the PROVIDER must confirm it, so it
            // must never light up the host's own pending counter (spec 6.6 —
            // the badge turns off by RESOLVING, and the host cannot resolve
            // his own declaration).
            const ownDeclaration = usageFixture(tradeId, hostId, {
                declaredBy: 'HOST',
                creationChannel: 'QR'
            });
            await tx.insert(hostTradeBenefitUsages).values(ownDeclaration);

            const results = await model.findPendingForUser(hostId, tx);

            expect(results.map((r) => r.id)).not.toContain(ownDeclaration.id);
        });
    });

    it('excludes CONFIRMED, REJECTED and EXPIRED usages', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const dest2 = testData.destination();
            const dest3 = testData.destination();
            await tx.insert(destinations).values([dest2, dest3]);
            const trade2 = tradeFixture(dest2.id);
            const trade3 = tradeFixture(dest3.id);
            await tx.insert(hostTrades).values([trade2, trade3]);

            const confirmed = usageFixture(tradeId, hostId, {
                status: 'CONFIRMED',
                confirmedAt: new Date(),
                confirmedById: hostId
            });
            const rejected = usageFixture(trade2.id as string, hostId, {
                status: 'REJECTED',
                rejectedAt: new Date(),
                rejectedById: hostId
            });
            const expired = usageFixture(trade3.id as string, hostId, { status: 'EXPIRED' });

            await tx.insert(hostTradeBenefitUsages).values([confirmed, rejected, expired]);

            const results = await model.findPendingForUser(hostId, tx);

            expect(results).toEqual([]);
        });
    });

    it('excludes soft-deleted rows', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const deleted = usageFixture(tradeId, hostId, { deletedAt: new Date() });
            await tx.insert(hostTradeBenefitUsages).values(deleted);

            const results = await model.findPendingForUser(hostId, tx);

            expect(results.map((r) => r.id)).not.toContain(deleted.id);
        });
    });

    it('returns [] for a user with no pending usages', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId } = await seedProviderAndHost(tx);
            const results = await model.findPendingForUser(hostId, tx);
            expect(results).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// findConfirmedPair
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageModel.findConfirmedPair', () => {
    const model = new HostTradeBenefitUsageModel();

    it('returns the confirmed usage backing the review gate', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const confirmed = usageFixture(tradeId, hostId, {
                status: 'CONFIRMED',
                confirmedAt: new Date('2026-07-15T00:00:00Z'),
                confirmedById: hostId
            });
            await tx.insert(hostTradeBenefitUsages).values(confirmed);

            const result = await model.findConfirmedPair(tradeId, hostId, tx);

            expect(result?.id).toBe(confirmed.id);
        });
    });

    it('returns the most recently confirmed usage when the pair has several', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const first = usageFixture(tradeId, hostId, {
                status: 'CONFIRMED',
                confirmedAt: new Date('2026-05-01T00:00:00Z'),
                confirmedById: hostId
            });
            const latest = usageFixture(tradeId, hostId, {
                status: 'CONFIRMED',
                confirmedAt: new Date('2026-07-01T00:00:00Z'),
                confirmedById: hostId
            });
            await tx.insert(hostTradeBenefitUsages).values([first, latest]);

            const result = await model.findConfirmedPair(tradeId, hostId, tx);

            expect(result?.id).toBe(latest.id);
        });
    });

    it('returns null when the pair only has PENDING, REJECTED or EXPIRED usages', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const pending = usageFixture(tradeId, hostId);
            const rejected = usageFixture(tradeId, hostId, {
                status: 'REJECTED',
                rejectedAt: new Date(),
                rejectedById: hostId
            });
            const expired = usageFixture(tradeId, hostId, { status: 'EXPIRED' });
            await tx.insert(hostTradeBenefitUsages).values([pending, rejected, expired]);

            const result = await model.findConfirmedPair(tradeId, hostId, tx);

            expect(result).toBeNull();
        });
    });

    it('does not leak another host confirmed usage with the same provider', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);
            const otherHost = testData.user();
            await tx.insert(users).values(otherHost);

            const otherConfirmed = usageFixture(tradeId, otherHost.id, {
                status: 'CONFIRMED',
                confirmedAt: new Date(),
                confirmedById: otherHost.id
            });
            await tx.insert(hostTradeBenefitUsages).values(otherConfirmed);

            const result = await model.findConfirmedPair(tradeId, hostId, tx);

            expect(result).toBeNull();
        });
    });

    it('excludes soft-deleted confirmed usages', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const deleted = usageFixture(tradeId, hostId, {
                status: 'CONFIRMED',
                confirmedAt: new Date(),
                confirmedById: hostId,
                deletedAt: new Date()
            });
            await tx.insert(hostTradeBenefitUsages).values(deleted);

            const result = await model.findConfirmedPair(tradeId, hostId, tx);

            expect(result).toBeNull();
        });
    });
});

// ---------------------------------------------------------------------------
// findLinkedHosts
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageModel.findLinkedHosts', () => {
    const model = new HostTradeBenefitUsageModel();

    it('returns distinct hosts with a confirmed usage, most recent first', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);
            const hostB = testData.user();
            await tx.insert(users).values(hostB);

            const olderHostUsage = usageFixture(tradeId, hostId, {
                status: 'CONFIRMED',
                confirmedAt: new Date('2026-05-01T00:00:00Z'),
                confirmedById: hostId
            });
            const newerHostBUsage = usageFixture(tradeId, hostB.id, {
                status: 'CONFIRMED',
                confirmedAt: new Date('2026-07-01T00:00:00Z'),
                confirmedById: hostB.id
            });
            await tx.insert(hostTradeBenefitUsages).values([olderHostUsage, newerHostBUsage]);

            const results = await model.findLinkedHosts(tradeId, tx);

            expect(results).toEqual([hostB.id, hostId]);
        });
    });

    it('deduplicates a host with several confirmed usages', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const first = usageFixture(tradeId, hostId, {
                status: 'CONFIRMED',
                confirmedAt: new Date('2026-05-01T00:00:00Z'),
                confirmedById: hostId
            });
            const second = usageFixture(tradeId, hostId, {
                status: 'CONFIRMED',
                confirmedAt: new Date('2026-06-01T00:00:00Z'),
                confirmedById: hostId
            });
            await tx.insert(hostTradeBenefitUsages).values([first, second]);

            const results = await model.findLinkedHosts(tradeId, tx);

            expect(results).toEqual([hostId]);
        });
    });

    it('excludes hosts whose only usages are PENDING or REJECTED', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);
            const rejectedHost = testData.user();
            await tx.insert(users).values(rejectedHost);

            const pending = usageFixture(tradeId, hostId);
            const rejected = usageFixture(tradeId, rejectedHost.id, {
                status: 'REJECTED',
                rejectedAt: new Date(),
                rejectedById: rejectedHost.id
            });
            await tx.insert(hostTradeBenefitUsages).values([pending, rejected]);

            const results = await model.findLinkedHosts(tradeId, tx);

            expect(results).toEqual([]);
        });
    });

    it('excludes soft-deleted usages', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const deleted = usageFixture(tradeId, hostId, {
                status: 'CONFIRMED',
                confirmedAt: new Date(),
                confirmedById: hostId,
                deletedAt: new Date()
            });
            await tx.insert(hostTradeBenefitUsages).values(deleted);

            const results = await model.findLinkedHosts(tradeId, tx);

            expect(results).toEqual([]);
        });
    });

    it('scopes to the provider — another provider confirmed hosts do not leak', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);
            const dest2 = testData.destination();
            await tx.insert(destinations).values(dest2);
            const otherTrade = tradeFixture(dest2.id);
            await tx.insert(hostTrades).values(otherTrade);

            const otherProviderUsage = usageFixture(otherTrade.id as string, hostId, {
                status: 'CONFIRMED',
                confirmedAt: new Date(),
                confirmedById: hostId
            });
            await tx.insert(hostTradeBenefitUsages).values(otherProviderUsage);

            const results = await model.findLinkedHosts(tradeId, tx);

            expect(results).toEqual([]);
        });
    });
});

// ---------------------------------------------------------------------------
// countRejectionsInWindow
// ---------------------------------------------------------------------------

describe('HostTradeBenefitUsageModel.countRejectionsInWindow', () => {
    const model = new HostTradeBenefitUsageModel();

    /** `n` days before now, as a Date. */
    function daysAgo(n: number): Date {
        return new Date(Date.now() - n * 86_400_000);
    }

    it('counts the provider rejected declarations inside the window', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);
            const hostB = testData.user();
            const hostC = testData.user();
            await tx.insert(users).values([hostB, hostC]);

            const rejections = [hostId, hostB.id, hostC.id].map((uid) =>
                usageFixture(tradeId, uid, {
                    status: 'REJECTED',
                    rejectedAt: daysAgo(10),
                    rejectedById: uid
                })
            );
            await tx.insert(hostTradeBenefitUsages).values(rejections);

            const count = await model.countRejectionsInWindow(tradeId, 90, tx);

            expect(count).toBe(3);
        });
    });

    it('excludes rejections older than the window', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const stale = usageFixture(tradeId, hostId, {
                status: 'REJECTED',
                rejectedAt: daysAgo(120),
                rejectedById: hostId
            });
            await tx.insert(hostTradeBenefitUsages).values(stale);

            const count = await model.countRejectionsInWindow(tradeId, 90, tx);

            expect(count).toBe(0);
        });
    });

    it('excludes rejections of host-declared usages — the provider was the rejector', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            // The HOST declared it and the PROVIDER rejected it. The suspension
            // threshold measures the provider declaring usages that hosts deny;
            // a provider exercising his own right to reject must never count
            // against him (spec 6.5).
            const providerRejectedIt = usageFixture(tradeId, hostId, {
                declaredBy: 'HOST',
                creationChannel: 'QR',
                status: 'REJECTED',
                rejectedAt: daysAgo(5),
                rejectedById: hostId
            });
            await tx.insert(hostTradeBenefitUsages).values(providerRejectedIt);

            const count = await model.countRejectionsInWindow(tradeId, 90, tx);

            expect(count).toBe(0);
        });
    });

    it('excludes non-REJECTED statuses and soft-deleted rows', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);
            const hostB = testData.user();
            await tx.insert(users).values(hostB);

            const expired = usageFixture(tradeId, hostId, { status: 'EXPIRED' });
            const deletedRejection = usageFixture(tradeId, hostB.id, {
                status: 'REJECTED',
                rejectedAt: daysAgo(5),
                rejectedById: hostB.id,
                deletedAt: new Date()
            });
            await tx.insert(hostTradeBenefitUsages).values([expired, deletedRejection]);

            const count = await model.countRejectionsInWindow(tradeId, 90, tx);

            expect(count).toBe(0);
        });
    });

    it('scopes to the provider — another provider rejections do not count', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);
            const dest2 = testData.destination();
            await tx.insert(destinations).values(dest2);
            const otherTrade = tradeFixture(dest2.id);
            await tx.insert(hostTrades).values(otherTrade);

            const otherRejection = usageFixture(otherTrade.id as string, hostId, {
                status: 'REJECTED',
                rejectedAt: daysAgo(5),
                rejectedById: hostId
            });
            await tx.insert(hostTradeBenefitUsages).values(otherRejection);

            const count = await model.countRejectionsInWindow(tradeId, 90, tx);

            expect(count).toBe(0);
        });
    });
});

// ---------------------------------------------------------------------------
// Review + reply model wiring
// ---------------------------------------------------------------------------

describe('HostTradeReviewModel', () => {
    const model = new HostTradeReviewModel();

    it('persists and reads back a review through BaseModelImpl', async () => {
        await withTestTransaction(async (tx) => {
            const { hostId, tradeId } = await seedProviderAndHost(tx);

            const review = {
                id: crypto.randomUUID(),
                hostTradeId: tradeId,
                hostUserId: hostId,
                overallRating: 4,
                respectedBenefit: true,
                content: 'Trabajo prolijo y puntual.'
            };
            await tx.insert(hostTradeReviews).values(review);

            const found = await model.findById(review.id, tx);

            expect(found?.id).toBe(review.id);
            expect(found?.overallRating).toBe(4);
            // Spec 6.4: the review is born APPROVED, unlike the reply.
            expect(found?.moderationState).toBe('APPROVED');
        });
    });
});

describe('HostTradeReviewReplyModel', () => {
    const model = new HostTradeReviewReplyModel();

    it('persists and reads back a reply through BaseModelImpl', async () => {
        await withTestTransaction(async (tx) => {
            const { ownerId, hostId, tradeId } = await seedProviderAndHost(tx);

            const review = {
                id: crypto.randomUUID(),
                hostTradeId: tradeId,
                hostUserId: hostId,
                overallRating: 2,
                respectedBenefit: false
            };
            await tx.insert(hostTradeReviews).values(review);

            const reply = {
                id: crypto.randomUUID(),
                reviewId: review.id,
                authorUserId: ownerId,
                content: 'Lamentamos la experiencia, nos comunicamos por privado.'
            };
            await tx.insert(hostTradeReviewReplies).values(reply);

            const found = await model.findById(reply.id, tx);

            expect(found?.id).toBe(reply.id);
            // Spec 6.4: the reply is born PENDING — doxxing risk.
            expect(found?.moderationState).toBe('PENDING');
        });
    });
});

// ---------------------------------------------------------------------------
// Static guard: getTableName() must match a real Drizzle schema export key
// ---------------------------------------------------------------------------

describe('model table-name wiring', () => {
    /**
     * `BaseModelImpl` resolves relational queries via `db.query[getTableName()]`,
     * so a name that is not an actual export key of the schema barrel fails only
     * at runtime, and only on the relational code path. This guard turns that
     * into a load-time failure.
     */
    it.each([
        ['HostTradeBenefitUsageModel', new HostTradeBenefitUsageModel()],
        ['HostTradeReviewModel', new HostTradeReviewModel()],
        ['HostTradeReviewReplyModel', new HostTradeReviewReplyModel()]
    ])('%s resolves to an exported schema key', (_name, model) => {
        const key = (model as unknown as { getTableName(): string }).getTableName();
        expect(Object.keys(allSchemas)).toContain(key);
    });
});
