import { eq, payments, subscriptions, users } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { paymentFixture } from './support/payment-fixtures.js';

afterAll(closeServiceTestPool);

async function pendingPayment({
    fixture
}: {
    readonly fixture: Awaited<ReturnType<typeof paymentFixture>>;
}) {
    const [payment] = await getServiceTestDb()
        .insert(payments)
        .values({
            subscriptionId: fixture.started.subscriptionId,
            amount: 250000,
            currency: 'ARS',
            status: 'PENDING',
            provider: fixture.link.provider,
            providerFactId: `fact-${crypto.randomUUID()}`,
            factAt: fixture.clock.now()
        })
        .returning();
    return payment!;
}

async function rememberedOf({ userId }: { readonly userId: string }) {
    const [row] = await getServiceTestDb()
        .select({ email: users.lastSuccessfulPayerEmail })
        .from(users)
        .where(eq(users.id, userId));
    return row?.email ?? null;
}

describe('HOS-2616 an approved charge remembers the declared payer email on the account', () => {
    it.skipIf(!isServiceTestDbAvailable())(
        'writes it on the credit, keeps it when a pending charge is not credited, and replaces it with the next approved one',
        async () => {
            const fixture = await paymentFixture();
            const db = getServiceTestDb();
            await db
                .update(subscriptions)
                .set({ declaredPayerEmail: 'first@example.test' })
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            // An authorized signup without an approved charge teaches nothing.
            expect(await rememberedOf({ userId: fixture.user.id })).toBeNull();
            const first = await pendingPayment({ fixture });
            expect(await rememberedOf({ userId: fixture.user.id })).toBeNull();

            await creditPayment(
                { paymentId: first.id, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock }
            );
            expect(await rememberedOf({ userId: fixture.user.id })).toBe('first@example.test');

            await db
                .update(subscriptions)
                .set({ declaredPayerEmail: 'second@example.test' })
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            const second = await pendingPayment({ fixture });
            await creditPayment(
                { paymentId: second.id, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock }
            );
            expect(await rememberedOf({ userId: fixture.user.id })).toBe('second@example.test');
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        'keeps the remembered email when the credited subscription declared none',
        async () => {
            const fixture = await paymentFixture();
            await getServiceTestDb()
                .update(users)
                .set({ lastSuccessfulPayerEmail: 'kept@example.test' })
                .where(eq(users.id, fixture.user.id));
            const payment = await pendingPayment({ fixture });

            await creditPayment(
                { paymentId: payment.id, chargeCreatedAt: fixture.clock.now() },
                { clock: fixture.clock }
            );

            expect(await rememberedOf({ userId: fixture.user.id })).toBe('kept@example.test');
        }
    );
});
