import { readFileSync } from 'node:fs';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { seedCoverageUser } from './support/coverage-fixtures.js';
import {
    currentFloorPolicy,
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './support/permanent-grant-fixtures.js';
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

const seeded: SeededSuccession[] = [];
const grantUsers: string[] = [];
afterAll(closeServiceTestPool);
afterEach(async () => {
    await retireSuccessionCases(seeded.splice(0));
    await retirePermanentGrantRows(grantUsers.splice(0));
});

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:17 — the branch 4 flag, turned off by the real S13 (AC:B9a:17, AC:B9a:16)',
    () => {
        it('releases the S19 retention through B7 without refund and cancels both principals', async () => {
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            seeded.push(s.seeded);
            s.fixture.advanceToAttempt(2);
            const retained = await recordChargeFact(
                { chargeId: s.fixture.chargeId },
                s.chargePorts
            );
            expect(retained).toMatchObject({ exit: { outcome: 'RETAINED_FOR_S19' } });
            const payment = await paymentFor(s.fixture.chargeId);
            const [retention] = await retentionsOf(s.subscriptionId);
            expect(retention).toMatchObject({ paymentId: payment.id, releasedAt: null });
            if (!retention) throw new Error('S19 retention missing');
            const predecessor = await subscriptionRow(s.subscriptionId);
            if (!predecessor.userId || !predecessor.vertical)
                throw new Error('Principal missing owner');
            grantUsers.push(predecessor.userId);
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            grantUsers.push(adminId);
            const floor = await seedGrantPlan(getServiceTestDb(), predecessor.vertical);
            const now = s.fixture.clock.now();

            const result = await grantPermanentGrant(
                {
                    beneficiaryUserId: predecessor.userId,
                    actor: grantSignerActor(adminId),
                    reason: 'Release branch 4 retention',
                    includesAddons: false,
                    anchors: [{ vertical: predecessor.vertical, ...floor }]
                },
                {
                    provider: s.chargePorts.provider,
                    clock: s.fixture.clock,
                    planPolicy: currentFloorPolicy,
                    beforeCancelNotice: s.chargePorts.beforeCancelNotice,
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    orphanhood: {
                        addonPolicy: async () => {
                            throw new Error('Unexpected addon');
                        },
                        listing: async () => {
                            throw new Error('Unexpected listing');
                        }
                    }
                }
            );

            expect([...result.cancelledSubscriptionIds].sort()).toEqual(
                [s.subscriptionId, s.successor.id].sort()
            );
            expect(result.releasedRetentionIds).toContain(retention.id);
            expect(await retentionsOf(s.subscriptionId)).toMatchObject([
                { id: retention.id, releasedAt: now, releaseReason: 'PERMANENT_GRANT' }
            ]);
            expect(await refundsOf(payment.id)).toHaveLength(0);
            expect((await paymentFor(s.fixture.chargeId)).status).toBe('SUCCEEDED');
            expect((await subscriptionRow(s.subscriptionId)).status).toBe('CANCELLED');
            expect((await subscriptionRow(s.successor.id)).status).toBe('CANCELLED');
            expect(await openMarksOf(s.subscriptionId)).toHaveLength(0);
            expect(await openMarksOf(s.successor.id)).toHaveLength(0);

            const source = readFileSync(
                new URL(
                    '../../../src/services/billing/grant/permanent-grant-s13.ts',
                    import.meta.url
                ),
                'utf8'
            );
            expect(source).toMatch(
                /import \{ permanentGrantRetentionRelease \} from '\.\.\/subscription\/succession-permanent-grant(?:\.js)?'/
            );
            expect(source).toContain('permanentGrantRetentionRelease.releaseOnPermanentGrant(');
        });
    }
);
