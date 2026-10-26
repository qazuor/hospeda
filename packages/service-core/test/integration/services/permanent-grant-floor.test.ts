import type { VerticalsForBilling } from '@repo/billing-verticals-contract';
import { VerticalsForBillingSimulator } from '@repo/billing-verticals-contract/testing';
import { eq, permanentGrants, permanentGrantVerticals } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
    anchorPermanentGrantVertical,
    grantPermanentGrant
} from '../../../src/services/billing/grant/permanent-grant.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { addonPolicyFromTx, seedCoverageUser } from './support/coverage-fixtures.js';
import {
    grantSignerActor,
    retirePermanentGrantRows,
    seedGrantPlan
} from './support/permanent-grant-fixtures.js';

const userIds: string[] = [];
afterAll(closeServiceTestPool);
afterEach(async () => retirePermanentGrantRows(userIds.splice(0)));
const policy = (current: boolean) => ({
    graceDays: 0,
    allowsPause: false,
    current,
    sellable: false
});

function ports(
    planPolicy: VerticalsForBilling['planPolicy'],
    notices = vi.fn(async () => undefined),
    provider = new FakePaymentProvider({
        idNamespace: crypto.randomUUID(),
        clock: { now: () => new Date() }
    })
) {
    return {
        clock: { now: () => new Date() },
        planPolicy,
        provider,
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: { emitCoverageChanged: notices },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(getServiceTestDb()),
            listing: async () => {
                throw new Error('no listing seeded');
            }
        }
    };
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B9a:11 — floor currentness in permanent grant writes',
    () => {
        it('rejects a non-current floor before grant writes or post-commit effects', async () => {
            const { userId } = await seedCoverageUser(getServiceTestDb());
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            userIds.push(userId, adminId);
            const plan = await seedGrantPlan(getServiceTestDb(), VerticalEnum.ACCOMMODATION);
            const simulator = new VerticalsForBillingSimulator({
                clock: { now: () => new Date() }
            });
            simulator.setPlanPolicy({
                planVersionId: plan.floorPlanVersionId,
                policy: policy(false)
            });
            const notices = vi.fn(async () => undefined);
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock: { now: () => new Date() }
            });
            const cancel = vi.spyOn(fake, 'cancel');
            await expect(
                grantPermanentGrant(
                    {
                        beneficiaryUserId: userId,
                        actor: grantSignerActor(adminId),
                        reason: 'floor',
                        includesAddons: false,
                        anchors: [{ vertical: VerticalEnum.ACCOMMODATION, ...plan }]
                    },
                    ports((args) => simulator.planPolicy(args), notices, fake)
                )
            ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_FLOOR_NOT_CURRENT' });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(permanentGrants)
                    .where(eq(permanentGrants.beneficiaryUserId, userId))
            ).toHaveLength(0);
            expect(notices).not.toHaveBeenCalled();
            expect(cancel).not.toHaveBeenCalled();
        });

        it('writes a current floor by reference', async () => {
            const { userId } = await seedCoverageUser(getServiceTestDb());
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            userIds.push(userId, adminId);
            const plan = await seedGrantPlan(getServiceTestDb(), VerticalEnum.ACCOMMODATION);
            const simulator = new VerticalsForBillingSimulator({
                clock: { now: () => new Date() }
            });
            simulator.setPlanPolicy({
                planVersionId: plan.floorPlanVersionId,
                policy: policy(true)
            });
            const created = await grantPermanentGrant(
                {
                    beneficiaryUserId: userId,
                    actor: grantSignerActor(adminId),
                    reason: 'floor',
                    includesAddons: false,
                    anchors: [{ vertical: VerticalEnum.ACCOMMODATION, ...plan }]
                },
                ports((args) => simulator.planPolicy(args))
            );
            const [anchor] = await getServiceTestDb()
                .select()
                .from(permanentGrantVerticals)
                .where(eq(permanentGrantVerticals.permanentGrantId, created.permanentGrantId));
            expect(anchor?.floorPlanVersionId).toBe(plan.floorPlanVersionId);
        });

        it('rejects a non-current floor while anchoring and writes no new anchor', async () => {
            const { userId } = await seedCoverageUser(getServiceTestDb());
            const { userId: adminId } = await seedCoverageUser(getServiceTestDb());
            userIds.push(userId, adminId);
            const first = await seedGrantPlan(getServiceTestDb(), VerticalEnum.ACCOMMODATION);
            const other = await seedGrantPlan(getServiceTestDb(), VerticalEnum.VENUE);
            const initial = await grantPermanentGrant(
                {
                    beneficiaryUserId: userId,
                    actor: grantSignerActor(adminId),
                    reason: 'floor',
                    includesAddons: false,
                    anchors: [{ vertical: VerticalEnum.ACCOMMODATION, ...first }]
                },
                ports(async () => policy(true))
            );
            const simulator = new VerticalsForBillingSimulator({
                clock: { now: () => new Date() }
            });
            simulator.setPlanPolicy({
                planVersionId: other.floorPlanVersionId,
                policy: policy(false)
            });
            await expect(
                anchorPermanentGrantVertical(
                    {
                        permanentGrantId: initial.permanentGrantId,
                        actor: grantSignerActor(adminId),
                        vertical: VerticalEnum.VENUE,
                        ...other
                    },
                    ports((args) => simulator.planPolicy(args))
                )
            ).rejects.toMatchObject({ reason: 'PERMANENT_GRANT_FLOOR_NOT_CURRENT' });
            const rows = await getServiceTestDb()
                .select()
                .from(permanentGrantVerticals)
                .where(eq(permanentGrantVerticals.permanentGrantId, initial.permanentGrantId));
            expect(rows).toHaveLength(1);
        });
    }
);
