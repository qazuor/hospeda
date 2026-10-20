import {
    and,
    domainEventModel,
    eq,
    payments,
    providerLinks,
    RECONCILIATION_MARK_REASON_CATALOG
} from '@repo/db';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleUnknownAuthorization } from '../../../src/services/billing/reconciliation/handle-unknown-authorization.service.js';
import { closeServiceTestPool, getServiceTestDb } from './helpers.js';
import { reconciliationClock } from './reconciliation-sweep-fixtures.js';
import {
    createChargingFake,
    handleCharge,
    markOpenedEvents,
    tombstoneRows,
    unknownCharge
} from './reconciliation-tombstone-fixtures.js';

beforeAll(() => {
    getServiceTestDb();
});
afterAll(closeServiceTestPool);
beforeEach(() => vi.restoreAllMocks());

function tombstoneId(result: { readonly outcome: string; readonly subscriptionId: string }) {
    expect(result.outcome).toBe('MARKED');
    return result.subscriptionId;
}

async function expectChargeTombstone(input: {
    readonly subscriptionId: string;
    readonly authorizationId: string;
    readonly chargeId: string;
    readonly paymentId: string | undefined;
    readonly correlationId: string;
}) {
    const rows = await tombstoneRows(input.subscriptionId);
    expect(rows.subscription).toMatchObject({
        class: 'LAPIDA',
        status: 'CANCELLED',
        userId: null,
        vertical: null,
        planVersionId: null,
        billingOptionId: null,
        paymentMethod: null,
        succeedsId: null
    });
    expect(rows.links).toHaveLength(1);
    expect(rows.links[0]).toMatchObject({
        provider: 'MERCADO_PAGO',
        providerId: input.authorizationId
    });
    expect(rows.payments).toHaveLength(1);
    expect(rows.payments[0]).toMatchObject({
        id: input.paymentId,
        providerFactId: input.chargeId,
        amount: 250000,
        currency: 'ARS'
    });
    expect(rows.marks).toHaveLength(1);
    expect(rows.marks[0]).toMatchObject({ reason: 'PAGO_TARDIO_RECHAZADO', liftedAt: null });
    expect(rows.hung).toHaveLength(1);
    expect(rows.hung[0]).toMatchObject({ paymentId: input.paymentId, manualPaymentId: null });
    expect(await markOpenedEvents(input.correlationId)).toHaveLength(1);
    expect(RECONCILIATION_MARK_REASON_CATALOG.PAGO_TARDIO_RECHAZADO.defaultProposal).toBe('REFUND');
    return rows;
}

describe('TEST:B11:3 la lápida de recepción y el débito viejo', () => {
    it('TEST:B11:3 (a) a legacy debit writes a LAPIDA/CANCELLED tombstone with its payment and reason 7, and cancels its authorization once', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownCharge(fake);
        const cancel = vi.spyOn(fake, 'cancel');
        const { result, correlationId } = await handleCharge(
            { authorizationId, chargeId },
            { provider }
        );
        expect(result).toMatchObject({
            outcome: 'MARKED',
            reason: 'PAGO_TARDIO_RECHAZADO',
            tombstone: true,
            markOutcome: 'OPENED',
            cancellation: 'CONFIRMED',
            credit: { outcome: 'CREDITED', coverage: 'NOT_APPLICABLE' }
        });
        if (result.outcome !== 'MARKED') throw new Error('Expected a tombstone');
        await expectChargeTombstone({
            subscriptionId: result.subscriptionId,
            authorizationId,
            chargeId,
            paymentId: result.paymentId,
            correlationId
        });
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(cancel).toHaveBeenCalledWith({ authorizationId });
        expect((await fake.readAuthorization({ authorizationId })).snapshot.status).toBe(
            'cancelled'
        );
    });

    it('TEST:B11:3 (b) a UUID reference with no row writes the same tombstone and cancels', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownCharge(fake, {
            reference: crypto.randomUUID()
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const { result, correlationId } = await handleCharge(
            { authorizationId, chargeId },
            { provider }
        );
        expect(result).toMatchObject({ tombstone: true, cancellation: 'CONFIRMED' });
        if (result.outcome !== 'MARKED') throw new Error('Expected a tombstone');
        await expectChargeTombstone({
            subscriptionId: result.subscriptionId,
            authorizationId,
            chargeId,
            paymentId: result.paymentId,
            correlationId
        });
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('TEST:B11:3 (c) an authorization already cancelled at the provider gets the tombstone, payment and mark, and is not called', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownCharge(fake, {
            cancelledAfterCharge: true
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const { result, correlationId } = await handleCharge(
            { authorizationId, chargeId },
            { provider }
        );
        expect(result).toMatchObject({ tombstone: true, cancellation: 'ALREADY_CANCELLED' });
        if (result.outcome !== 'MARKED') throw new Error('Expected a tombstone');
        await expectChargeTombstone({
            subscriptionId: result.subscriptionId,
            authorizationId,
            chargeId,
            paymentId: result.paymentId,
            correlationId
        });
        expect(cancel).not.toHaveBeenCalled();
    });

    it('TEST:B11:3 (d) a failed cancel call leaves everything written, does not throw and reports CALL_FAILED', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownCharge(fake);
        const cancel = vi.spyOn(fake, 'cancel').mockRejectedValue(new Error('provider down'));
        const { result, correlationId } = await handleCharge(
            { authorizationId, chargeId },
            { provider }
        );
        expect(result).toMatchObject({ tombstone: true, cancellation: 'CALL_FAILED' });
        if (result.outcome !== 'MARKED') throw new Error('Expected a tombstone');
        await expectChargeTombstone({
            subscriptionId: result.subscriptionId,
            authorizationId,
            chargeId,
            paymentId: result.paymentId,
            correlationId
        });
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('TEST:B11:3 (e) an unowned AUTHORIZATION arrival now cancels once and keeps reason 6 without a payment', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId } = await fake.authorize({
            reference: `legacy-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'legacy authorization',
            returnUrl: 'https://example.test/return',
            payerEmail: `legacy-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId });
        const cancel = vi.spyOn(fake, 'cancel');
        const result = await handleUnknownAuthorization(
            {
                authorizationId,
                arrival: { kind: 'AUTHORIZATION' },
                correlationId: crypto.randomUUID()
            },
            { provider, clock: reconciliationClock }
        );
        expect(result).toMatchObject({
            reason: 'TRANSICION_NO_DECLARADA',
            tombstone: true,
            cancellation: 'CONFIRMED'
        });
        const rows = await tombstoneRows(tombstoneId(result));
        expect(rows.marks.map((mark) => mark.reason)).toEqual(['TRANSICION_NO_DECLARADA']);
        expect(rows.payments).toHaveLength(0);
        expect(rows.hung).toHaveLength(0);
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('TEST:B11:3 (f) a rejected charge is not a charge: reason 6, no payment, and the authorization is cancelled', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId } = await fake.authorize({
            reference: `legacy-${crypto.randomUUID()}`,
            amount: { amountMinor: 250000, currency: 'ARS' },
            cadence: { everyMonths: 1 },
            reason: 'legacy authorization',
            returnUrl: 'https://example.test/return',
            payerEmail: `legacy-${crypto.randomUUID()}@example.test`
        });
        await fake.approve({ authorizationId });
        const { chargeId } = await fake.declineCharge({
            authorizationId,
            declineReason: 'insufficient funds'
        });
        const cancel = vi.spyOn(fake, 'cancel');
        const { result } = await handleCharge({ authorizationId, chargeId }, { provider });
        expect(result).toMatchObject({ reason: 'TRANSICION_NO_DECLARADA', tombstone: true });
        expect(result).not.toHaveProperty('paymentId');
        const rows = await tombstoneRows(tombstoneId(result));
        expect(rows.marks.map((mark) => mark.reason)).toEqual(['TRANSICION_NO_DECLARADA']);
        expect(rows.payments).toHaveLength(0);
        expect(rows.hung).toHaveLength(0);
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('TEST:B11:3 (g) a charge of another authorization is refused with CHARGE_AUTHORIZATION_MISMATCH before any write', async () => {
        const { fake, provider } = createChargingFake();
        const first = await unknownCharge(fake);
        const second = await unknownCharge(fake);
        const cancel = vi.spyOn(fake, 'cancel');
        const correlationId = crypto.randomUUID();
        await expect(
            handleCharge(
                {
                    authorizationId: first.authorizationId,
                    chargeId: second.chargeId,
                    correlationId
                },
                { provider }
            )
        ).rejects.toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'CHARGE_AUTHORIZATION_MISMATCH'
        });
        const db = getServiceTestDb();
        expect(
            await db
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.providerId, first.authorizationId))
        ).toHaveLength(0);
        expect(
            await db
                .select()
                .from(payments)
                .where(
                    and(
                        eq(payments.provider, 'MERCADO_PAGO'),
                        eq(payments.providerFactId, second.chargeId)
                    )
                )
        ).toHaveLength(0);
        expect(await domainEventModel.findByCorrelationId({ correlationId })).toHaveLength(0);
        expect(cancel).not.toHaveBeenCalled();
    });

    it('TEST:B11:3 (h) the same notice twice answers KNOWN the second time, writes nothing more and cancels once', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownCharge(fake);
        const cancel = vi.spyOn(fake, 'cancel');
        const first = await handleCharge({ authorizationId, chargeId }, { provider });
        const subscriptionId = tombstoneId(first.result);
        const second = await handleCharge({ authorizationId, chargeId }, { provider });
        expect(second.result).toEqual({ outcome: 'KNOWN', subscriptionId });
        const rows = await tombstoneRows(subscriptionId);
        expect(rows.payments).toHaveLength(1);
        expect(rows.marks).toHaveLength(1);
        expect(rows.hung).toHaveLength(1);
        expect(await markOpenedEvents(second.correlationId)).toHaveLength(0);
        expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('TEST:B11:3 (i) three concurrent notices of the same unknown charge write one tombstone, link, payment and mark', async () => {
        const { fake, provider } = createChargingFake();
        const { authorizationId, chargeId } = await unknownCharge(fake);
        const cancel = vi.spyOn(fake, 'cancel');
        const results = await Promise.all(
            Array.from({ length: 3 }, () =>
                handleCharge({ authorizationId, chargeId }, { provider })
            )
        );
        const marked = results.filter(({ result }) => result.outcome === 'MARKED');
        const known = results.filter(({ result }) => result.outcome === 'KNOWN');
        expect(marked).toHaveLength(1);
        expect(known).toHaveLength(2);
        const subscriptionId = marked[0]!.result.subscriptionId;
        for (const { result } of known) expect(result.subscriptionId).toBe(subscriptionId);
        const links = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.providerId, authorizationId));
        expect(links).toHaveLength(1);
        const rows = await tombstoneRows(subscriptionId);
        expect(rows.payments).toHaveLength(1);
        expect(rows.marks).toHaveLength(1);
        expect(
            await getServiceTestDb()
                .select()
                .from(payments)
                .where(
                    and(
                        eq(payments.provider, 'MERCADO_PAGO'),
                        eq(payments.providerFactId, chargeId)
                    )
                )
        ).toHaveLength(1);
        expect(cancel).toHaveBeenCalledTimes(1);
    });
});
