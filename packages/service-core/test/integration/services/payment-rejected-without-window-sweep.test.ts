import { eq, payments } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { expireLapsedPayments } from '../../../src/services/billing/payment/expire-lapsed-payments.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);

describe('TEST:1734 rejected payment expiry sweep', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'TEST:1734:8 fails a rejected signup fact that predates P8',
        async () => {
            const fixture = await paymentFixture();
            const { chargeId } = await fixture.provider.declineCharge({
                authorizationId: fixture.started.authorizationId,
                declineReason: 'issuer_declined'
            });
            const read = await fixture.provider.readCharge({ chargeId });
            expect(read.snapshot.expiresAt).toBeNull();
            const [payment] = await getServiceTestDb()
                .insert(payments)
                .values({
                    subscriptionId: fixture.started.subscriptionId,
                    amount: 250000,
                    currency: 'ARS',
                    status: 'PENDING',
                    provider: fixture.link.provider,
                    providerFactId: chargeId,
                    factAt: new Date(read.snapshot.createdAt),
                    version: 1
                })
                .returning();
            if (!payment) throw new Error('pre-deploy pending payment missing');

            const summary = await expireLapsedPayments({}, fixture);
            const [afterFirstRun] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, payment.id));
            expect(afterFirstRun).toEqual({
                ...payment,
                status: 'FAILED',
                version: 2,
                updatedAt: expect.any(Date)
            });
            expect(summary.failed).toBeGreaterThanOrEqual(1);

            const secondSummary = await expireLapsedPayments({}, fixture);
            const [afterSecondRun] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.id, payment.id));
            expect(afterSecondRun).toEqual(afterFirstRun);
            expect(secondSummary.failed).toBe(0);
        }
    );
});
