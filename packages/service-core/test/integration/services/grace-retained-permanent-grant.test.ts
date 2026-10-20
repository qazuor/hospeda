import { type DrizzleClient, eq, successionRetainedPayments } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { permanentGrantRetentionRelease } from '../../../src/services/billing/subscription/succession-permanent-grant.js';
import { releaseRetainedPayment } from '../../../src/services/billing/subscription/succession-retained-payment.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    openMarksOf,
    paymentFor,
    predecessorInGrace,
    refundsOf,
    retentionsOf,
    retireSuccessionCases,
    type SeededSuccession,
    subscriptionRow
} from './support/succession-retention-fixtures.js';

afterAll(closeServiceTestPool);

const seeded: SeededSuccession[] = [];

/** Retentions first, then marks, outbox and rows (HOS-1561): nothing open outlives a case. */
afterEach(async () => {
    await retireSuccessionCases(seeded.splice(0));
});

type Case = Awaited<ReturnType<typeof predecessorInGrace>>;

/** A predecessor in grace whose recycled quota S19 retained, with its live successor. */
async function retainingPredecessor(): Promise<{
    s: Case;
    paymentId: string;
    retentionId: string;
}> {
    const s = await predecessorInGrace({ approveOnAttempt: 2 });
    seeded.push(s.seeded);
    s.fixture.advanceToAttempt(2);
    const retained = await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);
    expect(retained).toMatchObject({ exit: { outcome: 'RETAINED_FOR_S19' } });
    const payment = await paymentFor(s.fixture.chargeId);
    const [retention] = await retentionsOf(s.subscriptionId);
    if (!retention) throw new Error('S19 retention missing');
    expect(retention).toMatchObject({ releasedAt: null, releaseReason: null });
    return { s, paymentId: payment.id, retentionId: retention.id };
}

/** Calls the branch 4 interface the way S13 does: inside the caller's transaction. */
async function releaseInTransaction(subscriptionIds: readonly string[], now: Date) {
    return getServiceTestDb().transaction(async (tx) =>
        permanentGrantRetentionRelease.releaseOnPermanentGrant({ subscriptionIds, now, tx })
    );
}

describe('TEST:B7:16 — branch 4: the interface S13 calls turns the S19 flag off without refund (AC:B7:26)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'a — over predecessor and successor: the retention closes PERMANENT_GRANT at the act instant, no refund, no mark, no status change',
        async () => {
            // Arrange
            const { s, paymentId, retentionId } = await retainingPredecessor();
            const now = s.fixture.clock.now();

            // Act
            const result = await releaseInTransaction([s.subscriptionId, s.successor.id], now);

            // Assert
            expect(result).toEqual({ releasedRetentionIds: [retentionId] });
            const retentions = await retentionsOf(s.subscriptionId);
            expect(retentions).toHaveLength(1);
            expect(retentions[0]).toMatchObject({
                id: retentionId,
                paymentId,
                releasedAt: now,
                releaseReason: 'PERMANENT_GRANT'
            });
            expect(await refundsOf(paymentId)).toHaveLength(0);
            expect((await paymentFor(s.fixture.chargeId)).status).toBe('SUCCEEDED');
            expect(await openMarksOf(s.subscriptionId)).toHaveLength(0);
            expect(await openMarksOf(s.successor.id)).toHaveLength(0);
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('GRACE_PERIOD');
            expect((await subscriptionRow(s.successor.id)).status).toBe('PENDING_AUTHORIZATION');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'b — in the act: inside the caller transaction the flag is already off, outside it is still open',
        async () => {
            // Arrange
            const { s, retentionId } = await retainingPredecessor();
            const now = s.fixture.clock.now();
            const readRetention = async (db: DrizzleClient) => {
                const [row] = await db
                    .select()
                    .from(successionRetainedPayments)
                    .where(eq(successionRetainedPayments.id, retentionId));
                return row;
            };

            // Act
            const seen = await getServiceTestDb().transaction(async (tx) => {
                await permanentGrantRetentionRelease.releaseOnPermanentGrant({
                    subscriptionIds: [s.subscriptionId, s.successor.id],
                    now,
                    tx
                });
                return {
                    inTx: await readRetention(tx),
                    outside: await readRetention(getServiceTestDb())
                };
            });

            // Assert
            expect(seen.inTx).toMatchObject({ releasedAt: now, releaseReason: 'PERMANENT_GRANT' });
            expect(seen.outside).toMatchObject({ releasedAt: null, releaseReason: null });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'c — when the caller transaction fails after the call, the retention stays open and without reason',
        async () => {
            // Arrange
            const { s } = await retainingPredecessor();
            const now = s.fixture.clock.now();

            // Act
            const act = getServiceTestDb().transaction(async (tx) => {
                await permanentGrantRetentionRelease.releaseOnPermanentGrant({
                    subscriptionIds: [s.subscriptionId, s.successor.id],
                    now,
                    tx
                });
                throw new Error('S13 failed after the release');
            });

            // Assert
            await expect(act).rejects.toThrow('S13 failed after the release');
            const retentions = await retentionsOf(s.subscriptionId);
            expect(retentions).toHaveLength(1);
            expect(retentions[0]).toMatchObject({ releasedAt: null, releaseReason: null });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — idempotent: a second call releases nothing and keeps the first close',
        async () => {
            // Arrange
            const { s } = await retainingPredecessor();
            const rows = [s.subscriptionId, s.successor.id];
            const first = s.fixture.clock.now();
            await releaseInTransaction(rows, first);
            const later = new Date(first.getTime() + 60_000);

            // Act
            const second = await releaseInTransaction(rows, later);

            // Assert
            expect(second).toEqual({ releasedRetentionIds: [] });
            const [retention] = await retentionsOf(s.subscriptionId);
            expect(retention).toMatchObject({
                releasedAt: first,
                releaseReason: 'PERMANENT_GRANT'
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'd — a retention another branch already closed keeps its REEVALUATED reason',
        async () => {
            // Arrange
            const { s, paymentId } = await retainingPredecessor();
            const closedAt = s.fixture.clock.now();
            await getServiceTestDb().transaction(async (tx) =>
                releaseRetainedPayment({ paymentId, reason: 'REEVALUATED', now: closedAt, tx })
            );

            // Act
            const result = await releaseInTransaction(
                [s.subscriptionId, s.successor.id],
                new Date(closedAt.getTime() + 60_000)
            );

            // Assert
            expect(result).toEqual({ releasedRetentionIds: [] });
            const [retention] = await retentionsOf(s.subscriptionId);
            expect(retention).toMatchObject({ releasedAt: closedAt, releaseReason: 'REEVALUATED' });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'e — scope: releasing the rows of one succession leaves the retention of another open',
        async () => {
            // Arrange
            const first = await retainingPredecessor();
            const second = await retainingPredecessor();

            // Act
            const result = await releaseInTransaction(
                [first.s.subscriptionId, first.s.successor.id],
                first.s.fixture.clock.now()
            );

            // Assert
            expect(result).toEqual({ releasedRetentionIds: [first.retentionId] });
            const [untouched] = await retentionsOf(second.s.subscriptionId);
            expect(untouched).toMatchObject({
                id: second.retentionId,
                releasedAt: null,
                releaseReason: null
            });
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'f — an empty list releases nothing and touches no retention',
        async () => {
            // Arrange
            const { s } = await retainingPredecessor();

            // Act
            const result = await releaseInTransaction([], s.fixture.clock.now());

            // Assert
            expect(result).toEqual({ releasedRetentionIds: [] });
            const [retention] = await retentionsOf(s.subscriptionId);
            expect(retention).toMatchObject({ releasedAt: null, releaseReason: null });
        }
    );
});
