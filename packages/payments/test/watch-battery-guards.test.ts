/**
 * TEST:B1:19 (HOS-1512, AC:B1:20): the battery against the fake. The environment guard and
 * the budget guard stop a run before it sends what they protect; with the right account and
 * the exact maximum, the run goes through.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { afterEach, describe, expect, it } from 'vitest';
import {
    createWatchTransport,
    type JsonValue,
    runWatchBattery,
    type WatchAccount,
    type WatchAuthorization,
    type WatchEntry
} from '../src/battery/index';
import { FakePaymentProvider } from '../src/fake/index';
import {
    type FakeProviderAccount,
    type FakeProviderServer,
    startFakeProviderServer
} from '../src/fake-server';
import { memoryRunStore } from './watch-battery-fixtures';

const NOW = new Date('2026-11-17T12:00:00.000Z');
const AUTHORIZED = 150000;

let activeServer: FakeProviderServer | undefined;
afterEach(async () => {
    await activeServer?.close();
    activeServer = undefined;
});

async function fakeAs(account: FakeProviderAccount) {
    const clock = createAdjustableClock({ start: NOW });
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    activeServer = await startFakeProviderServer({ provider, clock, account });
    return {
        clock,
        server: activeServer,
        transport: createWatchTransport({ baseUrl: activeServer.url, accessToken: 'test-token' })
    };
}

const PREAPPROVAL = {
    reason: 'watch fixture',
    external_reference: 'watch-1',
    back_url: 'https://hospeda.test/return',
    auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: 1500,
        currency_id: 'ARS'
    }
} as const;

function entry(args: Partial<WatchEntry> & Pick<WatchEntry, 'effect'>): WatchEntry {
    return {
        id: 'M1',
        accounts: ['sandbox', 'production'],
        expected: 'created',
        measure: async (ctx) => {
            const money = args.effect === 'moves-money';
            const response = await ctx.send({
                label: 'create',
                request: money
                    ? { method: 'POST', path: '/preapproval', body: PREAPPROVAL }
                    : { method: 'POST', path: '/v1/customers', body: { email: 'a@example.test' } },
                ...(money ? { chargeMinor: AUTHORIZED } : {})
            });
            return response.status === 201 || !money ? 'created' : 'not created';
        },
        ...args
    };
}

async function run(args: {
    readonly account: WatchAccount;
    readonly catalog: readonly WatchEntry[];
    readonly transport: ReturnType<typeof createWatchTransport>;
    readonly clock: ReturnType<typeof createAdjustableClock>;
    readonly authorization?: WatchAuthorization | null;
}) {
    const store = memoryRunStore();
    const result = await runWatchBattery({
        account: args.account,
        catalog: args.catalog,
        transport: args.transport,
        authorization:
            args.authorization === undefined
                ? { month: '2026-11', maxChargeMinor: AUTHORIZED, accountId: '100000001' }
                : args.authorization,
        clock: args.clock,
        ...store.ports
    });
    return { ...result, store };
}

const mutatingRequests = (server: FakeProviderServer) =>
    server.requests().filter((request) => request.method !== 'GET');

describe('TEST:B1:19 environment guard', () => {
    it('aborts a sandbox run that reaches a production account before the first mutation', async () => {
        const { server, transport, clock } = await fakeAs('production');
        const result = await run({
            account: 'sandbox',
            catalog: [entry({ effect: 'mutates' })],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('WRONG_ACCOUNT');
        expect(mutatingRequests(server)).toEqual([]);
        expect(server.requests().map((request) => request.path)).toEqual(['/users/me']);
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('aborts a production run that reaches a test account before the first mutation', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'production',
            catalog: [entry({ effect: 'mutates' })],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('WRONG_ACCOUNT');
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('opens every mutating measurement with GET /users/me, and runs on the right account', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [entry({ effect: 'mutates' })],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('completed');
        expect(result.mayPingWatchdog).toBe(true);
        const sent = server.requests().map((request) => `${request.method} ${request.path}`);
        expect(sent).toEqual(['GET /users/me', 'POST /v1/customers']);
    });

    it('does not ask the account for a read-only measurement', async () => {
        const { server, transport, clock } = await fakeAs('production');
        const result = await run({
            account: 'sandbox',
            catalog: [
                entry({
                    effect: 'read',
                    expected: 'seen',
                    measure: async (ctx) => {
                        await ctx.send({
                            label: 'me',
                            request: { method: 'GET', path: '/users/me' }
                        });
                        return 'seen';
                    }
                })
            ],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('completed');
        expect(server.requests()).toHaveLength(1);
    });

    it('aborts when GET /users/me does not answer an account', async () => {
        const { clock } = await fakeAs('sandbox');
        const transport = async () => ({ status: 500, body: undefined });
        const result = await run({
            account: 'sandbox',
            catalog: [entry({ effect: 'mutates' })],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('UNREADABLE_ACCOUNT');
    });

    it('aborts when the tags are not a list', async () => {
        const { clock } = await fakeAs('sandbox');
        const transport = async () => ({ status: 200, body: { tags: 'test_user' } });
        const result = await run({
            account: 'sandbox',
            catalog: [entry({ effect: 'mutates' })],
            transport,
            clock
        });
        expect(result.run.reason).toContain('UNREADABLE_ACCOUNT');
    });

    it('treats an account with no tags as not a test account', async () => {
        const { clock } = await fakeAs('sandbox');
        const sent: string[] = [];
        const transport = async (request: { method: string; path: string }) => {
            sent.push(`${request.method} ${request.path}`);
            return { status: 200, body: { id: 1, tags: null } };
        };
        const sandbox = await run({
            account: 'sandbox',
            catalog: [entry({ effect: 'mutates' })],
            transport,
            clock
        });
        expect(sandbox.run.reason).toContain('WRONG_ACCOUNT');
        expect(sent).toEqual(['GET /users/me']);
    });
});

describe('TEST:B1:19 budget guard', () => {
    const moves = (maxChargeMinor?: number) =>
        entry({
            effect: 'moves-money',
            ...(maxChargeMinor === undefined ? {} : { maxChargeMinor })
        });

    it.each([
        ['a different number', AUTHORIZED + 1],
        ['an order of magnitude more', AUTHORIZED * 10]
    ])('aborts without sending anything when the maximum charge is %s', async (_name, maxCharge) => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [moves(maxCharge)],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('BUDGET_MISMATCH');
        expect(server.requests()).toEqual([]);
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('aborts when no maximum charge is authorized at all', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [moves(AUTHORIZED)],
            transport,
            clock,
            authorization: null
        });
        expect(result.run.reason).toContain('AUTHORIZATION_MISSING');
        expect(server.requests()).toEqual([]);
    });

    it('aborts when the entry declares no maximum charge', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [moves()],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('failed');
        expect(result.run.reason).toContain('Invalid catalog');
        expect(server.requests()).toEqual([]);
    });

    it('runs with the right account and the exact maximum', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [moves(AUTHORIZED)],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('completed');
        expect(mutatingRequests(server)).toHaveLength(1);
    });

    it('checks the budget in the production run too, whatever the account kind', async () => {
        const { server, transport, clock } = await fakeAs('production');
        const result = await run({
            account: 'production',
            catalog: [moves(AUTHORIZED * 10)],
            transport,
            clock
        });
        expect(result.run.reason).toContain('BUDGET_MISMATCH');
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('stops a measurement that charges above what it declared', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const greedy = entry({
            effect: 'moves-money',
            maxChargeMinor: AUTHORIZED,
            measure: async (ctx): Promise<JsonValue> => {
                await ctx.send({
                    label: 'a',
                    request: { method: 'POST', path: '/preapproval', body: PREAPPROVAL },
                    chargeMinor: AUTHORIZED
                });
                await ctx.send({
                    label: 'b',
                    request: {
                        method: 'POST',
                        path: '/v1/payments',
                        body: { transaction_amount: 0.01 }
                    },
                    chargeMinor: 1
                });
                return 'done';
            }
        });
        const result = await run({ account: 'sandbox', catalog: [greedy], transport, clock });
        expect(result.run.reason).toContain('BUDGET_EXCEEDED');
        expect(mutatingRequests(server)).toHaveLength(1);
    });

    it('refuses a charge declared by a measurement that is not money-moving', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const sneaky = entry({
            effect: 'mutates',
            measure: async (ctx): Promise<JsonValue> => {
                await ctx.send({
                    label: 'a',
                    request: { method: 'POST', path: '/v1/customers', body: {} },
                    chargeMinor: 1
                });
                return 'created';
            }
        });
        const result = await run({ account: 'sandbox', catalog: [sneaky], transport, clock });
        expect(result.run.reason).toContain('BUDGET_EXCEEDED');
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('does not let a read-only measurement mutate', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [entry({ effect: 'read' })],
            transport,
            clock
        });
        expect(result.run.reason).toContain('READ_ENTRY_MUTATED');
        expect(server.requests()).toEqual([]);
    });
});

describe('the budget guard reads the charge from the request, not from the declaration', () => {
    const money = (args: {
        readonly body: unknown;
        readonly chargeMinor?: number;
        readonly refundMinor?: number;
        readonly path?: string;
        readonly method?: 'POST' | 'PUT';
    }) =>
        entry({
            effect: 'moves-money',
            maxChargeMinor: AUTHORIZED,
            measure: async (ctx): Promise<JsonValue> => {
                await ctx.send({
                    label: 'x',
                    request: {
                        method: args.method ?? 'POST',
                        path: args.path ?? '/preapproval',
                        body: args.body
                    },
                    ...(args.chargeMinor === undefined ? {} : { chargeMinor: args.chargeMinor }),
                    ...(args.refundMinor === undefined ? {} : { refundMinor: args.refundMinor })
                });
                return 'created';
            }
        });

    it('aborts, sending nothing, when pesos were sent as if they were centavos (100 times too much)', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const body = {
            ...PREAPPROVAL,
            auto_recurring: { ...PREAPPROVAL.auto_recurring, transaction_amount: 150000 }
        };
        const result = await run({
            account: 'sandbox',
            catalog: [money({ body, chargeMinor: AUTHORIZED })],
            transport,
            clock
        });
        expect(result.run.reason).toContain('CHARGE_MISMATCH');
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('aborts when the body charges 100 times LESS than declared', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const body = {
            ...PREAPPROVAL,
            auto_recurring: { ...PREAPPROVAL.auto_recurring, transaction_amount: 15 }
        };
        const result = await run({
            account: 'sandbox',
            catalog: [money({ body, chargeMinor: AUTHORIZED })],
            transport,
            clock
        });
        expect(result.run.reason).toContain('CHARGE_MISMATCH');
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('aborts an undeclared charge on a non-GET request of a money-moving measurement', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [money({ body: PREAPPROVAL })],
            transport,
            clock
        });
        expect(result.run.reason).toContain('CHARGE_UNDECLARED');
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('accepts the exact conversion, with the body in pesos and the declaration in minor units', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [money({ body: PREAPPROVAL, chargeMinor: AUTHORIZED })],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('completed');
        expect(mutatingRequests(server)).toHaveLength(1);
    });

    it('accepts a request that charges nothing when it declares 0', async () => {
        const { transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [
                money({
                    body: { status: 'cancelled' },
                    chargeMinor: 0,
                    path: '/preapproval/abc',
                    method: 'PUT'
                })
            ],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('completed');
    });

    it('aborts when a cancel (a zero-charge operation) declares a charge', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [
                money({
                    body: { status: 'cancelled' },
                    chargeMinor: 100,
                    path: '/preapproval/abc',
                    method: 'PUT'
                })
            ],
            transport,
            clock
        });
        expect(result.run.reason).toContain('BUDGET_EXCEEDED');
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('aborts when an order states several different amounts', async () => {
        const { transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [
                money({
                    body: {
                        total_amount: '1.00',
                        transactions: { payments: [{ amount: '2.00' }] }
                    },
                    chargeMinor: 100,
                    path: '/v1/orders'
                })
            ],
            transport,
            clock
        });
        expect(result.run.reason).toContain('CHARGE_MISMATCH');
    });

    it('aborts an amount that is not a finite non-negative number', async () => {
        const { transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [
                money({ body: { amount: -5 }, refundMinor: 0, path: '/v1/payments/1/refunds' })
            ],
            transport,
            clock
        });
        expect(result.run.reason).toContain('CHARGE_MISMATCH');
    });

    it.each([
        ['/v1/payments', 'POST'],
        ['/v1/payments/123/refunds', 'POST'],
        ['/preapproval', 'POST'],
        ['/preapproval/abc', 'PUT'],
        ['/v1/orders', 'POST'],
        ['/v1/orders/9/refund?x=1', 'POST']
    ] as const)('forbids a %s %s from a measurement not marked moves-money', async (path, method) => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const sneaky = entry({
            effect: 'mutates',
            measure: async (ctx): Promise<JsonValue> => {
                await ctx.send({ label: 'x', request: { method, path, body: {} } });
                return 'created';
            }
        });
        const result = await run({ account: 'sandbox', catalog: [sneaky], transport, clock });
        expect(result.run.reason).toContain('MONEY_ROUTE_FORBIDDEN');
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('lets a non-money measurement GET a money route', async () => {
        const { transport, clock } = await fakeAs('sandbox');
        const reader = entry({
            effect: 'read',
            expected: 'seen',
            measure: async (ctx): Promise<JsonValue> => {
                await ctx.send({
                    label: 'x',
                    request: { method: 'GET', path: '/preapproval/abc' }
                });
                return 'seen';
            }
        });
        const result = await run({ account: 'sandbox', catalog: [reader], transport, clock });
        expect(result.run.outcome).toBe('completed');
    });
});

describe('TEST:B1:19 the production run is pinned to the account the owner confirmed', () => {
    const catalog = () => [entry({ effect: 'mutates' })];
    const auth = (accountId?: string) => ({
        month: '2026-11',
        maxChargeMinor: AUTHORIZED,
        ...(accountId === undefined ? {} : { accountId })
    });

    it('aborts, sending nothing, when GET /users/me answers a different account id', async () => {
        const { server, transport, clock } = await fakeAs('production');
        const result = await run({
            account: 'production',
            catalog: catalog(),
            transport,
            clock,
            authorization: auth('999999999')
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('ACCOUNT_ID_MISMATCH');
        expect(mutatingRequests(server)).toEqual([]);
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('refuses, sending nothing, when the authorization carries no account id', async () => {
        const { server, transport, clock } = await fakeAs('production');
        const result = await run({
            account: 'production',
            catalog: catalog(),
            transport,
            clock,
            authorization: auth()
        });
        expect(result.run.outcome).toBe('refused');
        expect(result.run.reason).toContain('ACCOUNT_ID_MISSING');
        expect(server.requests()).toEqual([]);
    });

    it('does not burn the authorization when the account id does not match', async () => {
        const { transport, clock } = await fakeAs('production');
        const result = await run({
            account: 'production',
            catalog: catalog(),
            transport,
            clock,
            authorization: auth('999999999')
        });
        expect(result.store.consumedBy()).toBeUndefined();
        expect(result.store.started[0]?.consume).toBeUndefined();
    });

    it('runs, and consumes the authorization, with the confirmed id and the test tag absent', async () => {
        const { server, transport, clock } = await fakeAs('production');
        const result = await run({
            account: 'production',
            catalog: catalog(),
            transport,
            clock,
            authorization: auth('100000001')
        });
        expect(result.run.outcome).toBe('completed');
        expect(result.store.consumedBy()).toBe(result.runId);
        expect(mutatingRequests(server)).toHaveLength(1);
    });

    it('keeps checking the tag: a test account answering the confirmed id still aborts', async () => {
        const { clock } = await fakeAs('sandbox');
        const transport = async () => ({
            status: 200,
            body: { id: 100000001, tags: ['test_user'] }
        });
        const result = await run({
            account: 'production',
            catalog: catalog(),
            transport,
            clock,
            authorization: auth('100000001')
        });
        expect(result.run.reason).toContain('WRONG_ACCOUNT');
    });

    it('does not ask a sandbox run for an account id', async () => {
        const { transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: catalog(),
            transport,
            clock,
            authorization: auth()
        });
        expect(result.run.outcome).toBe('completed');
        expect(result.store.started[0]?.consume).toBeUndefined();
    });
});

describe('HOS-1512 M1: only listed operations may be sent, whatever the measurement is marked', () => {
    const send = async (args: {
        readonly effect: 'mutates' | 'moves-money';
        readonly method: 'POST' | 'PUT' | 'DELETE';
        readonly path: string;
        readonly body: unknown;
        readonly chargeMinor?: number;
    }) => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [
                entry({
                    effect: args.effect,
                    ...(args.effect === 'moves-money' ? { maxChargeMinor: AUTHORIZED } : {}),
                    measure: async (ctx): Promise<JsonValue> => {
                        await ctx.send({
                            label: 'x',
                            request: { method: args.method, path: args.path, body: args.body },
                            ...(args.chargeMinor === undefined
                                ? {}
                                : { chargeMinor: args.chargeMinor })
                        });
                        return 'created';
                    }
                })
            ],
            transport,
            clock
        });
        return { result, server };
    };

    it.each([
        ['resuming a preapproval', 'PUT', '/preapproval/abc', { status: 'authorized' }],
        [
            'a preapproval from a plan, which states no amount',
            'POST',
            '/preapproval',
            { preapproval_plan_id: 'plan-1', reason: 'x' }
        ],
        ['capturing a payment', 'PUT', '/v1/payments/123', { capture: true }],
        ['cancelling a payment', 'PUT', '/v1/payments/123', { status: 'cancelled' }],
        [
            'a cancel mixed with another field',
            'PUT',
            '/preapproval/abc',
            { status: 'cancelled', reason: 'x' }
        ],
        [
            'a cancel with extra keys',
            'PUT',
            '/preapproval/abc',
            { status: 'paused', auto_recurring: {} }
        ],
        ['deleting a preapproval', 'DELETE', '/preapproval/abc', {}],
        ['an advanced payment', 'POST', '/v1/advanced_payments', { payments: [] }],
        ['an authorized payment', 'POST', '/authorized_payments/1', {}],
        ['an unknown write', 'POST', '/v1/something', {}],
        ['a refund of a non-existent shape', 'POST', '/v1/payments/1/refunds/2', {}]
    ] as const)('refuses %s even from a money-moving measurement, sending nothing', async (_name, method, path, body) => {
        const { result, server } = await send({
            effect: 'moves-money',
            method,
            path,
            body,
            chargeMinor: 0
        });
        expect(['aborted']).toContain(result.run.outcome);
        expect(result.run.reason).toMatch(
            /OPERATION_NOT_ALLOWED|CHARGE_MISMATCH|MONEY_ROUTE_FORBIDDEN/
        );
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('classifies the path case-sensitively: an uppercase money route is not a listed operation', async () => {
        const { result, server } = await send({
            effect: 'mutates',
            method: 'POST',
            path: '/V1/PAYMENTS',
            body: { transaction_amount: 1 }
        });
        expect(result.run.reason).toMatch(/OPERATION_NOT_ALLOWED|MONEY_ROUTE_FORBIDDEN/);
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('lets a listed zero-charge operation through with a declared 0 and in-body status only', async () => {
        for (const status of ['cancelled', 'paused']) {
            const { result } = await send({
                effect: 'moves-money',
                method: 'PUT',
                path: '/preapproval/abc',
                body: { status },
                chargeMinor: 0
            });
            expect(result.run.outcome).toBe('completed');
        }
    });

    it('requires a charge to state its amount: an Order total_amount is read as pesos strings', async () => {
        const { result } = await send({
            effect: 'moves-money',
            method: 'POST',
            path: '/v1/orders',
            body: {
                total_amount: '1500.00',
                transactions: { payments: [{ amount: '1500.00' }] }
            },
            chargeMinor: 150000
        });
        expect(result.run.outcome).toBe('completed');
    });

    it('does not read the singular `transaction.payments` an Order never has', async () => {
        const { result } = await send({
            effect: 'moves-money',
            method: 'POST',
            path: '/v1/orders',
            body: { transaction: { payments: [{ amount: '1500.00' }] } },
            chargeMinor: 150000
        });
        expect(result.run.reason).toContain('CHARGE_MISMATCH');
    });

    it('books a refund apart from charges and requires its stated amount', async () => {
        const ok = await send({
            effect: 'moves-money',
            method: 'POST',
            path: '/v1/payments/123/refunds',
            body: { amount: 1500 },
            chargeMinor: 0
        });
        // A refund is declared with refundMinor, not chargeMinor: declaring none is refused.
        expect(ok.result.run.reason).toContain('CHARGE_UNDECLARED');
        const { server, transport, clock } = await fakeAs('sandbox');
        const refunded = await run({
            account: 'sandbox',
            catalog: [
                entry({
                    effect: 'moves-money',
                    maxChargeMinor: AUTHORIZED,
                    measure: async (ctx): Promise<JsonValue> => {
                        await ctx.send({
                            label: 'r',
                            request: {
                                method: 'POST',
                                path: '/v1/payments/123/refunds',
                                body: { amount: 1500 }
                            },
                            refundMinor: 150000
                        });
                        return 'created';
                    }
                })
            ],
            transport,
            clock
        });
        expect(refunded.run.outcome).toBe('completed');
        expect(mutatingRequests(server)).toHaveLength(1);
    });

    it('refuses a refund whose body states a different amount than declared', async () => {
        const { result, server } = await send({
            effect: 'moves-money',
            method: 'POST',
            path: '/v1/payments/123/refunds',
            body: { amount: 15 },
            chargeMinor: 150000
        });
        expect(result.run.outcome).toBe('aborted');
        expect(mutatingRequests(server)).toEqual([]);
    });
});

describe('HOS-1512 M2: the authorized number caps the WHOLE RUN, not each measurement', () => {
    const POSTS = (amountPesos: number) => ({
        ...PREAPPROVAL,
        auto_recurring: { ...PREAPPROVAL.auto_recurring, transaction_amount: amountPesos }
    });
    const charging = (id: string, minor: number, maxChargeMinor = minor): WatchEntry =>
        entry({
            id,
            effect: 'moves-money',
            maxChargeMinor,
            measure: async (ctx): Promise<JsonValue> => {
                await ctx.send({
                    label: 'create',
                    request: { method: 'POST', path: '/preapproval', body: POSTS(minor / 100) },
                    chargeMinor: minor
                });
                return 'created';
            }
        });
    const refunding = (id: string, minor: number): WatchEntry =>
        entry({
            id,
            effect: 'moves-money',
            maxChargeMinor: AUTHORIZED,
            measure: async (ctx): Promise<JsonValue> => {
                await ctx.send({
                    label: 'refund',
                    request: {
                        method: 'POST',
                        path: '/v1/payments/1/refunds',
                        body: { amount: minor / 100 }
                    },
                    refundMinor: minor
                });
                return 'created';
            }
        });

    it('lets an entry declare less than the cap: no entry has to equal it', async () => {
        const { transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [charging('M1', AUTHORIZED / 10)],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('completed');
    });

    it('aborts the measurement that would take the SUM of the run past the cap, though each fits alone', async () => {
        const { server, transport, clock } = await fakeAs('sandbox');
        const half = AUTHORIZED / 2;
        const result = await run({
            account: 'sandbox',
            catalog: [charging('M1', half + 1000), charging('M2', half + 1000)],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('BUDGET_EXCEEDED');
        expect(result.run.measurements.M1?.outcome).toBe('matched');
        expect(mutatingRequests(server)).toHaveLength(1);
    });

    it('lets measurements fill the cap exactly, and no more', async () => {
        const { transport, clock } = await fakeAs('sandbox');
        const exact = await run({
            account: 'sandbox',
            catalog: [charging('M1', AUTHORIZED / 2), charging('M2', AUTHORIZED / 2)],
            transport,
            clock
        });
        expect(exact.run.outcome).toBe('completed');
        const { transport: second, clock: clock2 } = await fakeAs('sandbox');
        const over = await run({
            account: 'sandbox',
            catalog: [
                charging('M1', AUTHORIZED / 2),
                charging('M2', AUTHORIZED / 2),
                charging('M3', 100, AUTHORIZED)
            ],
            transport: second,
            clock: clock2
        });
        expect(over.run.outcome).toBe('aborted');
        expect(over.run.reason).toContain('BUDGET_EXCEEDED');
    });

    it('never nets a refund against the charges: money out is tracked apart', async () => {
        const { transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [
                charging('M1', AUTHORIZED),
                refunding('M2', AUTHORIZED),
                charging('M3', 100, AUTHORIZED)
            ],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.measurements.M2?.outcome).toBe('matched');
        expect(result.run.measurements.M3?.outcome).toBe('errored');
        expect(result.run.reason).toContain('BUDGET_EXCEEDED');
    });

    it('does not count refunds toward the cap', async () => {
        const { transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [
                refunding('M1', AUTHORIZED),
                refunding('M2', AUTHORIZED),
                charging('M3', AUTHORIZED)
            ],
            transport,
            clock
        });
        expect(result.run.outcome).toBe('completed');
    });
});
