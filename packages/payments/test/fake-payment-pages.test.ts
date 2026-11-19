/**
 * HOS-2179 §7.3 (T-1): the fake's one-time payment pages and the rules measured in
 * sandbox on 2026-11-18. RP18: a page takes a second approved payment. RP19: an expired
 * page takes none, and its read carries no expired flag. EX-61 (the creation key) is
 * unmeasured, so the fake does not deduplicate by key.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import { FAKE_RULES, FakePaymentProvider, PAGE_DECLINE_REASON } from '../src/fake';
import type { OneTimePaymentInput } from '../src/index';

const START = new Date('2026-11-19T12:00:00.000Z');
const HOUR_MS = 60 * 60_000;

const input: OneTimePaymentInput = {
    reference: 'purchase-1',
    idempotencyKey: 'page:purchase-1',
    amount: { amountMinor: 1_250_000, currency: 'ARS' },
    reason: 'Destacado 7 días',
    returnUrl: 'https://hospeda.example/mi-cuenta/complementos/?compra=purchase-1',
    expiresAt: new Date(START.getTime() + HOUR_MS).toISOString()
};

function setup() {
    const clock = createAdjustableClock({ start: START });
    const fake = new FakePaymentProvider({ clock });
    const wholeRange = {
        reference: input.reference,
        createdFrom: START.toISOString(),
        createdTo: new Date(START.getTime() + 24 * HOUR_MS).toISOString()
    };
    return { clock, fake, wholeRange };
}

describe('the rows behind the pages', () => {
    it('lists RP18 and RP19 as provider rules measured in sandbox on 2026-11-18', () => {
        const rows = FAKE_RULES.filter((rule) => ['RP18', 'RP19'].includes(rule.id));
        expect(rows.map((rule) => rule.kind)).toEqual(['rule', 'rule']);
        for (const row of rows)
            expect(row.measured).toEqual([
                expect.objectContaining({ date: '2026-11-18', accounts: ['sandbox'] })
            ]);
    });
});

describe('opening and reading a page', () => {
    it('opens a page that moves no money and reads back only its dates (RP19)', async () => {
        // Arrange
        const { fake, wholeRange } = setup();

        // Act
        const page = await fake.requestOneTimePayment(input);
        const read = await fake.readOneTimePayment({ paymentPageId: page.paymentPageId });

        // Assert
        expect(page.expiresAt).toBe(input.expiresAt);
        expect(page.approvalUrl).toMatch(/^https:\/\//);
        expect(read.readAt).toEqual(START);
        expect(read.snapshot).toEqual({
            paymentPageId: page.paymentPageId,
            reference: input.reference,
            expiresAt: input.expiresAt,
            createdAt: START.toISOString()
        });
        expect((await fake.searchCharges(wholeRange)).chargeIds).toEqual([]);
        expect(fake.takeDeliveries().deliveries).toEqual([]);
    });

    it('opens another page for the same key: the key is not deduplicated (EX-61 unmeasured)', async () => {
        const { fake } = setup();
        const first = await fake.requestOneTimePayment(input);
        const second = await fake.requestOneTimePayment(input);
        expect(second.paymentPageId).not.toBe(first.paymentPageId);
    });

    it('refuses card data on the request (AC-2, §6.2)', async () => {
        const { fake } = setup();
        await expect(
            fake.requestOneTimePayment({ ...input, cardToken: 'x' } as OneTimePaymentInput)
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });

    it('can lose the answer after opening the page, when a test simulates it (§5.6)', async () => {
        const clock = createAdjustableClock({ start: START });
        const fake = new FakePaymentProvider({
            clock,
            simulate: [{ simulation: 'lostResponse', why: 'HOS-2179 §5.6 lost page creation' }]
        });
        await expect(fake.requestOneTimePayment(input)).rejects.toMatchObject({
            code: 'UNAVAILABLE'
        });
    });

    it('answers NOT_FOUND for an unknown page', async () => {
        const { fake } = setup();
        await expect(fake.readOneTimePayment({ paymentPageId: 'nope' })).rejects.toMatchObject({
            code: 'NOT_FOUND'
        });
    });
});

describe('paying on a page', () => {
    it('takes a second approved payment on the same page, each its own charge (RP18)', async () => {
        // Arrange
        const { fake, clock, wholeRange } = setup();
        const { paymentPageId } = await fake.requestOneTimePayment(input);

        // Act
        const first = fake.payOnPage({ paymentPageId, outcome: 'approved' });
        clock.advance({ ms: 60_000 });
        const second = fake.payOnPage({ paymentPageId, outcome: 'approved' });

        // Assert
        expect(second.chargeId).not.toBe(first.chargeId);
        expect((await fake.searchCharges(wholeRange)).chargeIds).toEqual([
            first.chargeId,
            second.chargeId
        ]);
        for (const { chargeId } of [first, second]) {
            const { snapshot } = await fake.readCharge({ chargeId });
            expect(snapshot).toMatchObject({
                status: 'approved',
                reference: input.reference,
                authorizationId: null,
                purpose: 'charge',
                amount: input.amount
            });
        }
        expect(fake.takeDeliveries().deliveries.length).toBeGreaterThanOrEqual(2);
    });

    it('keeps a rejected payment and lets the customer retry on the same page (AC-9)', async () => {
        const { fake, wholeRange } = setup();
        const { paymentPageId } = await fake.requestOneTimePayment(input);
        const rejected = fake.payOnPage({ paymentPageId, outcome: 'rejected' });
        const approved = fake.payOnPage({ paymentPageId, outcome: 'approved' });
        expect((await fake.readCharge({ chargeId: rejected.chargeId })).snapshot).toMatchObject({
            status: 'rejected',
            declineReason: PAGE_DECLINE_REASON
        });
        expect(approved).toMatchObject({ status: 'approved', returnUrl: input.returnUrl });
        expect((await fake.searchCharges(wholeRange)).chargeIds).toHaveLength(2);
    });

    it('refuses a payment once the page expired and creates nothing (RP19)', async () => {
        // Arrange
        const { fake, clock, wholeRange } = setup();
        const { paymentPageId } = await fake.requestOneTimePayment(input);
        clock.advance({ ms: HOUR_MS });

        // Act / Assert
        expect(() => fake.payOnPage({ paymentPageId, outcome: 'approved' })).toThrow(
            expect.objectContaining({ code: 'REJECTED' })
        );
        expect((await fake.searchCharges(wholeRange)).chargeIds).toEqual([]);
        expect(fake.takeDeliveries().deliveries).toEqual([]);
    });

    it('still takes a payment one millisecond before the expiry', async () => {
        const { fake, clock } = setup();
        const { paymentPageId } = await fake.requestOneTimePayment(input);
        clock.advance({ ms: HOUR_MS - 1 });
        expect(fake.payOnPage({ paymentPageId, outcome: 'approved' }).status).toBe('approved');
    });
});

describe('closing a page', () => {
    it('moves the expiry to now, so the page takes no more payments (§5.7)', async () => {
        // Arrange
        const { fake, clock } = setup();
        const { paymentPageId } = await fake.requestOneTimePayment(input);
        clock.advance({ ms: 10 * 60_000 });

        // Act
        const ack = await fake.closeOneTimePayment({ paymentPageId });

        // Assert
        expect(ack).toEqual({ accepted: true, resourceId: paymentPageId });
        expect((await fake.readOneTimePayment({ paymentPageId })).snapshot.expiresAt).toBe(
            clock.now().toISOString()
        );
        expect(() => fake.payOnPage({ paymentPageId, outcome: 'approved' })).toThrow(
            expect.objectContaining({ code: 'REJECTED' })
        );
    });

    it('keeps an earlier expiry when closed after it', async () => {
        const { fake, clock } = setup();
        const { paymentPageId } = await fake.requestOneTimePayment(input);
        clock.advance({ ms: 2 * HOUR_MS });
        await fake.closeOneTimePayment({ paymentPageId });
        expect((await fake.readOneTimePayment({ paymentPageId })).snapshot.expiresAt).toBe(
            input.expiresAt
        );
    });
});

describe('searching charges', () => {
    it('matches the reference exactly and bounds the range inclusively', async () => {
        // Arrange
        const { fake, clock } = setup();
        const one = await fake.requestOneTimePayment(input);
        const other = await fake.requestOneTimePayment({ ...input, reference: 'purchase-10' });
        const early = fake.payOnPage({ paymentPageId: one.paymentPageId, outcome: 'approved' });
        fake.payOnPage({ paymentPageId: other.paymentPageId, outcome: 'approved' });
        clock.advance({ ms: 30 * 60_000 });
        const late = fake.payOnPage({ paymentPageId: one.paymentPageId, outcome: 'approved' });

        // Act
        const exact = await fake.searchCharges({
            reference: 'purchase-1',
            createdFrom: START.toISOString(),
            createdTo: clock.now().toISOString()
        });
        const lateOnly = await fake.searchCharges({
            reference: 'purchase-1',
            createdFrom: new Date(START.getTime() + 1).toISOString(),
            createdTo: clock.now().toISOString()
        });

        // Assert
        expect(exact.chargeIds).toEqual([early.chargeId, late.chargeId]);
        expect(lateOnly.chargeIds).toEqual([late.chargeId]);
    });

    it('refuses a range that ends before it starts', async () => {
        const { fake } = setup();
        await expect(
            fake.searchCharges({
                reference: 'r',
                createdFrom: START.toISOString(),
                createdTo: new Date(START.getTime() - 1).toISOString()
            })
        ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    });
});
