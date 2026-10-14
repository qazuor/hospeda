/**
 * TEST:B11:12 (support): the fake keeps one-time orders, read by id, and RP13
 * bounds their search (EX-57: both creation dates, at most 30 days, exact
 * reference). RP13 is a rule: turning it off is refused in
 * `fake-switches.test.ts` (the one test file G15 (b) does not read).
 */
import { createAdjustableClock } from '@repo/test-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import { FakePaymentProvider } from '../src/fake/index';
import { PaymentProviderError, type PaymentProviderErrorCode } from '../src/index';

const START = new Date('2026-10-01T03:00:00.000Z');
const DAY_MS = 86_400_000;
const iso = (ms: number) => new Date(START.getTime() + ms).toISOString();

let fake: FakePaymentProvider;
let clock: ReturnType<typeof createAdjustableClock>;

beforeEach(() => {
    clock = createAdjustableClock({ start: START });
    fake = new FakePaymentProvider({ clock });
});

async function codeOf({
    promise
}: {
    readonly promise: Promise<unknown>;
}): Promise<PaymentProviderErrorCode> {
    try {
        await promise;
    } catch (error) {
        if (error instanceof PaymentProviderError) return error.code;
        throw error;
    }
    throw new Error('expected a rejection');
}

describe('TEST:B11:12 (support) the fake keeps orders and RP13 bounds the search', () => {
    it('(a) a placed order reads by id with its instant and whether a payment was approved', async () => {
        const paid = fake.placeOrder({ reference: 'request-1', paid: true });
        const unpaid = fake.placeOrder({ reference: 'request-2', paid: false });

        const read = await fake.readOrder({ orderId: paid.orderId });

        expect(read.snapshot).toEqual({
            orderId: paid.orderId,
            reference: 'request-1',
            createdAt: START.toISOString(),
            hasApprovedPayment: true
        });
        expect(read.readAt).toEqual(clock.now());
        expect(
            (await fake.readOrder({ orderId: unpaid.orderId })).snapshot.hasApprovedPayment
        ).toBe(false);
    });

    it('(b) an unknown order id is NOT_FOUND', async () => {
        expect(await codeOf({ promise: fake.readOrder({ orderId: 'missing' }) })).toBe('NOT_FOUND');
    });

    it('(c) the search matches the exact reference, only inside the range', async () => {
        const inside = fake.placeOrder({ reference: 'request-x', paid: true });
        fake.placeOrder({ reference: 'request-x-other', paid: true });
        fake.placeOrder({ reference: 'request-x', createdAt: iso(20 * DAY_MS), paid: true });

        const found = await fake.searchOrders({
            reference: 'request-x',
            createdFrom: iso(-DAY_MS),
            createdTo: iso(DAY_MS)
        });
        const prefix = await fake.searchOrders({
            reference: 'request',
            createdFrom: iso(-DAY_MS),
            createdTo: iso(DAY_MS)
        });

        expect(found.orders.map((order) => order.orderId)).toEqual([inside.orderId]);
        expect(found.orders[0]).toEqual({
            orderId: inside.orderId,
            reference: 'request-x',
            createdAt: START.toISOString()
        });
        expect(prefix.orders).toEqual([]);
    });

    it('(d) RP13: more than 30 days or an inverted range is REJECTED; no dates is invalid input', async () => {
        fake.placeOrder({ reference: 'request-y', paid: true });

        expect(
            await codeOf({
                promise: fake.searchOrders({
                    reference: 'request-y',
                    createdFrom: iso(-DAY_MS),
                    createdTo: iso(30 * DAY_MS)
                })
            })
        ).toBe('REJECTED');
        expect(
            await codeOf({
                promise: fake.searchOrders({
                    reference: 'request-y',
                    createdFrom: iso(DAY_MS),
                    createdTo: iso(-DAY_MS)
                })
            })
        ).toBe('REJECTED');
        expect(
            await codeOf({
                promise: fake.searchOrders({ reference: 'request-y' } as unknown as Parameters<
                    FakePaymentProvider['searchOrders']
                >[0])
            })
        ).toBe('INVALID_INPUT');
        expect(
            (
                await fake.searchOrders({
                    reference: 'request-y',
                    createdFrom: iso(-DAY_MS),
                    createdTo: iso(29 * DAY_MS)
                })
            ).orders
        ).toHaveLength(1);
    });
});
