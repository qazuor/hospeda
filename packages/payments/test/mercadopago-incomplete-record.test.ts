import { readFileSync } from 'node:fs';
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { MercadoPagoPaymentProvider } from '../src/adapters/mercadopago/mercadopago-payment-provider';
import { PaymentProviderError } from '../src/provider/errors';

const clock = createAdjustableClock({ start: new Date('2026-10-01T00:00:00.000Z') });
const payment = JSON.parse(
    readFileSync(
        new URL('./fixtures/mercadopago-recurring-payment-2026-09-15.json', import.meta.url),
        'utf8'
    )
) as Record<string, unknown>;
const completeList = JSON.parse(
    readFileSync(
        new URL(
            './fixtures/mercadopago-authorized-payments-first-record-2026-09-15.json',
            import.meta.url
        ),
        'utf8'
    )
) as { paging: Record<string, unknown>; results: Record<string, unknown>[] };

// Staging measured results[0].id absent; this test removes only that observed field.
function listWithoutId(id: 'absent' | 'null' = 'absent') {
    const list = structuredClone(completeList);
    if (id === 'absent') delete list.results[0]?.id;
    else if (list.results[0]) list.results[0].id = null;
    return list;
}

function adapterForLists(lists: readonly unknown[], sleep = vi.fn(async (_ms: number) => {})) {
    let listCalls = 0;
    const paths: string[] = [];
    const adapter = new MercadoPagoPaymentProvider({
        clock,
        accessToken: 'unit-test-token',
        sleep,
        fetch: async (input) => {
            const url = new URL(String(input));
            paths.push(url.pathname);
            if (url.pathname === '/v1/payments/178164117729')
                return new Response(JSON.stringify(payment), { status: 200 });
            const body = lists[Math.min(listCalls, lists.length - 1)];
            listCalls += 1;
            return new Response(JSON.stringify(body), { status: 200 });
        }
    });
    return { adapter, paths, sleep, listCalls: () => listCalls };
}

async function providerFailure<T>(operation: Promise<T>): Promise<PaymentProviderError> {
    try {
        await operation;
    } catch (error) {
        if (error instanceof PaymentProviderError) return error;
        throw error;
    }
    throw new Error('Expected a PaymentProviderError');
}

describe('Mercado Pago incomplete charge records (TEST:1747:1, :2, :3, :5)', () => {
    it('TEST:1747:1 rereads the complete list and returns the normal charge snapshot', async () => {
        const context = adapterForLists([listWithoutId(), completeList]);
        const actual = await context.adapter.readCharge({ chargeId: '178164117729' });
        const expected = adapterForLists([completeList]);
        const expectedSnapshot = await expected.adapter.readCharge({ chargeId: '178164117729' });

        expect(actual).toEqual(expectedSnapshot);
        expect(context.sleep).toHaveBeenCalledExactlyOnceWith(500);
        expect(context.listCalls()).toBe(2);
    });

    it('TEST:1747:2 marks absent or null ids incomplete after both bounded rereads', async () => {
        for (const missingKind of ['absent', 'null'] as const) {
            const context = adapterForLists([
                listWithoutId(missingKind),
                listWithoutId(missingKind),
                listWithoutId(missingKind)
            ]);
            const error = await context.adapter
                .readCharge({ chargeId: '178164117729' })
                .catch((failure: unknown) => failure);

            expect(error).toBeInstanceOf(PaymentProviderError);
            expect(error).toMatchObject({
                code: 'UNAVAILABLE',
                capability: 'read',
                incompleteRead: true,
                message: expect.stringContaining('results.0.id')
            });
            expect(context.sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1000]);
            expect(context.listCalls()).toBe(3);
        }
    });

    it('TEST:1747:3 rereads listCharges and does not reread a complete record', async () => {
        const reread = adapterForLists([listWithoutId(), completeList]);
        await reread.adapter.listCharges({ authorizationId: '747cc456534d495b8705027b96785387' });
        expect(reread.listCalls()).toBe(2);
        expect(reread.sleep).toHaveBeenCalledExactlyOnceWith(500);

        const complete = adapterForLists([completeList]);
        await complete.adapter.listCharges({ authorizationId: '747cc456534d495b8705027b96785387' });
        expect(complete.listCalls()).toBe(1);
        expect(complete.sleep).not.toHaveBeenCalled();
    });

    it('TEST:1747:5 includes schema issue paths and preserves the ZodError cause', async () => {
        const malformed = structuredClone(completeList);
        malformed.paging.total = 'x';
        const adapter = adapterForLists([malformed]);
        const error = await providerFailure(
            adapter.adapter.listCharges({ authorizationId: '747cc456534d495b8705027b96785387' })
        );

        expect(error).toBeInstanceOf(PaymentProviderError);
        expect(error).toMatchObject({
            message: 'Mercado Pago returned an invalid response at paging.total',
            incompleteRead: false
        });
        expect(error.cause).toBeInstanceOf(ZodError);
    });
});
