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

describe.skipIf(!isServiceTestDbAvailable())('TEST:B9a:10 grant scope', () => {
    it('emits only for anchored verticals, with each anchor floor and no vertical cap', async () => {
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
            for (const vertical of [VerticalEnum.ACCOMMODATION, VerticalEnum.EXPERIENCE]) {
                const answer = await resolveGrantSources({ userId, vertical, tx });
                expect(answer.sources).toHaveLength(1);
                expect(answer.sources[0]?.floor).toBe(answer.sources[0]?.reference.planVersionId);
            }
            for (const vertical of [
                VerticalEnum.GASTRONOMY,
                VerticalEnum.TOURIST,
                VerticalEnum.PARTNER
            ])
                expect((await resolveGrantSources({ userId, vertical, tx })).sources).toEqual([]);

            const all = await seedCoverageUser(tx);
            const grants = await seedPermanentGrant(tx, {
                beneficiaryUserId: all.userId,
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
                    await coverage.coverage({ userId: all.userId, vertical })
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
});
