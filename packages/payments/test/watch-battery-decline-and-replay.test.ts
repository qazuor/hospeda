/**
 * HOS-1512 PR 2, F4: an explicit replay resends a key this run already sent, verbatim, booking
 * nothing. G3 (a 402 to `orders.create` naming the failed order was a definitive decline) was
 * retired with the Orders rules (HOS-2179 T-7, owner decision 2026-11-20): an Orders write is now
 * unlisted and refused before it leaves.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    type JsonValue,
    runWatchBattery,
    type WatchEntry,
    type WatchTransport,
    watchWriteKey
} from '../src/battery/index';
import { memoryRunStore } from './watch-battery-fixtures';

const NOW = new Date('2026-11-17T12:00:00.000Z');
/** ARS 15.00, the provider's floor (PC-2, RP3), in centavos. */
const MINIMUM = 1500;

interface Sent {
    readonly method: string;
    readonly path: string;
    readonly body: unknown;
    readonly headers: Readonly<Record<string, string>> | undefined;
}

type Answer = { status: number; body: unknown } | Error | undefined;

function provider(args: { readonly onWrite?: (sent: Sent, index: number) => Answer } = {}) {
    const sent: Sent[] = [];
    let writes = 0;
    let counter = 0;
    const transport: WatchTransport = async (request) => {
        const record: Sent = {
            method: request.method,
            path: request.path,
            body: request.body,
            headers: request.headers
        };
        sent.push(record);
        if (request.path === '/users/me') {
            return { status: 200, body: { id: 900000001, tags: ['test_user'] } };
        }
        if (request.method === 'GET') return { status: 200, body: {} };
        const custom = args.onWrite?.(record, writes);
        writes += 1;
        if (custom instanceof Error) throw custom;
        if (custom) return custom;
        counter += 1;
        return { status: 201, body: { id: `obj-${counter}` } };
    };
    return { transport, writes: () => sent.filter((entry) => entry.method !== 'GET') };
}

/** A one-time payment as `payments.create` lists it: the amount in pesos, one installment. */
const PAYMENT = {
    transaction_amount: 15,
    description: 'watch',
    payment_method_id: 'visa',
    token: 'tok',
    installments: 1,
    payer: { email: 'test_user@testuser.com' }
};

const payment = (label: string) => ({
    label,
    request: { method: 'POST' as const, path: '/v1/payments', body: PAYMENT },
    chargeMinor: MINIMUM
});

function money(
    id: string,
    measure: WatchEntry['measure'],
    maxChargeMinor: number = MINIMUM
): WatchEntry {
    return {
        id,
        accounts: ['sandbox'],
        effect: 'moves-money',
        maxChargeMinor,
        expected: 'done',
        measure
    };
}

async function run(args: {
    readonly catalog: readonly WatchEntry[];
    readonly transport: WatchTransport;
    readonly cap?: number;
}) {
    const store = memoryRunStore();
    const result = await runWatchBattery({
        account: 'sandbox',
        catalog: args.catalog,
        transport: args.transport,
        authorization: { month: '2026-11', maxChargeMinor: args.cap ?? MINIMUM },
        clock: createAdjustableClock({ start: NOW }),
        ...store.ports
    });
    return { ...result, store };
}

describe('HOS-2179 T-7: an Orders write is no longer a listed operation', () => {
    it('refuses an order creation before it leaves, booking nothing', async () => {
        // Arrange
        const { transport, writes } = provider();

        // Act
        const result = await run({
            catalog: [
                money('RP19', async (ctx): Promise<JsonValue> => {
                    await ctx.send({
                        label: 'charge',
                        request: {
                            method: 'POST',
                            path: '/v1/orders',
                            body: { total_amount: '15.00' }
                        },
                        chargeMinor: MINIMUM
                    });
                    return 'done';
                })
            ],
            transport
        });

        // Assert
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('OPERATION_NOT_ALLOWED');
        expect(writes()).toEqual([]);
        expect(result.run.ledger).toEqual({ charged: 0, refunded: 0 });
    });
});

describe('F4: an explicit replay resends a key this run already sent, booking nothing', () => {
    it('resends the identical request with the same derived key and books it once', async () => {
        // Arrange: the provider answers the replay with the first object.
        const { transport, writes } = provider({
            onWrite: () => ({ status: 201, body: { id: 'PAY-1', status: 'approved' } })
        });

        // Act: the entry may charge the minimum ONCE; a booked replay would pass its cap.
        const result = await run({
            catalog: [
                money('RP17', async (ctx): Promise<JsonValue> => {
                    await ctx.send(payment('create'));
                    const again = await ctx.replay({ label: 'create-replay', of: 'create' });
                    return (again.body as { id: string }).id === 'PAY-1' ? 'done' : 'other';
                })
            ],
            transport
        });

        // Assert
        expect(result.run.outcome).toBe('completed');
        expect(result.run.ledger).toEqual({ charged: MINIMUM, refunded: 0 });
        const [first, replayed] = writes();
        expect(replayed).toEqual(first);
        const key = watchWriteKey({
            runId: result.runId,
            entryId: 'RP17',
            label: 'create',
            sequence: 0
        });
        expect(replayed?.headers?.['X-Idempotency-Key']).toBe(key);
        expect((replayed?.body as { external_reference?: string }).external_reference).toBe(key);
        expect(Object.keys(result.run.measurements.RP17?.shapes ?? {}).sort()).toEqual([
            'create',
            'create-replay'
        ]);
    });

    it('replays a refund without booking it again', async () => {
        const { transport, writes } = provider({
            onWrite: (sent) =>
                sent.path.endsWith('/refunds') ? { status: 201, body: { id: 'REF-1' } } : undefined
        });
        const result = await run({
            catalog: [
                money('RP18', async (ctx): Promise<JsonValue> => {
                    const made = await ctx.send(payment('create'));
                    const id = (made.body as { id: string }).id;
                    await ctx.send({
                        label: 'refund',
                        request: {
                            method: 'POST',
                            path: `/v1/payments/${id}/refunds`,
                            body: { amount: 15 }
                        },
                        refundMinor: MINIMUM
                    });
                    await ctx.replay({ label: 'refund-replay', of: 'refund' });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('completed');
        expect(writes()).toHaveLength(3);
        expect(result.run.ledger).toEqual({ charged: MINIMUM, refunded: MINIMUM });
    });

    it.each([
        ['a label never sent', 'nothing'],
        ['a non-money write', 'customer']
    ])('refuses to replay %s and sends nothing for it', async (_name, of) => {
        const { transport, writes } = provider();
        const result = await run({
            catalog: [
                money('RP17', async (ctx): Promise<JsonValue> => {
                    await ctx.send({
                        label: 'customer',
                        request: { method: 'POST', path: '/v1/customers', body: {} }
                    });
                    await ctx.replay({ label: 'replay', of });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('REPLAY_NOT_SENT');
        expect(writes()).toHaveLength(1);
    });

    it('refuses to replay a key another measurement sent', async () => {
        const { transport, writes } = provider();
        const result = await run({
            catalog: [
                money('RP17', async (ctx): Promise<JsonValue> => {
                    await ctx.send(payment('create'));
                    return 'done';
                }),
                {
                    id: 'RP18',
                    accounts: ['sandbox'],
                    effect: 'mutates',
                    expected: 'done',
                    measure: async (ctx): Promise<JsonValue> => {
                        await ctx.replay({ label: 'replay', of: 'create' });
                        return 'done';
                    }
                }
            ],
            transport
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('REPLAY_NOT_SENT');
        expect(writes()).toHaveLength(1);
    });

    it.each([
        ['another object', { status: 201, body: { id: 'PAY-2' } }],
        ['no id', { status: 201, body: {} }],
        ['a 5xx', { status: 503, body: {} }],
        ['a lost answer', new Error('socket hang up')]
    ] as const)('stops the run when the replay answers %s', async (_name, answer) => {
        const { transport } = provider({
            onWrite: (_sent, index) =>
                index === 0 ? { status: 201, body: { id: 'PAY-1' } } : answer
        });
        const result = await run({
            catalog: [
                money('RP17', async (ctx): Promise<JsonValue> => {
                    await ctx.send(payment('create'));
                    await ctx.replay({ label: 'create-replay', of: 'create' });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('WRITE_OUTCOME_UNKNOWN');
        expect(result.run.ledger).toEqual({ charged: MINIMUM, refunded: 0 });
    });

    it('records the unexpected object of a replay so a human can find it', async () => {
        const { transport } = provider({
            onWrite: (_sent, index) => ({ status: 201, body: { id: `PAY-${index + 1}` } })
        });
        const result = await run({
            catalog: [
                money('RP17', async (ctx): Promise<JsonValue> => {
                    await ctx.send(payment('create'));
                    await ctx.replay({ label: 'create-replay', of: 'create' });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.measurements.RP17?.providerIds).toEqual(['PAY-1', 'PAY-2']);
        expect(result.store.progress.flatMap((entry) => entry.providerIds ?? [])).toContain(
            'PAY-2'
        );
    });
});
