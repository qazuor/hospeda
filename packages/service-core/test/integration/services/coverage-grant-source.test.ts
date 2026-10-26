import { CoverageResponseSchema } from '@repo/billing-verticals-contract';
import { eq, permanentGrantVerticals } from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { createBillingCoverage } from '../../../src/services/billing/coverage/billing-coverage';
import { resolveGrantSources } from '../../../src/services/billing/coverage/grant-sources';
import { creditedPaymentsFromLedger } from '../../../src/services/billing/payment/payment-ledger';
import {
    closeServiceTestPool,
    isServiceTestDbAvailable,
    withServiceTestTransaction
} from './helpers';
import { coverageNow, frozenClock, seedCoverageUser } from './support/coverage-fixtures';
import { seedPermanentGrant } from './support/permanent-grant-fixtures';

afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:B9a:12 real GRANT source', () => {
    it('emits the live anchor floor, scoped to its vertical, and coverage validates', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { userId } = await seedCoverageUser(tx);
            const { userId: signer } = await seedCoverageUser(tx);
            const grant = await seedPermanentGrant(tx, {
                beneficiaryUserId: userId,
                grantedBy: signer,
                anchors: [
                    { vertical: VerticalEnum.ACCOMMODATION },
                    { vertical: VerticalEnum.VENUE },
                    { vertical: VerticalEnum.TOURIST }
                ]
            });
            const sources = await resolveGrantSources({
                userId,
                vertical: VerticalEnum.ACCOMMODATION,
                tx
            });
            expect(sources.sources).toHaveLength(1);
            const [anchor] = await tx
                .select()
                .from(permanentGrantVerticals)
                .where(eq(permanentGrantVerticals.id, grant.anchorIds[0]!));
            expect(sources.sources[0]).toEqual({
                type: 'GRANT',
                reference: { kind: 'PLAN_VERSION', planVersionId: anchor?.floorPlanVersionId },
                scope: 'VERTICAL',
                target: null,
                since: anchor?.createdAt,
                until: 'NEVER_EXPIRES',
                charged: null,
                floor: anchor?.floorPlanVersionId
            });
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
            expect(
                CoverageResponseSchema.parse(
                    await coverage.coverage({
                        userId,
                        vertical: VerticalEnum.ACCOMMODATION
                    })
                ).covered
            ).toBe(true);
            expect(
                (await resolveGrantSources({ userId, vertical: VerticalEnum.EXPERIENCE, tx }))
                    .sources
            ).toEqual([]);
            const floors = await Promise.all(
                [VerticalEnum.ACCOMMODATION, VerticalEnum.VENUE, VerticalEnum.TOURIST].map(
                    (vertical) => resolveGrantSources({ userId, vertical, tx })
                )
            );
            expect(
                floors.every(({ sources: rows }) => rows.length === 1 && rows[0]?.floor !== null)
            ).toBe(true);
            expect(new Set(floors.map(({ sources: rows }) => rows[0]?.floor)).size).toBe(3);
        });
    });

    it('filters revoked grants and grants belonging to another person', async () => {
        await withServiceTestTransaction(async (tx) => {
            const owner = await seedCoverageUser(tx);
            const other = await seedCoverageUser(tx);
            const signer = await seedCoverageUser(tx);
            await seedPermanentGrant(tx, {
                beneficiaryUserId: owner.userId,
                grantedBy: signer.userId,
                anchors: [{ vertical: VerticalEnum.ACCOMMODATION }],
                revoked: true
            });
            await seedPermanentGrant(tx, {
                beneficiaryUserId: other.userId,
                grantedBy: signer.userId,
                anchors: [{ vertical: VerticalEnum.ACCOMMODATION }]
            });
            expect(
                (
                    await resolveGrantSources({
                        userId: owner.userId,
                        vertical: VerticalEnum.ACCOMMODATION,
                        tx
                    })
                ).sources
            ).toEqual([]);
            expect(
                (
                    await resolveGrantSources({
                        userId: '11111111-1111-4111-8111-111111111111',
                        vertical: VerticalEnum.ACCOMMODATION,
                        tx
                    })
                ).sources
            ).toEqual([]);
        });
    });

    it('propagates a read failure instead of returning an empty answer', async () => {
        const brokenTx = {
            select: () => {
                throw new Error('read failed');
            }
        };
        await expect(
            resolveGrantSources({
                userId: '11111111-1111-4111-8111-111111111111',
                vertical: VerticalEnum.ACCOMMODATION,
                tx: brokenTx as never
            })
        ).rejects.toThrow('read failed');
    });
});
