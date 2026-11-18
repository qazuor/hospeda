/**
 * HOS-1512 (fourth review): id-targeted writes only on this run's own objects (N1), exact body
 * shapes (N2), the authorized amount EXACT at run level (N3), write keys and lost answers (n4),
 * headers and queries (n5) and amounts of pesos and cents (n6).
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    type JsonValue,
    runWatchBattery,
    type WatchAuthorization,
    type WatchEntry,
    type WatchTransport,
    watchWriteKey
} from '../src/battery/index';
import { memoryRunStore } from './watch-battery-fixtures';

const NOW = new Date('2026-11-17T12:00:00.000Z');
const CAP = 150000;

interface Sent {
    method: string;
    path: string;
    body: unknown;
    headers: Readonly<Record<string, string>> | undefined;
}

function provider(
    args: {
        readonly account?: 'sandbox' | 'production';
        readonly onWrite?: (sent: Sent) => { status: number; body: unknown } | Error | undefined;
    } = {}
) {
    const sent: Sent[] = [];
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
            return {
                status: 200,
                body:
                    (args.account ?? 'sandbox') === 'sandbox'
                        ? { id: 900000001, tags: ['test_user'] }
                        : { id: 100000001, tags: ['normal'] }
            };
        }
        if (request.method === 'GET') return { status: 200, body: {} };
        const custom = args.onWrite?.(record);
        if (custom instanceof Error) throw custom;
        if (custom) return custom;
        counter += 1;
        return { status: 201, body: { id: `obj-${counter}` } };
    };
    return { transport, sent, writes: () => sent.filter((entry) => entry.method !== 'GET') };
}

const PREAPPROVAL = {
    reason: 'watch',
    external_reference: 'x',
    back_url: 'https://hospeda.test/return',
    auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 1500,
        currency_id: 'ARS'
    }
};

function money(
    id: string,
    measure: WatchEntry['measure'],
    maxChargeMinor: number = CAP
): WatchEntry {
    return {
        id,
        accounts: ['sandbox', 'production'],
        effect: 'moves-money',
        maxChargeMinor,
        expected: 'done',
        measure
    };
}

async function run(args: {
    readonly catalog: readonly WatchEntry[];
    readonly transport: WatchTransport;
    readonly store?: ReturnType<typeof memoryRunStore>;
    readonly account?: 'sandbox' | 'production';
    readonly authorization?: WatchAuthorization | null;
}) {
    const store = args.store ?? memoryRunStore();
    const account = args.account ?? 'sandbox';
    const result = await runWatchBattery({
        account,
        catalog: args.catalog,
        transport: args.transport,
        authorization:
            args.authorization === undefined
                ? { month: '2026-11', maxChargeMinor: CAP, accountId: '100000001' }
                : args.authorization,
        clock: createAdjustableClock({ start: NOW }),
        ...store.ports
    });
    return { ...result, store };
}

const idOf = (response: { body: unknown }): string =>
    String((response.body as { id?: unknown }).id);

describe('N1: an id-targeted write acts only on an object THIS RUN created', () => {
    it.each([
        [
            'cancelling a preapproval',
            'PUT',
            '/preapproval/real-customer-1',
            { status: 'cancelled' },
            0
        ],
        ['pausing a preapproval', 'PUT', '/preapproval/real-customer-1', { status: 'paused' }, 0],
        [
            're-pricing a preapproval',
            'PUT',
            '/preapproval/real-customer-1',
            { auto_recurring: { transaction_amount: 1, currency_id: 'ARS' } },
            100
        ]
    ] as const)('refuses %s on a foreign id, sending nothing', async (_name, method, path, body, chargeMinor) => {
        const { transport, writes } = provider();
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    await ctx.send({ label: 'x', request: { method, path, body }, chargeMinor });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('TARGET_NOT_CREATED_BY_RUN');
        expect(writes()).toEqual([]);
    });

    it('refuses a payment refund and an order refund on a foreign id', async () => {
        for (const [path, body] of [
            ['/v1/payments/real-payment-1/refunds', { amount: 1 }],
            ['/v1/orders/real-order-1/refund', { transactions: [{ id: 't', amount: '1.00' }] }]
        ] as const) {
            const { transport, writes } = provider();
            const result = await run({
                catalog: [
                    money('M1', async (ctx): Promise<JsonValue> => {
                        await ctx.send({
                            label: 'x',
                            request: { method: 'POST', path, body },
                            refundMinor: 100
                        });
                        return 'done';
                    })
                ],
                transport
            });
            expect(result.run.reason).toContain('TARGET_NOT_CREATED_BY_RUN');
            expect(writes()).toEqual([]);
        }
    });

    it('allows the same writes on an object this run created', async () => {
        const { transport, writes } = provider();
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    const made = await ctx.send({
                        label: 'create',
                        request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                        chargeMinor: CAP
                    });
                    const id = idOf(made);
                    await ctx.send({
                        label: 'pause',
                        request: {
                            method: 'PUT',
                            path: `/preapproval/${id}`,
                            body: { status: 'paused' }
                        },
                        chargeMinor: 0
                    });
                    await ctx.send({
                        label: 'cancel',
                        request: {
                            method: 'PUT',
                            path: `/preapproval/${id}`,
                            body: { status: 'cancelled' }
                        }
                    });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('completed');
        expect(writes()).toHaveLength(3);
    });

    const chargeThenRefund = (amounts: readonly number[], charged = 150000) =>
        money('M1', async (ctx): Promise<JsonValue> => {
            const made = await ctx.send({
                label: 'charge',
                request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                chargeMinor: charged
            });
            for (const [index, minor] of amounts.entries()) {
                await ctx.send({
                    label: `refund-${index}`,
                    request: {
                        method: 'POST',
                        path: `/v1/payments/${idOf(made)}/refunds`,
                        body: { amount: minor / 100 }
                    },
                    refundMinor: minor
                });
            }
            return 'done';
        });

    it('refuses a refund above what this run charged on that same id', async () => {
        const { transport, writes } = provider();
        const result = await run({ catalog: [chargeThenRefund([150100])], transport });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('BUDGET_EXCEEDED');
        expect(writes()).toHaveLength(1);
    });

    it('caps refunds cumulatively on one id, and lets them reach what was charged', async () => {
        const ok = await run({
            catalog: [chargeThenRefund([100000, 50000])],
            transport: provider().transport
        });
        expect(ok.run.outcome).toBe('completed');
        expect(ok.run.ledger).toEqual({ charged: 150000, refunded: 150000 });
        const over = await run({
            catalog: [chargeThenRefund([100000, 50001])],
            transport: provider().transport
        });
        expect(over.run.reason).toContain('BUDGET_EXCEEDED');
    });

    it('refunds an order only up to what the run charged on that order', async () => {
        const { transport } = provider();
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    const made = await ctx.send({
                        label: 'order',
                        request: {
                            method: 'POST',
                            path: '/v1/orders',
                            body: {
                                type: 'online',
                                total_amount: '1500.00',
                                processing_mode: 'automatic',
                                transactions: { payments: [{ amount: '1500.00' }] }
                            }
                        },
                        chargeMinor: CAP
                    });
                    await ctx.send({
                        label: 'refund',
                        request: {
                            method: 'POST',
                            path: `/v1/orders/${idOf(made)}/refund`,
                            body: { transactions: [{ id: 't1', amount: '1500.01' }] }
                        },
                        refundMinor: 150001
                    });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.reason).toContain('BUDGET_EXCEEDED');
    });
});

describe('N2: a charge carries exactly the keys its rule allows', () => {
    const attempt = async (path: string, body: unknown, chargeMinor = CAP) => {
        const { transport, writes } = provider();
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    await ctx.send({
                        label: 'x',
                        request: { method: 'POST', path, body },
                        chargeMinor
                    });
                    return 'done';
                })
            ],
            transport
        });
        return { result, writes };
    };

    it('accepts the body the adapter sends', async () => {
        const { result } = await attempt('/preapproval', PREAPPROVAL);
        expect(result.run.outcome).toBe('completed');
    });

    it.each([
        ['an extra top-level key', { ...PREAPPROVAL, status: 'authorized' }],
        [
            'an extra nested key',
            { ...PREAPPROVAL, auto_recurring: { ...PREAPPROVAL.auto_recurring, repetitions: 1 } }
        ],
        ['a plan id, which charges the plan price', { reason: 'x', preapproval_plan_id: 'plan-1' }],
        ['a plan id next to an amount', { ...PREAPPROVAL, preapproval_plan_id: 'plan-1' }],
        [
            'a start date, which makes the provider grant a free trial',
            {
                ...PREAPPROVAL,
                auto_recurring: {
                    ...PREAPPROVAL.auto_recurring,
                    start_date: '2027-01-01T00:00:00.000Z'
                }
            }
        ],
        [
            'a frequency type other than months',
            {
                ...PREAPPROVAL,
                auto_recurring: { ...PREAPPROVAL.auto_recurring, frequency_type: 'days' }
            }
        ],
        [
            'a currency other than ARS',
            {
                ...PREAPPROVAL,
                auto_recurring: { ...PREAPPROVAL.auto_recurring, currency_id: 'USD' }
            }
        ]
    ])('refuses a preapproval with %s, sending nothing', async (_name, body) => {
        const { result, writes } = await attempt('/preapproval', body);
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toMatch(/OPERATION_NOT_ALLOWED|CHARGE_MISMATCH/);
        expect(writes()).toEqual([]);
    });

    it.each([
        ['an extra key', { transaction_amount: 1500, capture: false }],
        ['a held capture', { transaction_amount: 1500, capture: true }],
        ['an extra payer key', { transaction_amount: 1500, payer: { email: 'a@b.test', id: '1' } }],
        ['installments: 12', { transaction_amount: 1500, installments: 12 }],
        ['installments: 2', { transaction_amount: 1500, installments: 2 }]
    ])('refuses a payment with %s', async (_name, body) => {
        const { result, writes } = await attempt('/v1/payments', body);
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toMatch(/OPERATION_NOT_ALLOWED/);
        expect(writes()).toEqual([]);
    });

    it('accepts a payment with installments pinned to 1', async () => {
        const { result } = await attempt('/v1/payments', {
            transaction_amount: 1500,
            installments: 1,
            payer: { email: 'a@b.test' }
        });
        expect(result.run.outcome).toBe('completed');
    });

    it.each([
        [
            'an extra key',
            {
                total_amount: '1500.00',
                transactions: { payments: [{ amount: '1500.00' }] },
                expiration_time: 'P1D'
            }
        ],
        [
            'an extra payment key',
            {
                total_amount: '1500.00',
                transactions: { payments: [{ amount: '1500.00', capture: false }] }
            }
        ],
        [
            'installments: 12',
            {
                total_amount: '1500.00',
                transactions: {
                    payments: [{ amount: '1500.00', payment_method: { installments: 12 } }]
                }
            }
        ],
        [
            'a manual processing mode',
            {
                total_amount: '1500.00',
                processing_mode: 'manual',
                transactions: { payments: [{ amount: '1500.00' }] }
            }
        ]
    ])('refuses an order with %s', async (_name, body) => {
        const { result, writes } = await attempt('/v1/orders', body);
        expect(result.run.outcome).toBe('aborted');
        expect(writes()).toEqual([]);
    });

    it('refuses a change of amount that carries anything else', async () => {
        const { transport, writes } = provider();
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    const made = await ctx.send({
                        label: 'create',
                        request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                        chargeMinor: CAP
                    });
                    await ctx.send({
                        label: 'reprice',
                        request: {
                            method: 'PUT',
                            path: `/preapproval/${idOf(made)}`,
                            body: {
                                auto_recurring: {
                                    transaction_amount: 1500,
                                    currency_id: 'ARS',
                                    repetitions: 2
                                }
                            }
                        },
                        chargeMinor: CAP
                    });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('aborted');
        expect(writes()).toHaveLength(1);
    });
});

describe('N3: the authorized amount equals the sum of the money-moving measurements, exactly', () => {
    const production = (
        sums: readonly number[],
        authorizedMinor: number,
        store = memoryRunStore()
    ) => {
        const { transport, sent } = provider({ account: 'production' });
        const catalog = sums.map((max, index) => money(`RP${index + 1}`, async () => 'done', max));
        return {
            sent,
            store,
            go: () =>
                run({
                    catalog,
                    transport,
                    store,
                    account: 'production',
                    authorization: {
                        month: '2026-11',
                        maxChargeMinor: authorizedMinor,
                        accountId: '100000001'
                    }
                })
        };
    };

    it('runs when the amount equals the sum of the measurements', async () => {
        const { go, store } = production([50000, 100000], 150000);
        const result = await go();
        expect(result.run.outcome).toBe('completed');
        expect(store.consumedBy()).toBe(result.runId);
    });

    it('refuses an authorization ABOVE the sum, naming both numbers, and does not consume it', async () => {
        const { go, store, sent } = production([50000, 50000], 150000);
        const result = await go();
        expect(result.run.outcome).toBe('refused');
        expect(result.run.reason).toContain('AUTHORIZATION_SUM_MISMATCH');
        expect(result.run.reason).toContain('150000');
        expect(result.run.reason).toContain('100000');
        expect(store.consumedBy()).toBeUndefined();
        expect(store.started[0]?.consume).toBeUndefined();
        expect(sent).toEqual([]);
    });

    it('refuses an authorization BELOW the sum, and does not consume it', async () => {
        const { go, store } = production([100000, 100000], 150000);
        const result = await go();
        expect(result.run.outcome).toBe('refused');
        expect(result.run.reason).toContain('AUTHORIZATION_SUM_MISMATCH');
        expect(result.run.reason).toContain('200000');
        expect(store.consumedBy()).toBeUndefined();
    });

    it('refuses a production authorization when the catalog has no money-moving measurement', async () => {
        const { go, store } = production([], 150000);
        const result = await go();
        expect(result.run.outcome).toBe('refused');
        expect(result.run.reason).toContain('add up to 0');
        expect(store.consumedBy()).toBeUndefined();
    });

    it('does not apply the exact-sum rule to a sandbox run, which consumes nothing', async () => {
        const { transport } = provider();
        const result = await run({
            catalog: [money('RP1', async () => 'done', 100000)],
            transport,
            authorization: { month: '2026-11', maxChargeMinor: 150000, accountId: '1' }
        });
        expect(result.run.outcome).toBe('completed');
    });
});

describe('n4: every money write carries a key recorded before it is sent, and a lost answer stops the run', () => {
    it('stamps the key as the external_reference and the idempotency header, and records it BEFORE sending', async () => {
        const order: string[] = [];
        const store = memoryRunStore();
        const base = store.ports.recordProgress;
        const { transport, writes } = provider({
            onWrite: () => {
                order.push('sent');
                return undefined;
            }
        });
        const result = await runWatchBattery({
            account: 'sandbox',
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    await ctx.send({
                        label: 'create',
                        request: {
                            method: 'POST',
                            path: '/preapproval',
                            body: PREAPPROVAL,
                            headers: { 'x-idempotency-key': 'chosen-by-the-measurement' }
                        },
                        chargeMinor: CAP
                    });
                    return 'done';
                })
            ],
            transport,
            authorization: { month: '2026-11', maxChargeMinor: CAP, accountId: '1' },
            clock: createAdjustableClock({ start: NOW }),
            ...store.ports,
            recordProgress: async (progress) => {
                order.push(progress.writeKeys ? 'key-recorded' : 'id-recorded');
                await base(progress);
            }
        });
        expect(result.run.outcome).toBe('completed');
        const key = watchWriteKey({
            runId: result.runId,
            entryId: 'M1',
            label: 'create',
            sequence: 0
        });
        const [write] = writes();
        expect((write?.body as { external_reference: string }).external_reference).toBe(key);
        expect(write?.headers).toEqual({ 'X-Idempotency-Key': key });
        expect(order).toEqual(['key-recorded', 'sent', 'id-recorded']);
        expect(store.progress[0]).toMatchObject({ writeKeys: [key] });
    });

    it('derives distinct keys per run, measurement, label and repeat', () => {
        const keys = new Set([
            watchWriteKey({ runId: 'r1', entryId: 'M1', label: 'a', sequence: 0 }),
            watchWriteKey({ runId: 'r2', entryId: 'M1', label: 'a', sequence: 0 }),
            watchWriteKey({ runId: 'r1', entryId: 'M2', label: 'a', sequence: 0 }),
            watchWriteKey({ runId: 'r1', entryId: 'M1', label: 'b', sequence: 0 }),
            watchWriteKey({ runId: 'r1', entryId: 'M1', label: 'a', sequence: 1 })
        ]);
        expect(keys.size).toBe(5);
        for (const key of keys) expect(key.length).toBeLessThanOrEqual(64);
    });

    const charging = () =>
        money('M1', async (ctx): Promise<JsonValue> => {
            await ctx.send({
                label: 'create',
                request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                chargeMinor: CAP
            });
            await ctx.send({
                label: 'again',
                request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                chargeMinor: 0
            });
            return 'done';
        });

    it.each([
        ['the transport fails', () => new Error('socket hang up')],
        [
            'the answer is lost to an abort',
            () => Object.assign(new Error('aborted'), { name: 'AbortError' })
        ],
        ['the provider answers 502', () => ({ status: 502, body: {} })],
        ['the provider answers 504', () => ({ status: 504, body: undefined })],
        ['a 201 carries no id', () => ({ status: 201, body: { ok: true } })]
    ])('aborts the run, sending no further write, when %s', async (_name, answer) => {
        const { transport, writes } = provider({ onWrite: () => answer() });
        const result = await run({ catalog: [charging()], transport });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('WRITE_OUTCOME_UNKNOWN');
        expect(result.run.reason).toContain('hw-');
        expect(writes()).toHaveLength(1);
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('does not abort for a 4xx answer: the provider said no, and nothing was created', async () => {
        const { transport } = provider({
            onWrite: () => ({ status: 400, body: { message: 'declined' } })
        });
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    await ctx.send({
                        label: 'create',
                        request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                        chargeMinor: CAP
                    });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('completed');
    });

    it('aborts, sending nothing, when the key cannot be recorded first', async () => {
        const { transport, writes } = provider();
        const store = memoryRunStore();
        const result = await runWatchBattery({
            account: 'sandbox',
            catalog: [charging()],
            transport,
            authorization: { month: '2026-11', maxChargeMinor: CAP, accountId: '1' },
            clock: createAdjustableClock({ start: NOW }),
            ...store.ports,
            recordProgress: async () => {
                throw new Error('db down');
            }
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('PROGRESS_NOT_RECORDED');
        expect(writes()).toEqual([]);
    });
});

describe('n5: no query on a write, and request headers only from a short list', () => {
    const send = async (request: {
        method: 'GET' | 'POST';
        path: string;
        headers?: Record<string, string>;
    }) => {
        const { transport, sent } = provider();
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    await ctx.send({
                        label: 'x',
                        request: { ...request, body: request.method === 'POST' ? {} : undefined },
                        ...(request.method === 'POST' ? { chargeMinor: 0 } : {})
                    });
                    return 'done';
                })
            ],
            transport,
            authorization: { month: '2026-11', maxChargeMinor: CAP, accountId: '1' }
        });
        return { result, sent };
    };

    it.each(['/v1/customers?x=1', '/v1/customers?'])('refuses a write to %s', async (path) => {
        const { result, sent } = await send({ method: 'POST', path });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toMatch(/query string|PATH_REJECTED/);
        expect(sent.filter((entry) => entry.method !== 'GET')).toEqual([]);
    });

    it('still allows a query on a GET', async () => {
        const { result } = await send({
            method: 'GET',
            path: '/preapproval/search?payer_email=a%40b.test&limit=20'
        });
        expect(result.run.outcome).toBe('completed');
    });

    it.each([
        ['Authorization', 'Bearer stolen'],
        ['authorization', 'Bearer stolen'],
        ['AUTHORIZATION', 'Bearer stolen'],
        ['X-HTTP-Method-Override', 'DELETE'],
        ['x-http-method-override', 'DELETE'],
        ['X-Forwarded-Host', 'evil.host'],
        ['Cookie', 'a=b']
    ])('refuses the header %s, on a GET and on a write', async (name, value) => {
        for (const method of ['GET', 'POST'] as const) {
            const { result, sent } = await send({
                method,
                path: method === 'GET' ? '/preapproval/abc' : '/v1/customers',
                headers: { [name]: value }
            });
            expect(result.run.outcome).toBe('aborted');
            expect(result.run.reason).toContain('HEADER_REJECTED');
            expect(
                sent.filter((entry) => entry.method === method && entry.path !== '/users/me')
            ).toEqual([]);
        }
    });

    it('allows the idempotency header', async () => {
        const { result } = await send({
            method: 'POST',
            path: '/v1/customers',
            headers: { 'X-Idempotency-Key': 'k' }
        });
        expect(result.run.outcome).toBe('completed');
    });
});

describe('n6: amounts in pesos have at most two decimals, as numbers and as strings', () => {
    const attempt = async (path: string, body: unknown, chargeMinor: number) => {
        const { transport, writes } = provider();
        const result = await run({
            catalog: [
                money(
                    'M1',
                    async (ctx): Promise<JsonValue> => {
                        await ctx.send({
                            label: 'x',
                            request: { method: 'POST', path, body },
                            chargeMinor
                        });
                        return 'done';
                    },
                    10_000_000
                )
            ],
            transport,
            authorization: { month: '2026-11', maxChargeMinor: 10_000_000, accountId: '1' }
        });
        return { result, writes };
    };
    const payment = (amount: number | string) => ({ transaction_amount: amount });

    it.each([1.005, 0.001, 1500.999, 10.123])('refuses the number %s', async (amount) => {
        const { result, writes } = await attempt(
            '/v1/payments',
            payment(amount),
            Math.round(amount * 100)
        );
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('CHARGE_MISMATCH');
        expect(writes()).toEqual([]);
    });

    it.each([
        '1.005',
        '10.123',
        '1500.',
        '.5',
        '1e3',
        '-1',
        '1,50',
        ' 1.00',
        '0x10'
    ])('refuses the string %j', async (amount) => {
        const { result, writes } = await attempt(
            '/v1/orders',
            { total_amount: amount, transactions: { payments: [{ amount }] } },
            100
        );
        expect(result.run.outcome).toBe('aborted');
        expect(writes()).toEqual([]);
    });

    it.each([
        [1500, 150000],
        [1500.1, 150010],
        [0.01, 1],
        [19.99, 1999],
        [0.07, 7]
    ])('accepts the number %s as %s minor units', async (amount, minor) => {
        const { result } = await attempt('/v1/payments', payment(amount), minor);
        expect(result.run.outcome).toBe('completed');
    });

    it.each([
        ['10.5', 1050],
        ['10.50', 1050],
        ['0.01', 1],
        ['1500', 150000]
    ])('accepts the string %j as %s minor units', async (amount, minor) => {
        const { result } = await attempt(
            '/v1/orders',
            { total_amount: amount, transactions: { payments: [{ amount }] } },
            minor
        );
        expect(result.run.outcome).toBe('completed');
    });
});

describe('F2: a definitive 4xx releases its reservation, an unknown outcome keeps it', () => {
    const refundPath = /\/v1\/payments\/[^/]+\/refunds$/;
    const refunder = (attempts: number) =>
        money('M1', async (ctx): Promise<JsonValue> => {
            const made = await ctx.send({
                label: 'charge',
                request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                chargeMinor: CAP
            });
            for (let index = 0; index < attempts; index += 1) {
                await ctx.send({
                    label: `refund-${index}`,
                    request: {
                        method: 'POST',
                        path: `/v1/payments/${idOf(made)}/refunds`,
                        body: { amount: 1500 }
                    },
                    refundMinor: CAP
                });
            }
            return 'done';
        });

    it('lets a refund be retried after the provider refused it with a 4xx, and books it once', async () => {
        let refunds = 0;
        const { transport, writes } = provider({
            onWrite: (sent) => {
                if (!refundPath.test(sent.path)) return undefined;
                refunds += 1;
                return refunds === 1
                    ? { status: 400, body: { message: 'refused' } }
                    : { status: 201, body: {} };
            }
        });
        const result = await run({ catalog: [refunder(2)], transport });
        expect(result.run.outcome).toBe('completed');
        expect(result.run.reason).toBeUndefined();
        expect(writes()).toHaveLength(3);
        expect(result.run.ledger).toEqual({ charged: CAP, refunded: CAP });
    });

    it('lets a charge be retried after a 4xx without passing the cap', async () => {
        let attempts = 0;
        const { transport } = provider({
            onWrite: () => {
                attempts += 1;
                return attempts === 1 ? { status: 422, body: { message: 'no' } } : undefined;
            }
        });
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    for (const label of ['first', 'second']) {
                        await ctx.send({
                            label,
                            request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                            chargeMinor: CAP
                        });
                    }
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('completed');
        expect(result.run.ledger).toEqual({ charged: CAP, refunded: 0 });
    });

    it('still holds the cap on the reserved amount before the answer arrives', async () => {
        const { transport } = provider();
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    for (const label of ['first', 'second']) {
                        await ctx.send({
                            label,
                            request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                            chargeMinor: CAP
                        });
                    }
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('BUDGET_EXCEEDED');
    });

    it.each([
        ['a 5xx', () => ({ status: 503, body: {} })],
        ['a lost answer', () => new Error('socket hang up')],
        ['a 2xx create without an id', () => ({ status: 201, body: {} })]
    ])('keeps the reservation on %s and aborts with WRITE_OUTCOME_UNKNOWN', async (_name, answer) => {
        const { transport } = provider({ onWrite: answer });
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    await ctx.send({
                        label: 'charge',
                        request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                        chargeMinor: CAP
                    });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('WRITE_OUTCOME_UNKNOWN');
        expect(result.run.ledger).toEqual({ charged: CAP, refunded: 0 });
    });
});

describe('F3: every progress record carries the ledger as it stands', () => {
    it('stores the reserved charge with its key, and the release with the refusal', async () => {
        const store = memoryRunStore();
        let refused = false;
        const { transport } = provider({
            onWrite: () => {
                if (refused) return undefined;
                refused = true;
                return { status: 400, body: {} };
            }
        });
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    for (const label of ['first', 'second']) {
                        await ctx.send({
                            label,
                            request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                            chargeMinor: CAP
                        });
                    }
                    return 'done';
                })
            ],
            transport,
            store
        });
        expect(result.run.outcome).toBe('completed');
        // key(first), release(first), key(second), id(second)
        expect(store.progress.map((entry) => entry.ledger)).toEqual([
            { charged: CAP, refunded: 0 },
            { charged: 0, refunded: 0 },
            { charged: CAP, refunded: 0 },
            { charged: CAP, refunded: 0 }
        ]);
        expect(store.progress[0]?.writeKeys).toHaveLength(1);
        expect(store.progress[1]?.writeKeys).toBeUndefined();
    });
});

describe('NIT 2: orders.create carries exactly one payment worth the total', () => {
    it('refuses several payments even when their amounts are equal', async () => {
        const { transport, writes } = provider();
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    await ctx.send({
                        label: 'order',
                        request: {
                            method: 'POST',
                            path: '/v1/orders',
                            body: {
                                total_amount: '1500.00',
                                transactions: {
                                    payments: [{ amount: '1500.00' }, { amount: '1500.00' }]
                                }
                            }
                        },
                        chargeMinor: CAP
                    });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('OPERATION_NOT_ALLOWED');
        expect(writes()).toEqual([]);
    });

    it('refuses an order with no payment', async () => {
        const { transport, writes } = provider();
        const result = await run({
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    await ctx.send({
                        label: 'order',
                        request: {
                            method: 'POST',
                            path: '/v1/orders',
                            body: { total_amount: '1500.00', transactions: { payments: [] } }
                        },
                        chargeMinor: CAP
                    });
                    return 'done';
                })
            ],
            transport
        });
        expect(result.run.outcome).toBe('aborted');
        expect(writes()).toEqual([]);
    });
});
