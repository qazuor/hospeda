/**
 * Payloads come from `.hoja/contexto.md:§3` (raw approved sandbox capture) and
 * `§4` (production refund/link observations); the fixture is a byte-for-byte copy.
 */
import { readFileSync } from 'node:fs';
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';

type Payment = Record<string, any>;
const captured = JSON.parse(
    readFileSync(
        new URL('./fixtures/mercadopago-recurring-payment-2026-09-15.json', import.meta.url),
        'utf8'
    )
) as Payment;
const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00.000Z') });
function adapterFor(payment: Payment) {
    const paths: string[] = [];
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'test-token',
        fetch: async (input) => {
            paths.push(new URL(String(input)).pathname);
            return new Response(JSON.stringify(payment), {
                status: 200,
                headers: { 'content-type': 'application/json' }
            });
        }
    });
    return { adapter, paths };
}
function clonePayment(): Payment {
    return structuredClone(captured);
}

describe('TEST:1710:1 AC:1710:1 AC:1710:2 captured payment read', () => {
    it('TEST:1710:1 AC:1710:1 AC:1710:2 reads the captured payment into the complete snapshot', async () => {
        const { adapter, paths } = adapterFor(clonePayment());
        const { snapshot } = await adapter.readCharge({ chargeId: '178164117729' });
        expect(paths).toEqual(['/v1/payments/178164117729']);
        expect(snapshot).toEqual({
            chargeId: '178164117729',
            createdAt: '2026-09-15T11:28:02.000-04:00',
            expiresAt: null,
            purpose: 'charge',
            authorizationId: '747cc456534d495b8705027b96785387',
            reference: 'HOS-1352-reloj-20260915T152756Z-pausa-real',
            status: 'approved',
            declineReason: null,
            amount: { amountMinor: 200000, currency: 'ARS' },
            refundedAmount: { amountMinor: 0, currency: 'ARS' },
            chargedBack: false
        });
    });
});

describe('TEST:1710:2 AC:1710:1 authorization-link variants', () => {
    it('TEST:1710:2 AC:1710:1 resolves metadata, interaction, conflict, and absent links', async () => {
        const metadata = clonePayment();
        metadata.metadata = { preapproval_id: '6b293a9499d946f6ac159da7f8f4804e' };
        metadata.point_of_interaction = { type: 'SUBSCRIPTIONS' };
        expect(
            (await adapterFor(metadata).adapter.readCharge({ chargeId: 'x' })).snapshot
                .authorizationId
        ).toBe('6b293a9499d946f6ac159da7f8f4804e');
        const matching = clonePayment();
        matching.metadata = { preapproval_id: 'auth-x' };
        matching.point_of_interaction.transaction_data.subscription_id = 'auth-x';
        expect(
            (await adapterFor(matching).adapter.readCharge({ chargeId: 'x' })).snapshot
                .authorizationId
        ).toBe('auth-x');
        const conflict = clonePayment();
        conflict.metadata = { preapproval_id: 'auth-a' };
        conflict.point_of_interaction.transaction_data.subscription_id = 'auth-b';
        await expect(
            adapterFor(conflict).adapter.readCharge({ chargeId: 'x' })
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        const validation = clonePayment();
        Object.assign(validation, {
            transaction_amount: 0,
            external_reference: null,
            metadata: {},
            point_of_interaction: { type: 'UNSPECIFIED' },
            operation_type: 'card_validation'
        });
        const card = (await adapterFor(validation).adapter.readCharge({ chargeId: 'x' })).snapshot;
        expect(card.purpose).toBe('cardValidation');
        expect(card.authorizationId).toBeNull();
        expect(card.reference).toBeNull();
        const oldFake = clonePayment();
        Object.assign(oldFake, {
            preapproval_id: 'auth-x',
            metadata: {},
            point_of_interaction: { type: 'SUBSCRIPTIONS' }
        });
        expect(
            (await adapterFor(oldFake).adapter.readCharge({ chargeId: 'x' })).snapshot
                .authorizationId
        ).toBeNull();
        const empty = clonePayment();
        empty.metadata = {};
        empty.point_of_interaction.transaction_data.subscription_id = '';
        expect(
            (await adapterFor(empty).adapter.readCharge({ chargeId: 'x' })).snapshot.authorizationId
        ).toBeNull();
    });
});

describe('TEST:1710:3 AC:1710:2 refunded amount variants', () => {
    it('TEST:1710:3 AC:1710:2 maps refunds and fails closed for money-moving statuses', async () => {
        const full = clonePayment();
        Object.assign(full, {
            status: 'refunded',
            status_detail: 'refunded',
            transaction_amount: 15,
            transaction_amount_refunded: 15
        });
        const fullSnapshot = (await adapterFor(full).adapter.readCharge({ chargeId: 'x' }))
            .snapshot;
        expect(fullSnapshot.status).toBe('approved');
        expect(fullSnapshot.amount.amountMinor).toBe(1500);
        expect(fullSnapshot.refundedAmount.amountMinor).toBe(1500);
        const partial = clonePayment();
        Object.assign(partial, {
            status: 'approved',
            status_detail: 'partially_refunded',
            transaction_amount: 5000,
            transaction_amount_refunded: 100
        });
        expect(
            (await adapterFor(partial).adapter.readCharge({ chargeId: 'x' })).snapshot
                .refundedAmount.amountMinor
        ).toBe(10000);
        for (const status of ['approved', 'refunded']) {
            const missing = clonePayment();
            missing.status = status;
            delete missing.transaction_amount_refunded;
            await expect(
                adapterFor(missing).adapter.readCharge({ chargeId: 'x' })
            ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        }
        const rejected = clonePayment();
        Object.assign(rejected, { status: 'rejected', status_detail: 'cc_rejected_other_reason' });
        delete rejected.transaction_amount_refunded;
        const rejectedSnapshot = (await adapterFor(rejected).adapter.readCharge({ chargeId: 'x' }))
            .snapshot;
        expect(rejectedSnapshot.refundedAmount.amountMinor).toBe(0);
        expect(rejectedSnapshot.declineReason).toBe('cc_rejected_other_reason');
    });
});
