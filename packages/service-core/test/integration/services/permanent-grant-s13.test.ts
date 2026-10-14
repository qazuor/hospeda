import {
    addonInstances,
    and,
    coverageLosses,
    eq,
    inArray,
    payments,
    permanentGrants,
    permanentGrantVerticals,
    refunds,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { grantPermanentGrant } from '../../../src/services/billing/grant/permanent-grant.service.js';
import { runS13InTransaction } from '../../../src/services/billing/grant/permanent-grant-s13.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { seedVerticalAddon } from './support/addon-orphan-fixtures.js';
import {
    addonPolicyFromTx,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures.js';
import { retirePermanentGrantRows, seedGrantPlan } from './support/permanent-grant-fixtures.js';
import {
    openMarksOf,
    paymentFor,
    predecessorInGrace,
    refundsOf,
    retentionsOf,
    retireSuccessionCases,
    type SeededSuccession
} from './support/succession-retention-fixtures.js';

afterAll(closeServiceTestPool);
const now = new Date('2026-10-14T12:00:00.000Z');
const userIds: string[] = [];
const successionCases: SeededSuccession[] = [];
const grantOnlyBeneficiaries: string[] = [];
const V = VerticalEnum.ACCOMMODATION;
const W = VerticalEnum.GASTRONOMY;
afterEach(async () => {
    await retirePermanentGrantRows(userIds.splice(0));
    for (const beneficiaryUserId of grantOnlyBeneficiaries.splice(0)) {
        const rows = await getServiceTestDb()
            .select({ id: permanentGrants.id })
            .from(permanentGrants)
            .where(eq(permanentGrants.beneficiaryUserId, beneficiaryUserId));
        const ids = rows.map(({ id }) => id);
        if (ids.length)
            await getServiceTestDb()
                .delete(permanentGrantVerticals)
                .where(inArray(permanentGrantVerticals.permanentGrantId, ids));
        await getServiceTestDb()
            .delete(permanentGrants)
            .where(eq(permanentGrants.beneficiaryUserId, beneficiaryUserId));
    }
    await retireSuccessionCases(successionCases.splice(0));
});

async function seedCase(vertical = V, status = 'ACTIVE') {
    return getServiceTestDb().transaction(async (tx) => {
        const { userId } = await seedCoverageUser(tx);
        const { userId: adminId } = await seedCoverageUser(tx);
        userIds.push(userId, adminId);
        const plan = await seedCoveragePlanVersion(tx, vertical);
        const { subscriptionId } = await seedCoverageSubscription(tx, {
            userId,
            vertical,
            ...plan,
            status
        });
        const anchor = await seedGrantPlan(tx, vertical);
        return { userId, adminId, subscriptionId, anchor };
    });
}

function ports(onNotice: () => Promise<void> = async () => undefined) {
    return {
        clock: { now: () => now },
        coverageNotices: { emitCoverageChanged: onNotice },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(getServiceTestDb()),
            listing: async () => {
                throw new Error('no listing addon seeded');
            }
        }
    };
}

async function grant(input: Awaited<ReturnType<typeof seedCase>>) {
    return grantPermanentGrant(
        {
            beneficiaryUserId: input.userId,
            grantedBy: input.adminId,
            reason: 'S13 integration case',
            includesAddons: false,
            anchors: [{ vertical: V, ...input.anchor }]
        },
        ports()
    );
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:1 — S13 local half: granting cuts every live PRINCIPAL row of the anchored verticals (AC:B9a:1)',
    () => {
        it.each([
            'ACTIVE',
            'GRACE_PERIOD',
            'PAUSED',
            'SUSPENDED',
            'CANCEL_SCHEDULED',
            'PENDING_AUTHORIZATION'
        ] as const)('a — %s is cancelled; grace clock and PAUSED interval are closed', async (status) => {
            const seeded = await seedCase(V, status);
            if (status === 'PAUSED')
                await getServiceTestDb()
                    .insert(subscriptionPauses)
                    .values({
                        subscriptionId: seeded.subscriptionId,
                        reason: 'CUSTOMER_REQUEST',
                        startsAt: new Date(now.getTime() - 86_400_000)
                    });
            if (status === 'GRACE_PERIOD')
                await getServiceTestDb()
                    .update(subscriptions)
                    .set({
                        graceStartedAt: new Date(now.getTime() - 86_400_000),
                        graceEndsAt: new Date(now.getTime() + 86_400_000)
                    })
                    .where(eq(subscriptions.id, seeded.subscriptionId));
            if (status === 'CANCEL_SCHEDULED')
                await getServiceTestDb()
                    .update(subscriptions)
                    .set({ serviceEndsAt: new Date(now.getTime() + 86_400_000) })
                    .where(eq(subscriptions.id, seeded.subscriptionId));
            const result = await grant(seeded);
            expect(result.cancelledSubscriptionIds).toContain(seeded.subscriptionId);
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(row).toMatchObject({
                status: 'CANCELLED',
                serviceEndsAt: now,
                graceStartedAt: null,
                graceEndsAt: null
            });
            const [grantRow] = await getServiceTestDb()
                .select()
                .from(permanentGrants)
                .where(eq(permanentGrants.id, result.permanentGrantId));
            expect(grantRow?.affectedSubscriptionIds).toContain(seeded.subscriptionId);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coverageLosses)
                    .where(eq(coverageLosses.userId, seeded.userId))
            ).toHaveLength(0);
            const userRefunds = await getServiceTestDb()
                .select({ id: refunds.id })
                .from(refunds)
                .innerJoin(payments, eq(payments.id, refunds.paymentId))
                .innerJoin(subscriptions, eq(subscriptions.id, payments.subscriptionId))
                .where(eq(subscriptions.userId, seeded.userId));
            expect(userRefunds).toEqual([]);
            if (status === 'PAUSED') {
                const [pause] = await getServiceTestDb()
                    .select()
                    .from(subscriptionPauses)
                    .where(eq(subscriptionPauses.subscriptionId, seeded.subscriptionId));
                expect(pause?.actualEndAt).toEqual(now);
            }
        });

        it('b — COMPLEMENTO rows and their addon instances are outside the S13 reader', async () => {
            const seeded = await seedCase();
            const complement = await getServiceTestDb().transaction(async (tx) => {
                return seedVerticalAddon(tx, {
                    userId: seeded.userId,
                    targetId: seeded.subscriptionId
                });
            });
            await grant(seeded);
            const rows = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(
                    and(
                        eq(subscriptions.userId, seeded.userId),
                        eq(subscriptions.class, 'COMPLEMENTO')
                    )
                );
            expect(rows.every((row) => row.status === 'ACTIVE')).toBe(true);
            const [instance] = await getServiceTestDb()
                .select()
                .from(addonInstances)
                .where(eq(addonInstances.id, complement.instanceId));
            expect(instance?.status).toBe('ACTIVE');
        });

        it('d — only anchored verticals are read and cancelled', async () => {
            const seeded = await seedCase(V);
            const other = await getServiceTestDb().transaction(async (tx) => {
                const plan = await seedCoveragePlanVersion(tx, W);
                return seedCoverageSubscription(tx, {
                    userId: seeded.userId,
                    vertical: W,
                    ...plan,
                    status: 'ACTIVE'
                });
            });
            const third = await getServiceTestDb().transaction(async (tx) => {
                const plan = await seedCoveragePlanVersion(tx, VerticalEnum.EXPERIENCE);
                return seedCoverageSubscription(tx, {
                    userId: seeded.userId,
                    vertical: VerticalEnum.EXPERIENCE,
                    ...plan,
                    status: 'ACTIVE'
                });
            });
            const anchorW = await getServiceTestDb().transaction((tx) => seedGrantPlan(tx, W));
            const result = await grantPermanentGrant(
                {
                    beneficiaryUserId: seeded.userId,
                    grantedBy: seeded.adminId,
                    reason: 'two anchored verticals',
                    includesAddons: false,
                    anchors: [
                        { vertical: V, ...seeded.anchor },
                        { vertical: W, ...anchorW }
                    ]
                },
                ports()
            );
            const [rowV] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            const [rowW] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, other.subscriptionId));
            const [rowThird] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, third.subscriptionId));
            expect(rowV?.status).toBe('CANCELLED');
            expect(rowW?.status).toBe('CANCELLED');
            expect(rowThird?.status).toBe('ACTIVE');
            expect(result.cancelledSubscriptionIds).toEqual(
                expect.arrayContaining([seeded.subscriptionId, other.subscriptionId])
            );
        });

        it('c — S19 retention is released in the act, with no refund or succession rewrite', async () => {
            const s = await predecessorInGrace({ approveOnAttempt: 2 });
            grantOnlyBeneficiaries.push(s.fixture.user.id);
            successionCases.push({
                subscriptionIds: [...s.seeded.subscriptionIds],
                userId: s.seeded.userId
            });
            s.fixture.advanceToAttempt(2);
            await recordChargeFact({ chargeId: s.fixture.chargeId }, s.chargePorts);
            const payment = await paymentFor(s.fixture.chargeId);
            const [retention] = await retentionsOf(s.subscriptionId);
            if (!retention) throw new Error('S19 fixture retention missing');
            const anchor = await getServiceTestDb().transaction((tx) => seedGrantPlan(tx, V));
            const cancelled = await grantPermanentGrant(
                {
                    beneficiaryUserId: s.fixture.user.id,
                    grantedBy: s.fixture.user.id,
                    reason: 'S19 permanent grant',
                    includesAddons: false,
                    anchors: [{ vertical: V, ...anchor }]
                },
                {
                    clock: s.fixture.clock,
                    coverageNotices: { emitCoverageChanged: async () => undefined },
                    orphanhood: {
                        addonPolicy: addonPolicyFromTx(getServiceTestDb()),
                        listing: async () => {
                            throw new Error('no listing');
                        }
                    }
                }
            );
            expect(cancelled.cancelledSubscriptionIds).toContain(s.subscriptionId);
            expect(cancelled.cancelledSubscriptionIds).toContain(s.successor.id);
            const [released] = await retentionsOf(s.subscriptionId);
            expect(released).toMatchObject({
                id: retention.id,
                releasedAt: s.fixture.clock.now(),
                releaseReason: 'PERMANENT_GRANT'
            });
            expect(await refundsOf(payment.id)).toEqual([]);
            expect(await openMarksOf(s.subscriptionId)).toEqual([]);
            expect(await openMarksOf(s.successor.id)).toEqual([]);
            const [predecessor] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, s.subscriptionId));
            const [successor] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, s.successor.id));
            expect(predecessor?.succeededById).toBeNull();
            expect(successor?.succeedsId).toBe(s.subscriptionId);
        });

        it('f — a composite plan FK failure rolls back the grant, anchor and subscription change', async () => {
            const seeded = await seedCase(V);
            const wrongPlan = await getServiceTestDb().transaction((tx) => seedGrantPlan(tx, W));
            let notices = 0;
            await expect(
                grantPermanentGrant(
                    {
                        beneficiaryUserId: seeded.userId,
                        grantedBy: seeded.adminId,
                        reason: 'invalid FK',
                        includesAddons: false,
                        anchors: [{ vertical: V, ...wrongPlan }]
                    },
                    ports(async () => {
                        notices += 1;
                    })
                )
            ).rejects.toBeTruthy();
            expect(notices).toBe(0);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(permanentGrants)
                    .where(eq(permanentGrants.beneficiaryUserId, seeded.userId))
            ).toHaveLength(0);
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(row?.status).toBe('ACTIVE');
        });

        it('e — a second local pass is idempotent and leaves updated_at unchanged', async () => {
            const seeded = await seedCase();
            const result = await grant(seeded);
            const [before] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            const again = await getServiceTestDb().transaction((tx) =>
                runS13InTransaction(
                    {
                        tx,
                        permanentGrantId: result.permanentGrantId,
                        beneficiaryUserId: seeded.userId,
                        verticals: [V],
                        now: new Date(now.getTime() + 1000),
                        actorId: seeded.adminId
                    },
                    {
                        orphanhood: {
                            addonPolicy: async () => {
                                throw new Error('no addons seeded');
                            },
                            listing: async () => {
                                throw new Error('no listing');
                            }
                        }
                    }
                )
            );
            const [after] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(again.cancelled).toEqual([]);
            expect(after?.updatedAt).toEqual(before?.updatedAt);
        });
    }
);
