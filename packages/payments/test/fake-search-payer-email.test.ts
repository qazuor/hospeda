import { type AdjustableClock, createAdjustableClock } from '@repo/test-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';
import { assertFreshForAct, PaymentProviderError, ProviderReadRejectedError } from '../src/index';

let clock: AdjustableClock;
const start = new Date('2026-10-01T03:00:00.000Z');
const request = {
    amount: { amountMinor: 180_000, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reason: 'Plan mensual',
    returnUrl: 'https://hospeda.test/return'
};

beforeEach(() => {
    clock = createAdjustableClock({ start });
});

describe('creation search payer email support', () => {
    it('filters exactly by payer while including unrelated references and ignoring case', async () => {
        const fake = new FakePaymentProvider({ clock });
        await fake.authorize({
            ...request,
            reference: 'other-reference',
            payerEmail: 'payer@example.test'
        });
        await fake.authorize({
            ...request,
            reference: 'target-reference',
            payerEmail: 'payer@example.test'
        });
        await fake.authorize({
            ...request,
            reference: 'target-reference',
            payerEmail: 'other@example.test'
        });

        const found = await fake.searchAuthorizations({ payerEmail: 'PAYER@EXAMPLE.TEST' });
        expect(found.authorizations.map(({ reference }) => reference)).toEqual([
            'other-reference',
            'target-reference'
        ]);
        expect(
            (await fake.searchAuthorizations({ payerEmail: 'missing@example.test' })).authorizations
        ).toEqual([]);
    });

    it('returns clock-based creation instants and grows them as the clock advances', async () => {
        const fake = new FakePaymentProvider({ clock });
        await fake.authorize({ ...request, reference: 'first', payerEmail: 'payer@example.test' });
        clock.advance({ ms: 1_000 });
        await fake.authorize({ ...request, reference: 'second', payerEmail: 'payer@example.test' });
        const results = await fake.searchAuthorizations({ payerEmail: 'payer@example.test' });
        expect(results.authorizations.map(({ createdAt }) => createdAt)).toEqual([
            start.toISOString(),
            new Date(start.getTime() + 1_000).toISOString()
        ]);
    });

    it('keeps the M4 even-position lie after filtering by payer and status', async () => {
        const fake = new FakePaymentProvider({ clock });
        for (const [i, payerEmail] of [
            'payer@example.test',
            'other@example.test',
            'payer@example.test',
            'payer@example.test',
            'payer@example.test'
        ].entries()) {
            await fake.authorize({ ...request, reference: `row-${i}`, payerEmail });
        }
        const result = await fake.searchAuthorizations({
            payerEmail: 'payer@example.test',
            status: 'pending'
        });
        expect(result.authorizations.map(({ reference }) => reference)).toEqual(['row-0', 'row-3']);

        const honest = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M4', why: 'verify exact payer search independently of M4' }]
        });
        await honest.authorize({ ...request, reference: 'one', payerEmail: 'payer@example.test' });
        await honest.authorize({ ...request, reference: 'two', payerEmail: 'payer@example.test' });
        expect(
            (
                await honest.searchAuthorizations({
                    payerEmail: 'payer@example.test',
                    status: 'pending'
                })
            ).authorizations
        ).toHaveLength(2);
    });

    it('rejects invalid email and refuses to treat a summary as a read', async () => {
        const fake = new FakePaymentProvider({ clock });
        await expect(fake.searchAuthorizations({ payerEmail: 'invalid' })).rejects.toBeInstanceOf(
            PaymentProviderError
        );
        await expect(fake.searchAuthorizations({ payerEmail: 'invalid' })).rejects.toMatchObject({
            code: 'INVALID_INPUT'
        });
        const summary = await fake.searchAuthorizations({ payerEmail: 'nobody@example.test' });
        expect(() => {
            assertFreshForAct({
                read: summary as never,
                act: { kind: 'decision', startedAt: clock.now() }
            });
        }).toThrow(ProviderReadRejectedError);
    });
});
