import { CoverageResponseSchema } from '@repo/billing-verticals-contract';
import {
    eq,
    permanentGrantVerticals,
    subscriptions
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { createBillingCoverage } from '../../../src/services/billing/coverage/billing-coverage';
import { resolveGrantSources } from '../../../src/services/billing/coverage/grant-sources';
import {
    anchorPermanentGrantVertical
} from '../../../src/services/billing/grant/permanent-grant.service.js';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import {
    addonPolicyFromTx,
    coverageNow,
    frozenClock,
    seedCoveragePlanVersion,
    seedCoverageSubscription,
    seedCoverageUser
} from './support/coverage-fixtures';
import {
    currentFloorPolicy,
    grantSignerActor,
    seedGrantPlan,
    seedPermanentGrant
} from './support/permanent-grant-fixtures';

afterAll(closeServiceTestPool);

function grantPorts() {
    const clock = frozenClock(coverageNow);
    return {
        planPolicy: currentFloorPolicy,
        clock,
        provider: new FakePaymentProvider({ idNamespace: crypto.randomUUID(), clock }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        coverageNotices: { emitCoverageChanged: async () => undefined },
        orphanhood: {
            addonPolicy: addonPolicyFromTx(getServiceTestDb()),
            listing: async () => {
                throw new Error('unexpected listing addon');
            }
        }
    };
}

async function expectGrantFloor(
    input: Parameters<typeof resolveGrantSources>[0]
): Promise<string> {
    const answer = await resolveGrantSources(input);
    expect(answer.sources).toHaveLength(1);
    const source = answer.sources[0];
    if (!source || source.reference.kind !== 'PLAN_VERSION')
        throw new Error('expected a GRANT plan version reference');
    expect(source.floor).toBe(source.reference.planVersionId);
    return source.reference.planVersionId;
}

describe.skipIf(!isServiceTestDbAvailable())('TEST:B9a:10 grant scope', () => {
    it('a — partial grants emit only for their anchored current verticals', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const { userId: signer } = await seedCoverageUser(tx);
            await seedPermanentGrant(tx, {
                beneficiaryUserId: userId,
                grantedBy: signer,
                anchors: [
                    { vertical: VerticalEnum.ACCOMMODATION },
                    { vertical: VerticalEnum.EXPERIENCE }
                ]
            });

            for (const vertical of [VerticalEnum.ACCOMMODATION, VerticalEnum.EXPERIENCE])
                await expectGrantFloor({ userId, vertical, tx });
            for (const vertical of [
                VerticalEnum.GASTRONOMY,
                VerticalEnum.TOURIST,
                VerticalEnum.PARTNER
            ])
                expect((await resolveGrantSources({ userId, vertical, tx })).sources).toEqual([]);
        });
    });

    it('b — global grants cover every current vertical without a cap or expiry field', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const { userId: signer } = await seedCoverageUser(tx);
            const grants = await seedPermanentGrant(tx, {
                beneficiaryUserId: userId,
                grantedBy: signer,
                anchors: Object.values(VerticalEnum).map((vertical) => ({ vertical }))
            });
            expect(grants.anchorIds).toHaveLength(5);

            const coverage = createBillingCoverage({
                tx,
                ports: {
                    clock: frozenClock(coverageNow),
                    payments: creditedPaymentsFromLedger,
                    addonPolicy: async () => {
                        throw new Error('unexpected addon');
                    },
                    listing: async () => {
                        throw new Error('unexpected listing');
                    },
                    trialAndBase: async () => ({ covered: false, sources: [] })
                }
            });
            for (const vertical of Object.values(VerticalEnum)) {
                const answer = CoverageResponseSchema.parse(
                    await coverage.coverage({ userId, vertical })
                );
                expect(answer.covered).toBe(true);
                expect(answer.sources.filter((source) => source.type === 'GRANT')).toHaveLength(1);
            }

            const columns = await tx.execute<{ table_name: string; column_name: string }>(
                `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name IN ('permanent_grant', 'permanent_grant_vertical')`
            );
            expect(
                columns.rows.some(({ column_name }) =>
                    /expir|valid_until|ends_at|max|limit|cap/i.test(column_name)
                )
            ).toBe(false);
            const anchors = await tx
                .select({ id: permanentGrantVerticals.id })
                .from(permanentGrantVerticals)
                .where(eq(permanentGrantVerticals.permanentGrantId, grants.grantId));
            expect(anchors).toHaveLength(5);
        });
    });

    it('c — an unanchored vertical emits no source and leaves prior anchors intact', async () => {
        const futureVertical = VerticalEnum.PARTNER;
        const { userId } = await seedCoverageUser(getServiceTestDb());
        const { userId: signer } = await seedCoverageUser(getServiceTestDb());
        const grant = await seedPermanentGrant(getServiceTestDb(), {
            beneficiaryUserId: userId,
            grantedBy: signer,
            anchors: [
                { vertical: VerticalEnum.ACCOMMODATION },
                { vertical: VerticalEnum.EXPERIENCE }
            ]
        });
        expect((await resolveGrantSources({ userId, vertical: futureVertical })).sources).toEqual(
            []
        );
        const anchors = await getServiceTestDb()
            .select({ vertical: permanentGrantVerticals.vertical })
            .from(permanentGrantVerticals)
            .where(eq(permanentGrantVerticals.permanentGrantId, grant.grantId));
        expect(anchors.map(({ vertical }) => vertical).sort()).toEqual([
            VerticalEnum.ACCOMMODATION,
            VerticalEnum.EXPERIENCE
        ]);
    });

    it('d — anchoring a later vertical emits its floor and S13 cancels its live subscription', async () => {
        const futureVertical = VerticalEnum.TOURIST;
        const { userId } = await seedCoverageUser(getServiceTestDb());
        const { userId: signer } = await seedCoverageUser(getServiceTestDb());
        const grant = await seedPermanentGrant(getServiceTestDb(), {
            beneficiaryUserId: userId,
            grantedBy: signer,
            anchors: [{ vertical: VerticalEnum.ACCOMMODATION }]
        });
        const futurePlan = await getServiceTestDb().transaction(async (tx) => {
            const plan = await seedGrantPlan(tx, futureVertical);
            const version = await seedCoveragePlanVersion(tx, futureVertical);
            const subscription = await seedCoverageSubscription(tx, {
                userId,
                vertical: futureVertical,
                ...version,
                status: 'ACTIVE'
            });
            return { ...plan, subscriptionId: subscription.subscriptionId };
        });
        const before = await resolveGrantSources({ userId, vertical: futureVertical });
        expect(before.sources).toEqual([]);

        const anchored = await anchorPermanentGrantVertical(
            {
                permanentGrantId: grant.grantId,
                actor: grantSignerActor(signer),
                vertical: futureVertical,
                planId: futurePlan.planId,
                floorPlanVersionId: futurePlan.floorPlanVersionId
            },
            grantPorts()
        );
        expect(anchored.cancelledSubscriptionIds).toContain(futurePlan.subscriptionId);
        const [subscription] = await getServiceTestDb()
            .select({ status: subscriptions.status })
            .from(subscriptions)
            .where(eq(subscriptions.id, futurePlan.subscriptionId));
        expect(subscription?.status).toBe('CANCELLED');

        const floor = await expectGrantFloor({ userId, vertical: futureVertical });
        expect(floor).toBe(futurePlan.floorPlanVersionId);
        const anchors = await getServiceTestDb()
            .select({ id: permanentGrantVerticals.id })
            .from(permanentGrantVerticals)
            .where(eq(permanentGrantVerticals.permanentGrantId, grant.grantId));
        expect(anchors).toHaveLength(2);
        expect(anchors.some(({ id }) => id === anchored.anchorId)).toBe(true);
    });
});
