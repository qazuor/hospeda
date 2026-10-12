import { coveredPeriods, emailOutbox, eq, payments, sql } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);
const beforeCancelNotice = { beforeCancel: async () => 'SENT' as const };

describe('TEST:B5:23 concurrent provider charge facts', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:23 deduplicates an approved fact under parallel insertion, including ten distinct races',
        async () => {
            const fixture = await paymentFixture();
            for (let index = 0; index < 10; index++) {
                fixture.clock.advance({ ms: index === 0 ? 0 : 31 * 24 * 60 * 60 * 1000 });
                const { chargeId } = await fixture.provider.charge({
                    authorizationId: fixture.started.authorizationId,
                    amount: { amountMinor: 250000, currency: 'ARS' },
                    reference: `${fixture.started.subscriptionId}-${index}`
                });
                const run = () =>
                    recordChargeFact(
                        { chargeId },
                        {
                            provider: fixture.provider,
                            clock: fixture.clock,
                            beforeCancelNotice,
                            coverageNotices: fixture.coverageNotices
                        }
                    );
                const outcomes = await Promise.all([run(), run()]);
                expect(outcomes).toHaveLength(2);
                const rows = await getServiceTestDb()
                    .select()
                    .from(payments)
                    .where(eq(payments.providerFactId, chargeId));
                expect(rows).toHaveLength(1);
                expect(rows[0]).toMatchObject({ status: 'SUCCEEDED', version: 2 });
                const coverage = await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, rows[0]?.id ?? ''));
                expect(coverage).toHaveLength(1);
                const emails = await getServiceTestDb()
                    .select()
                    .from(emailOutbox)
                    .where(eq(emailOutbox.recipientUserId, fixture.user.id));
                expect(
                    emails.filter(
                        (row) =>
                            row.template === 'billing.payment-credited' &&
                            (row.payload as { paymentId?: string }).paymentId === rows[0]?.id
                    )
                ).toHaveLength(1);
            }
            expect(fixture.coverageEvents).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:23 applies one P1 when two readers race on an existing pending fact',
        async () => {
            const fixture = await paymentFixture({ honestM8: false });
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            await recordChargeFact(
                { chargeId },
                {
                    provider: fixture.provider,
                    clock: fixture.clock,
                    beforeCancelNotice,
                    coverageNotices: fixture.coverageNotices
                }
            );
            fixture.clock.advance({ ms: 2 * 60 * 60 * 1000 });
            const run = () =>
                recordChargeFact(
                    { chargeId },
                    {
                        provider: fixture.provider,
                        clock: fixture.clock,
                        beforeCancelNotice,
                        coverageNotices: fixture.coverageNotices
                    }
                );
            const outcomes = await Promise.all([run(), run()]);
            const rows = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({ status: 'SUCCEEDED', version: 2 });
            expect(
                outcomes.filter(
                    (outcome) =>
                        outcome.outcome === 'CREDITED' && outcome.credit.outcome === 'CREDITED'
                )
            ).toHaveLength(1);
            expect(
                outcomes.some(
                    (outcome) =>
                        outcome.outcome === 'CREDITED' &&
                        outcome.credit.outcome === 'ALREADY_CREDITED'
                )
            ).toBe(true);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:B5:23 rereads after a pending payment version changes between P1 read and update',
        async () => {
            const fixture = await paymentFixture({ honestM8: false });
            const { chargeId } = await fixture.provider.charge({
                authorizationId: fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: fixture.started.subscriptionId
            });
            await recordChargeFact(
                { chargeId },
                { provider: fixture.provider, clock: fixture.clock, beforeCancelNotice }
            );
            const [pending] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, chargeId));
            if (!pending) throw new Error('pending payment fact missing');
            fixture.clock.advance({ ms: 2 * 60 * 60 * 1000 });
            fixture.provider.takeDeliveries();

            let injected = false;
            const misses: string[] = [];
            const result = await creditPayment(
                { paymentId: pending.id, chargeCreatedAt: pending.factAt },
                {
                    clock: fixture.clock,
                    coverageNotices: fixture.coverageNotices,
                    beforeOptimisticUpdate: async ({ paymentId }) => {
                        if (injected) return;
                        const [changed] = await getServiceTestDb()
                            .update(payments)
                            .set({ version: sql`${payments.version} + 1` })
                            .where(eq(payments.id, paymentId))
                            .returning({ version: payments.version });
                        expect(changed?.version).toBe(2);
                        injected = true;
                    },
                    onOptimisticUpdateMiss: async ({ paymentId }) => {
                        misses.push(paymentId);
                    }
                }
            );
            const [credited] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, pending.id));
            const coverage = await getServiceTestDb()
                .select()
                .from(coveredPeriods)
                .where(eq(coveredPeriods.paymentId, pending.id));
            const emails = await getServiceTestDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, fixture.user.id));
            expect(injected).toBe(true);
            expect(misses).toEqual([pending.id]);
            expect(result.outcome).toBe('CREDITED');
            expect(credited).toMatchObject({ status: 'SUCCEEDED', version: 3 });
            expect(coverage).toHaveLength(1);
            expect(
                emails.filter(
                    (row) =>
                        row.template === 'billing.payment-credited' &&
                        (row.payload as { paymentId?: string }).paymentId === pending.id
                )
            ).toHaveLength(1);
        }
    );
});
