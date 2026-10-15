import { emailOutbox, eq, planCatalogModel, subscriptions } from '@repo/db';
import { createPlanCatalogInverse } from '@repo/verticals';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { graceFixture } from './support/grace-fixtures.js';

const DAY_MS = 86_400_000;
const seeded: { subscriptionId: string; userId: string }[] = [];
afterAll(closeServiceTestPool);
afterEach(async () => {
    const cases = seeded.splice(0);
    if (cases.length === 0) return;
    for (const value of cases) {
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(eq(subscriptions.id, value.subscriptionId));
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, value.userId));
    }
});

describe('TEST:B7:13 — S4 starts the grace clock with the version days, read through the contract (AC:B7:20)', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'uses each plan version grace_days value through real planPolicy',
        async () => {
            const realPolicy = createPlanCatalogInverse({ reader: planCatalogModel }).planPolicy;
            for (const graceDays of [4, 12]) {
                const planPolicy = vi.fn((input: Parameters<typeof realPolicy>[0]) =>
                    realPolicy(input)
                );
                const fixture = await graceFixture({
                    graceDays,
                    versionGraceDays: graceDays,
                    planPolicy
                });
                const subscriptionId = fixture.started.subscriptionId;
                seeded.push({ subscriptionId, userId: fixture.user.id });
                const [before] = await getServiceTestDb()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, subscriptionId));
                if (!before?.planVersionId) throw new Error('Missing plan version');
                const charge = await fixture.provider.failChargeCycle({
                    authorizationId: fixture.started.authorizationId,
                    declineReason: 'issuer_declined'
                });
                const result = await recordChargeFact(
                    { chargeId: charge.chargeId },
                    {
                        provider: fixture.provider,
                        clock: fixture.clock,
                        beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                        payments: creditedPaymentsFromLedger,
                        planPolicy: fixture.planPolicy,
                        coverageNotices: fixture.coverageNotices
                    }
                );
                expect(result).toMatchObject({
                    outcome: 'GRACE',
                    grace: { outcome: 'GRACE_STARTED' }
                });
                if (result.outcome !== 'GRACE' || result.grace.outcome !== 'GRACE_STARTED')
                    throw new Error('S4 did not start grace');
                expect(
                    result.grace.graceEndsAt.getTime() - result.grace.graceStartedAt.getTime()
                ).toBe(graceDays * DAY_MS);
                const [row] = await getServiceTestDb()
                    .select()
                    .from(subscriptions)
                    .where(eq(subscriptions.id, subscriptionId));
                expect(row?.graceStartedAt).toEqual(result.grace.graceStartedAt);
                expect(row?.graceEndsAt).toEqual(result.grace.graceEndsAt);
                expect(planPolicy).toHaveBeenCalledWith({ planVersionId: before.planVersionId });
            }
        }
    );
});
