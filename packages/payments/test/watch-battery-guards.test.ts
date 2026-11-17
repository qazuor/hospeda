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
    type WatchEntry,
    type WatchRunRecord
} from '../src/battery/index';
import { FakePaymentProvider } from '../src/fake/index';
import {
    type FakeProviderAccount,
    type FakeProviderServer,
    startFakeProviderServer
} from '../src/fake-server';

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
    const recorded: WatchRunRecord[] = [];
    const result = await runWatchBattery({
        account: args.account,
        catalog: args.catalog,
        transport: args.transport,
        authorization:
            args.authorization === undefined
                ? { month: '2026-11', maxChargeMinor: AUTHORIZED }
                : args.authorization,
        clock: args.clock,
        readPreviousShapes: async () => null,
        recordRun: async ({ run: record }) => {
            recorded.push(record);
        }
    });
    return { ...result, recorded };
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
        ['an order of magnitude more', AUTHORIZED * 10],
        ['an order of magnitude less', AUTHORIZED / 10]
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
        expect(server.requests()).toEqual([]);
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
                        path: '/preapproval',
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
                    ...(args.chargeMinor === undefined ? {} : { chargeMinor: args.chargeMinor })
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

    it('aborts when a body that states no amount declares a charge', async () => {
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
        expect(result.run.reason).toContain('CHARGE_MISMATCH');
        expect(mutatingRequests(server)).toEqual([]);
    });

    it('aborts when the body states several different amounts', async () => {
        const { transport, clock } = await fakeAs('sandbox');
        const result = await run({
            account: 'sandbox',
            catalog: [
                money({
                    body: { transaction_amount: 1, amount: 2 },
                    chargeMinor: 100,
                    path: '/v1/payments'
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
                money({ body: { amount: -5 }, chargeMinor: 0, path: '/v1/payments/1/refunds' })
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
