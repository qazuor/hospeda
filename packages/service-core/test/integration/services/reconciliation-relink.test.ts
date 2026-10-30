import {
    domainEventModel,
    eq,
    payments,
    providerLinks,
    reconciliationInventoryModel,
    reconciliationMarkModel,
    subscriptions
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleUnknownAuthorization } from '../../../src/services/billing/reconciliation/handle-unknown-authorization.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import {
    createReconciliationFake,
    reconciliationClock,
    seedSubscription
} from './reconciliation-sweep-fixtures.js';

afterAll(closeServiceTestPool);
beforeEach(() => vi.restoreAllMocks());

async function authorize(fake: FakePaymentProvider, reference: string) {
    const result = await fake.authorize({
        reference,
        amount: { amountMinor: 250000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'unknown authorization test',
        returnUrl: 'https://example.test/return',
        payerEmail: `payer-${crypto.randomUUID()}@example.test`
    });
    await fake.approve({ authorizationId: result.authorizationId });
    return result.authorizationId;
}

async function row(id: string) {
    return getServiceTestDb().select().from(subscriptions).where(eq(subscriptions.id, id));
}

describe('TEST:B11:2 unknown authorization relinking', () => {
    it('TEST:B11:2 relinks only the provider link and keeps the complete subscription row unchanged', async () => {
        const { fake, provider } = createReconciliationFake();
        const owned = await seedSubscription({ status: 'ACTIVE' });
        const before = (await row(owned.subscription.id))[0];
        const authorizationId = await authorize(fake, owned.subscription.id);
        const correlationId = crypto.randomUUID();
        const result = await handleUnknownAuthorization(
            {
                authorizationId,
                arrival: { kind: 'AUTHORIZATION' },
                correlationId
            },
            { provider, clock: reconciliationClock }
        );
        expect(result).toEqual({ outcome: 'RELINKED', subscriptionId: owned.subscription.id });
        expect((await row(owned.subscription.id))[0]).toEqual(before);
        expect(
            await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, owned.subscription.id))
        ).toHaveLength(1);
        expect(
            await reconciliationMarkModel.listOpen({
                subject: { kind: 'SUBSCRIPTION', subscriptionId: owned.subscription.id }
            })
        ).toHaveLength(0);
        expect(
            (await domainEventModel.findByCorrelationId({ correlationId })).filter(
                (event) => event.eventType === 'reconciliation.mark_opened'
            )
        ).toHaveLength(0);
    });

    it('TEST:B11:2 marks an already linked named row; a charge hangs once through the injected port', async () => {
        const { fake, provider } = createReconciliationFake();
        const owned = await seedSubscription({ status: 'ACTIVE', withLink: true, fake });
        const linkInsert = vi.spyOn(reconciliationInventoryModel, 'insertProviderLink');
        const authorizationId = await authorize(fake, owned.subscription.id);
        const authCorrelationId = crypto.randomUUID();
        const authorizationResult = await handleUnknownAuthorization(
            {
                authorizationId,
                arrival: { kind: 'AUTHORIZATION' },
                correlationId: authCorrelationId
            },
            { provider, clock: reconciliationClock }
        );
        expect(authorizationResult).toMatchObject({
            outcome: 'MARKED',
            subscriptionId: owned.subscription.id,
            reason: 'TRANSICION_NO_DECLARADA'
        });
        expect(
            (
                await domainEventModel.findByCorrelationId({ correlationId: authCorrelationId })
            ).filter((event) => event.eventType === 'reconciliation.mark_opened')
        ).toHaveLength(1);

        const secondId = await authorize(fake, owned.subscription.id);
        const payment = { source: 'PAYMENT' as const, id: crypto.randomUUID() };
        const hang = vi.fn(async () => {});
        const chargeCorrelationId = crypto.randomUUID();
        const marks = await handleUnknownAuthorization(
            {
                authorizationId: secondId,
                arrival: { kind: 'CHARGE', chargeId: `charge-${crypto.randomUUID()}`, payment },
                correlationId: chargeCorrelationId
            },
            {
                provider,
                clock: reconciliationClock,
                markPayments: { hang, countUnresolved: async () => 0 }
            }
        );
        expect(marks).toMatchObject({
            outcome: 'MARKED',
            subscriptionId: owned.subscription.id,
            reason: 'PAGO_TARDIO_RECHAZADO'
        });
        expect(hang).toHaveBeenCalledTimes(1);
        expect(
            (
                await domainEventModel.findByCorrelationId({ correlationId: chargeCorrelationId })
            ).filter((event) => event.eventType === 'reconciliation.mark_opened')
        ).toHaveLength(1);
        expect(linkInsert).not.toHaveBeenCalled();
        expect(
            await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, owned.subscription.id))
        ).toHaveLength(1);
    });

    it('TEST:B11:2 writes a marked receipt tombstone for an unowned authorization, and a charged one for an unowned charge (HOS-1603)', async () => {
        const { fake, provider } = createReconciliationFake();
        const correlationId = crypto.randomUUID();
        const cancel = vi.spyOn(fake, 'cancel');
        const authId = await authorize(fake, 'legacy-reference');
        const result = await handleUnknownAuthorization(
            {
                authorizationId: authId,
                arrival: { kind: 'AUTHORIZATION' },
                correlationId
            },
            { provider, clock: reconciliationClock }
        );
        expect(result).toMatchObject({
            outcome: 'MARKED',
            tombstone: true,
            reason: 'TRANSICION_NO_DECLARADA'
        });
        if (result.outcome !== 'MARKED') throw new Error('Expected marked tombstone');
        const [tombstone] = await row(result.subscriptionId);
        expect(tombstone).toMatchObject({
            class: 'LAPIDA',
            status: 'CANCELLED',
            userId: null,
            planVersionId: null,
            billingOptionId: null
        });
        expect(cancel).toHaveBeenCalledTimes(1);

        const missingUuidReference = crypto.randomUUID();
        const uuidOrphanId = await authorize(fake, missingUuidReference);
        const uuidOrphan = await handleUnknownAuthorization(
            {
                authorizationId: uuidOrphanId,
                arrival: { kind: 'AUTHORIZATION' },
                correlationId: crypto.randomUUID()
            },
            { provider, clock: reconciliationClock }
        );
        expect(uuidOrphan).toMatchObject({
            outcome: 'MARKED',
            tombstone: true,
            reason: 'TRANSICION_NO_DECLARADA'
        });

        const noRowId = await authorize(fake, crypto.randomUUID());
        const { chargeId } = await fake.charge({
            authorizationId: noRowId,
            amount: { amountMinor: 250000, currency: 'ARS' },
            reference: 'unowned charge'
        });
        const chargeCorrelationId = crypto.randomUUID();
        const charged = await handleUnknownAuthorization(
            {
                authorizationId: noRowId,
                arrival: { kind: 'CHARGE', chargeId },
                correlationId: chargeCorrelationId
            },
            { provider, clock: reconciliationClock }
        );
        expect(charged).toMatchObject({
            outcome: 'MARKED',
            tombstone: true,
            reason: 'PAGO_TARDIO_RECHAZADO',
            cancellation: 'CONFIRMED'
        });
        expect(charged).not.toHaveProperty('credit');
        if (charged.outcome !== 'MARKED') throw new Error('Expected a charged tombstone');
        const [chargedTombstone] = await row(charged.subscriptionId);
        expect(chargedTombstone).toMatchObject({ class: 'LAPIDA', status: 'CANCELLED' });
        expect(
            await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.subscriptionId, charged.subscriptionId))
        ).toMatchObject([{ id: charged.paymentId, status: 'PENDING', providerFactId: chargeId }]);
        expect(
            (
                await domainEventModel.findByCorrelationId({ correlationId: chargeCorrelationId })
            ).filter((event) => event.eventType === 'reconciliation.mark_opened')
        ).toHaveLength(1);
        expect(cancel).toHaveBeenCalledTimes(3);
    });

    it('TEST:B11:2 is idempotent and serializes concurrent notices for a row without a link', async () => {
        const { fake, provider } = createReconciliationFake();
        const owned = await seedSubscription({ status: 'ABANDONED' });
        const authorizationId = await authorize(fake, owned.subscription.id);
        const linkInsert = vi.spyOn(reconciliationInventoryModel, 'insertProviderLink');
        const results = await Promise.all(
            Array.from({ length: 5 }, () =>
                handleUnknownAuthorization(
                    {
                        authorizationId,
                        arrival: { kind: 'AUTHORIZATION' },
                        correlationId: crypto.randomUUID()
                    },
                    { provider, clock: reconciliationClock }
                )
            )
        );
        expect(results.filter((result) => result.outcome === 'RELINKED')).toHaveLength(1);
        expect(results.filter((result) => result.outcome === 'KNOWN')).toHaveLength(4);
        expect(linkInsert).toHaveBeenCalledTimes(1);
        expect(
            await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, owned.subscription.id))
        ).toHaveLength(1);
    });
});
