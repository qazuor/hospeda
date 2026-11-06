import {
    and,
    coveredPeriods,
    emailOutbox,
    eq,
    inArray,
    isNull,
    payments,
    receipts,
    subscriptionPauses,
    subscriptions
} from '@repo/db';
import { VerticalEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { resolveCourtesySources } from '../../../src/services/billing/coverage/courtesy-sources.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    createChargebackDetection,
    createChargebackSuspension
} from '../../../src/services/billing/reconciliation/chargeback/chargeback-detection.js';
import { reissueDeferredCourtesy } from '../../../src/services/billing/subscription/reissue-deferred-courtesy.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { orphanPorts } from './support/addon-orphan-fixtures.js';
import { paymentOfCharge } from './support/chargeback-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import {
    retireReissueCourtesyCase,
    seedReissueCourtesyCase
} from './support/reissue-courtesy-fixtures.js';

const fixtures: Awaited<ReturnType<typeof seedReissueCourtesyCase>>[] = [];

afterEach(async () => {
    const db = getServiceTestDb();
    while (fixtures.length) {
        const fixture = fixtures.pop();
        if (!fixture) continue;
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, fixture.ids.userId));
        await db
            .delete(coveredPeriods)
            .where(eq(coveredPeriods.subscriptionId, fixture.ids.successor.id));
        const paymentRows = await db
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.subscriptionId, fixture.ids.successor.id));
        if (paymentRows.length)
            await db.delete(receipts).where(
                inArray(
                    receipts.paymentId,
                    paymentRows.map((payment) => payment.id)
                )
            );
        await retireReissueCourtesyCase({ ids: fixture.ids });
    }
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B7:7 AC:B7:10 chargeback from a real courtesy pause',
    () => {
        it('reissues courtesy through S9, then closes it as S6 suspends', async () => {
            const fixture = await seedReissueCourtesyCase();
            fixtures.push(fixture);
            const { chargeId } = await fixture.harness.fake.charge({
                authorizationId: fixture.authorizationId!,
                amount: { amountMinor: 10_000, currency: 'ARS' },
                reference: fixture.ids.successor.id
            });
            fixture.clock.set({ at: new Date(fixture.clock.now().getTime() + 86_400_000) });
            const recorded = await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice: { beforeCancel: async () => 'SENT' },
                    coverageNotices: { emitCoverageChanged: async () => {} },
                    markPayments: fixture.markPayments
                }
            );
            expect(recorded.outcome).toBe('CREDITED');
            expect(
                await reissueDeferredCourtesy(
                    { successorSubscriptionId: fixture.ids.successor.id },
                    fixture
                )
            ).toMatchObject({ outcome: 'REISSUED' });
            const beforeSources = await resolveCourtesySources({
                userId: fixture.ids.userId,
                vertical: VerticalEnum.ACCOMMODATION,
                ports: { clock: fixture.clock }
            });
            expect(beforeSources.sources).toHaveLength(1);
            const [openPause] = await getServiceTestDb()
                .select({ id: subscriptionPauses.id, actualEndAt: subscriptionPauses.actualEndAt })
                .from(subscriptionPauses)
                .where(
                    and(
                        eq(subscriptionPauses.subscriptionId, fixture.ids.successor.id),
                        isNull(subscriptionPauses.actualEndAt)
                    )
                );
            expect(openPause?.id).toBeDefined();

            await fixture.harness.fake.chargeBack({ chargeId });
            const detection = createChargebackDetection({
                markPayments: fixture.markPayments,
                suspension: createChargebackSuspension({
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: { emitCoverageChanged: async () => {} },
                    orphanhood: orphanPorts(getServiceTestDb()).ports
                })
            });
            const result = await detection.detect({
                payment: await paymentOfCharge(chargeId),
                actor: 'provider',
                correlationId: crypto.randomUUID()
            });

            expect(result.suspension?.outcome).toBe('SUSPENDED');
            const [subscription] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.ids.successor.id));
            const [closedPause] = await getServiceTestDb()
                .select({ actualEndAt: subscriptionPauses.actualEndAt })
                .from(subscriptionPauses)
                .where(eq(subscriptionPauses.id, openPause!.id));
            expect(subscription?.status).toBe('SUSPENDED');
            expect(closedPause?.actualEndAt).toEqual(fixture.clock.now());
            expect(
                await resolveCourtesySources({
                    userId: fixture.ids.userId,
                    vertical: VerticalEnum.ACCOMMODATION,
                    ports: { clock: fixture.clock }
                })
            ).toEqual({ sources: [] });
            const suspensionMail = await getServiceTestDb()
                .select({ payload: emailOutbox.payload })
                .from(emailOutbox)
                .where(
                    and(
                        eq(emailOutbox.recipientUserId, fixture.ids.userId),
                        eq(emailOutbox.template, 'billing.chargeback-suspension')
                    )
                );
            expect(suspensionMail).toHaveLength(1);
            expect(suspensionMail[0]?.payload).toMatchObject({ courtesyEnded: true });
        });
    }
);
