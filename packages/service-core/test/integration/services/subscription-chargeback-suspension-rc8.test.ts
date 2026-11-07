import { emailOutbox, eq, subscriptions } from '@repo/db';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import {
    createChargebackDetection,
    createChargebackSuspension
} from '../../../src/services/billing/reconciliation/chargeback/chargeback-detection.js';
import { runCreditedPaymentsCheck } from '../../../src/services/billing/reconciliation/sweep/credited-payments-check.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { orphanPorts } from './support/addon-orphan-fixtures.js';
import { chargebackMarks, retireChargebackFixtures } from './support/chargeback-fixtures.js';
import {
    creditedCharge,
    deadlines,
    isolateListing,
    seededPaymentIds
} from './support/credited-payments-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';

afterEach(async () => {
    seededPaymentIds.clear();
    await retireChargebackFixtures();
});
afterAll(closeServiceTestPool);

function completeDetection(fixture: Awaited<ReturnType<typeof creditedCharge>>) {
    return createChargebackDetection({
        markPayments: createPaymentReconciliationMarkPayments(fixture.fixture.clock),
        suspension: createChargebackSuspension({
            provider: fixture.fixture.provider,
            clock: fixture.fixture.clock,
            beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
            coverageNotices: fixture.fixture.coverageNotices,
            orphanhood: orphanPorts(getServiceTestDb()).ports
        })
    });
}

async function expectSuspended(fixture: Awaited<ReturnType<typeof creditedCharge>>) {
    const [row] = await getServiceTestDb()
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, fixture.fixture.started.subscriptionId));
    expect(row?.status).toBe('SUSPENDED');
    expect(await chargebackMarks(fixture.fixture.started.subscriptionId)).toHaveLength(1);
    const mails = await getServiceTestDb()
        .select({ template: emailOutbox.template })
        .from(emailOutbox)
        .where(eq(emailOutbox.recipientUserId, fixture.fixture.user.id));
    expect(mails.map((mail) => mail.template).sort()).toEqual([
        'billing.chargeback-suspension',
        'billing.payment-credited',
        'billing.signup-confirmed'
    ]);
}

describe.skipIf(!isServiceTestDbAvailable())(
    'TEST:B7:7 AC:B7:10 both RC-8 chargeback read branches',
    () => {
        it('suspends from the credited-payments check after the provider reads charged_back', async () => {
            const fixture = await creditedCharge();
            await fixture.fixture.provider.chargeBack({ chargeId: fixture.chargeId });
            const listing = isolateListing();
            try {
                const summary = await runCreditedPaymentsCheck(
                    { correlationId: crypto.randomUUID(), pageSize: 50 },
                    {
                        provider: fixture.fixture.provider,
                        clock: fixture.fixture.clock,
                        markPayments: createPaymentReconciliationMarkPayments(
                            fixture.fixture.clock
                        ),
                        deadlines: deadlines(180),
                        chargebacks: completeDetection(fixture)
                    }
                );
                expect(
                    summary.failures.filter(
                        (failure) =>
                            failure.subscriptionId === fixture.fixture.started.subscriptionId
                    )
                ).toEqual([]);
            } finally {
                listing.mockRestore();
            }
            await expectSuspended(fixture);
        });

        it('suspends when recordChargeFact rereads its credited payment as charged back', async () => {
            const fixture = await creditedCharge();
            await fixture.fixture.provider.chargeBack({ chargeId: fixture.chargeId });
            const result = await recordChargeFact(
                { chargeId: fixture.chargeId },
                {
                    provider: fixture.fixture.provider,
                    clock: fixture.fixture.clock,
                    beforeCancelNotice: outboxBeforeCancelNotice({ deliver: true }),
                    coverageNotices: fixture.fixture.coverageNotices,
                    markPayments: createPaymentReconciliationMarkPayments(fixture.fixture.clock),
                    chargebacks: completeDetection(fixture)
                }
            );
            expect(result).toMatchObject({
                outcome: 'CHARGEBACK_DETECTED',
                detection: { outcome: 'MARKED', suspension: { outcome: 'SUSPENDED' } }
            });
            await expectSuspended(fixture);
        });
    }
);
