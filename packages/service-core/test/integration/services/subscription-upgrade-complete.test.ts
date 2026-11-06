import {
    addonInstances,
    courtesyGrants,
    eq,
    promoRedemptions,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { activatePendingWithSignupNotice } from '../../../src/services/billing/subscription/activate-pending-with-signup-notice.js';
import { reissueDeferredCourtesy } from '../../../src/services/billing/subscription/reissue-deferred-courtesy.service.js';
import { createSuccessionCloser } from '../../../src/services/billing/subscription/succession-closer.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { closePorts } from './support/succession-close-fixtures.js';
import { s17Now, s17Ports } from './support/succession-s17-fixtures.js';
import { retireUpgradeCase, seedUpgradeCase } from './support/upgrade-complete-fixtures.js';

afterEach(retireUpgradeCase);
afterAll(closeServiceTestPool);

function postgresCode(error: unknown): { code?: string; constraint?: string } | undefined {
    const seen = new Set<object>();
    let current: unknown = error;
    while (current && typeof current === 'object' && !seen.has(current)) {
        seen.add(current);
        const value = current as { code?: unknown; constraint?: unknown; cause?: unknown };
        if (typeof value.code === 'string')
            return {
                code: value.code,
                constraint: typeof value.constraint === 'string' ? value.constraint : undefined
            };
        current = value.cause;
    }
    return undefined;
}

async function assertOriginRejected(
    userId: string,
    row: { planVersionId: string; billingOptionId: string }
) {
    let observed: unknown;
    try {
        await getServiceTestDb().transaction(async (outer) => {
            await outer.transaction(async (savepoint) => {
                await savepoint.insert(subscriptions).values({
                    userId,
                    vertical: 'accommodation',
                    planVersionId: row.planVersionId,
                    billingOptionId: row.billingOptionId,
                    paymentMethod: 'CARD',
                    class: 'PRINCIPAL',
                    status: 'ACTIVE'
                });
            });
        });
    } catch (error) {
        observed = postgresCode(error);
    }
    expect(observed).toEqual({ code: '23505', constraint: 'uq_subscription_commitment_origin' });
}

describe.skipIf(!isServiceTestDbAvailable())(
    'AC:B8b:11 upgrade completed through real acts',
    () => {
        it('(e,f) activates with S2, closes with S17/S18, then S9 reissues the same courtesy grant', async () => {
            const ids = await seedUpgradeCase();
            expect(
                await activatePendingWithSignupNotice(
                    { subscriptionId: ids.successorId, now: s17Now },
                    { successionCloser: createSuccessionCloser(closePorts) }
                )
            ).toBe(true);
            const before = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, ids.successorId));
            expect(before[0]?.status).toBe('ACTIVE');
            const closed = await (
                await import(
                    '../../../src/services/billing/subscription/cancel-succession-predecessor.service.js'
                )
            ).cancelSuccessionPredecessor(
                { successorSubscriptionId: ids.successorId },
                s17Ports(ids.provider, { deliver: true })
            );
            expect(closed.outcome).toBe('CANCELLED');
            const db = getServiceTestDb();
            const [predecessor] = await db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, ids.predecessorId));
            const [successor] = await db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, ids.successorId));
            const [addon] = await db
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, ids.addonId));
            const [redemption] = await db
                .select()
                .from(promoRedemptions)
                .where(eq(promoRedemptions.id, ids.redemptionId));
            const [grant] = await db
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, ids.grantId));
            expect(predecessor).toMatchObject({
                status: 'CANCELLED',
                succeededById: ids.successorId
            });
            expect(successor).toMatchObject({ status: 'ACTIVE', succeedsId: null });
            expect(addon?.targetId).toBe(ids.successorId);
            expect(redemption).toMatchObject({
                subscriptionId: ids.predecessorId,
                remainingCharges: 2
            });
            expect(grant).toMatchObject({
                subscriptionId: ids.predecessorId,
                balanceMonths: 3,
                balanceClosedAt: null
            });
            if (!successor?.planVersionId || !successor.billingOptionId)
                throw new Error('Successor billing choice missing');
            await assertOriginRejected(ids.userId, {
                planVersionId: successor.planVersionId,
                billingOptionId: successor.billingOptionId
            });
            const reissued = await reissueDeferredCourtesy(
                { successorSubscriptionId: ids.successorId },
                {
                    provider: ids.provider,
                    clock: closePorts.clock,
                    markPayments: closePorts.markPayments!,
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            expect(reissued.outcome).toBe('REISSUED');
            const [moved] = await db
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, ids.grantId));
            const [paused] = await db
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, ids.successorId));
            const pauses = await db
                .select()
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.subscriptionId, ids.successorId));
            expect(moved).toMatchObject({ subscriptionId: ids.successorId, balanceMonths: null });
            expect(paused?.status).toBe('PAUSED');
            expect(pauses).toMatchObject([{ reason: 'COURTESY', actualEndAt: null }]);
        });

        it('(h) leaves the living predecessor and succession untouched when notice delivery is pending', async () => {
            const ids = await seedUpgradeCase();
            await activatePendingWithSignupNotice({ subscriptionId: ids.successorId, now: s17Now });
            const result = await (
                await import(
                    '../../../src/services/billing/subscription/cancel-succession-predecessor.service.js'
                )
            ).cancelSuccessionPredecessor(
                { successorSubscriptionId: ids.successorId },
                s17Ports(ids.provider)
            );
            expect(result).toEqual({ outcome: 'DEFERRED', reason: 'NOTICE_PENDING' });
            const [predecessor] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, ids.predecessorId));
            const [successor] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, ids.successorId));
            expect(predecessor?.status).toBe('ACTIVE');
            expect(successor?.succeedsId).toBe(ids.predecessorId);
            if (!successor?.planVersionId || !successor.billingOptionId)
                throw new Error('Successor billing choice missing');
            await assertOriginRejected(ids.userId, {
                planVersionId: successor.planVersionId,
                billingOptionId: successor.billingOptionId
            });
        });

        it('(g) closes annual courtesy with the nonmonthly catalog reason', async () => {
            const ids = await seedUpgradeCase({ cycle: 'annual' });
            await activatePendingWithSignupNotice({ subscriptionId: ids.successorId, now: s17Now });
            const result = await (
                await import(
                    '../../../src/services/billing/subscription/cancel-succession-predecessor.service.js'
                )
            ).cancelSuccessionPredecessor(
                { successorSubscriptionId: ids.successorId },
                s17Ports(ids.provider, { deliver: true })
            );
            expect(result.outcome).toBe('CANCELLED');
            const [grant] = await getServiceTestDb()
                .select()
                .from(courtesyGrants)
                .where(eq(courtesyGrants.id, ids.grantId));
            expect(grant).toMatchObject({
                balanceMonths: 3,
                closeReason: 'DESTINO_DE_PLAN_NO_MENSUAL'
            });
            expect(
                await reissueDeferredCourtesy(
                    { successorSubscriptionId: ids.successorId },
                    {
                        provider: ids.provider,
                        clock: closePorts.clock,
                        markPayments: closePorts.markPayments!,
                        coverageNotices: { emitCoverageChanged: async () => undefined }
                    }
                )
            ).toMatchObject({ outcome: 'NOT_APPLICABLE', reason: 'NO_DEFERRED_COURTESY' });
        });
    }
);
