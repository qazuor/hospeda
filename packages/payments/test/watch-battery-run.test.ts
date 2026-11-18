/**
 * HOS-1512 (AC:B1:15): the engine's own behaviour: the production month, the empty catalog,
 * the comparison against the fake's expectation and the previous run's shapes, and the run
 * record. The empty-catalog case is the safeguard: a run that measured nothing is a failure
 * and must never be reportable as healthy.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    createWatchTransport,
    diffMeasurementShapes,
    runWatchBattery,
    shapeOf,
    validateWatchCatalog,
    WATCH_CATALOG,
    type WatchAccount,
    type WatchAuthorization,
    type WatchEntry,
    type WatchRunRecord,
    type WatchShapeBaseline,
    type WatchTransport
} from '../src/battery/index';
import { type MemoryRunStore, memoryRunStore } from './watch-battery-fixtures';

const NOW = new Date('2026-11-17T12:00:00.000Z');
const clock = createAdjustableClock({ start: NOW });

const SANDBOX_ME = { id: 900000001, tags: ['test_user'] };
const PRODUCTION_ME = { id: 100000001, tags: ['normal'] };
const AUTHORIZED = { month: '2026-11', maxChargeMinor: 100, accountId: '100000001' };

function scripted(
    body: unknown,
    me: unknown = SANDBOX_ME
): { transport: WatchTransport; sent: string[] } {
    const sent: string[] = [];
    return {
        sent,
        transport: async (request) => {
            sent.push(`${request.method} ${request.path}`);
            if (request.path === '/users/me') return { status: 200, body: me };
            return { status: 200, body };
        }
    };
}

/**
 * A money-moving measurement that sends nothing: it only gives a production catalog the sum its
 * authorization must equal (the authorized amount is EXACT at run level).
 */
const moneyEntry = (maxChargeMinor = 100): WatchEntry => ({
    id: 'RP9',
    accounts: ['sandbox', 'production'],
    effect: 'moves-money',
    maxChargeMinor,
    expected: 'idle',
    measure: async () => 'idle'
});

const readEntry = (args: Partial<WatchEntry> = {}): WatchEntry => ({
    id: 'RP7',
    accounts: ['sandbox', 'production'],
    effect: 'read',
    expected: { found: true },
    measure: async (ctx) => {
        const response = await ctx.send({
            label: 'get',
            request: { method: 'GET', path: '/preapproval/abc' }
        });
        return { found: (response.body as { id?: unknown }).id !== undefined };
    },
    ...args
});

async function run(args: {
    readonly account?: WatchAccount;
    readonly catalog: readonly WatchEntry[];
    readonly transport: WatchTransport;
    readonly authorization?: WatchAuthorization | null;
    readonly previous?: WatchShapeBaseline | null;
    readonly finishRun?: (args: { runId: string; run: WatchRunRecord }) => Promise<void>;
    readonly store?: MemoryRunStore;
    readonly signal?: AbortSignal;
    readonly deadlineAt?: Date;
    readonly clock?: Parameters<typeof runWatchBattery>[0]['clock'];
}) {
    const store = args.store ?? memoryRunStore({ baseline: args.previous ?? null });
    const result = await runWatchBattery({
        account: args.account ?? 'sandbox',
        catalog: args.catalog,
        transport: args.transport,
        authorization: args.authorization ?? null,
        clock: args.clock ?? clock,
        ...(args.signal ? { signal: args.signal } : {}),
        ...(args.deadlineAt ? { deadlineAt: args.deadlineAt } : {}),
        ...store.ports,
        ...(args.finishRun ? { finishRun: args.finishRun } : {})
    });
    return { ...result, store, recorded: store.finished.map((entry) => entry.run) };
}

describe('the shipped catalog', () => {
    it('is empty in this release', () => {
        expect(WATCH_CATALOG).toEqual([]);
    });

    it('FAILS a run, loudly, and never allows the watchdog ping when it measures nothing', async () => {
        const { transport, sent } = scripted({});
        const result = await run({ catalog: WATCH_CATALOG, transport });
        expect(result.run.outcome).toBe('failed');
        expect(result.run.reason).toContain('measures nothing is a failure');
        expect(result.mayPingWatchdog).toBe(false);
        expect(sent).toEqual([]);
        expect(result.recorded).toHaveLength(1);
    });

    it('also fails when the catalog only has entries for the other account', async () => {
        const { transport } = scripted({ id: 'x' });
        const result = await run({
            catalog: [readEntry({ accounts: ['production'] })],
            transport
        });
        expect(result.run.outcome).toBe('failed');
        expect(result.mayPingWatchdog).toBe(false);
    });
});

describe('catalog validation', () => {
    it('accepts a valid entry', () => {
        expect(validateWatchCatalog({ catalog: [readEntry()] }).problems).toEqual([]);
    });

    it('rejects an id that is not a row of the fake lists, a duplicate and a bad budget', () => {
        const { problems } = validateWatchCatalog({
            catalog: [
                readEntry({ id: 'M99' }),
                readEntry({ id: 'RP7' }),
                readEntry({ id: 'RP7' }),
                readEntry({ id: 'RP8', effect: 'moves-money', maxChargeMinor: 1.5 }),
                readEntry({ id: 'RP9', accounts: [] })
            ]
        });
        expect(problems).toEqual([
            'M99: not a row of fake-lists.json',
            'RP7: listed twice',
            'RP8: moves money without an integer maximum charge above zero',
            'RP9: runs against no account'
        ]);
    });

    it('fails the run before sending anything when the catalog is invalid', async () => {
        const { transport, sent } = scripted({});
        const result = await run({ catalog: [readEntry({ id: 'M99' })], transport });
        expect(result.run.outcome).toBe('failed');
        expect(result.run.reason).toContain('Invalid catalog');
        expect(sent).toEqual([]);
    });
});

describe('the production run needs the authorization of the current month', () => {
    const catalog = [readEntry(), moneyEntry()];

    it('is refused without any authorization, sending nothing', async () => {
        const { transport, sent } = scripted({ id: 'x' }, PRODUCTION_ME);
        const result = await run({ account: 'production', catalog, transport });
        expect(result.run.outcome).toBe('refused');
        expect(result.run.reason).toContain('AUTHORIZATION_MISSING');
        expect(sent).toEqual([]);
        expect(result.mayPingWatchdog).toBe(false);
        expect(result.recorded).toHaveLength(1);
    });

    it('is refused with the authorization of another month', async () => {
        const { transport, sent } = scripted({ id: 'x' }, PRODUCTION_ME);
        const result = await run({
            account: 'production',
            catalog,
            transport,
            authorization: { ...AUTHORIZED, month: '2026-10' }
        });
        expect(result.run.outcome).toBe('refused');
        expect(result.run.reason).toContain('AUTHORIZATION_STALE');
        expect(sent).toEqual([]);
    });

    it('reads the month on the market clock, not in UTC', async () => {
        const lateOnTheThirtieth = createAdjustableClock({
            start: new Date('2026-12-01T01:30:00.000Z')
        });
        const { transport } = scripted({ id: 'x' }, PRODUCTION_ME);
        const result = await run({
            account: 'production',
            catalog,
            transport,
            authorization: AUTHORIZED,
            clock: lateOnTheThirtieth
        });
        expect(result.run.outcome).toBe('completed');
    });

    it('runs with the authorization of the current month', async () => {
        const { transport } = scripted({ id: 'x' }, PRODUCTION_ME);
        const result = await run({
            account: 'production',
            catalog,
            transport,
            authorization: AUTHORIZED
        });
        expect(result.run.outcome).toBe('completed');
        expect(result.mayPingWatchdog).toBe(true);
    });

    it('does not ask a sandbox run for any authorization', async () => {
        const { transport } = scripted({ id: 'x' });
        const result = await run({ catalog: [readEntry()], transport, authorization: null });
        expect(result.run.outcome).toBe('completed');
    });
});

/** An accepted baseline for RP7, so these tests see no baseline-missing alert. */
const accepted = (body: unknown): WatchShapeBaseline => ({
    RP7: { get: shapeOf({ body }) }
});

describe('comparison and alerts', () => {
    it('records a matching run with no alert and its shapes', async () => {
        const { transport } = scripted({ id: 'x', status: 'authorized' });
        const result = await run({
            catalog: [readEntry()],
            transport,
            previous: accepted({ id: 'x', status: 'authorized' })
        });
        expect(result.run.outcome).toBe('completed');
        expect(result.run.alerts).toEqual([]);
        expect(result.run.measurements.RP7?.outcome).toBe('matched');
        expect(result.run.measurements.RP7?.shapes.get).toEqual({
            $: 'object',
            id: 'string',
            status: 'string'
        });
        expect(result.recorded[0]).toBe(result.run);
    });

    it('alerts with what it expected and what it got when the value changed, and still completes', async () => {
        const { transport } = scripted({ other: 1 });
        const result = await run({
            catalog: [readEntry()],
            transport,
            previous: accepted({ other: 1 })
        });
        expect(result.run.outcome).toBe('completed');
        expect(result.run.measurements.RP7?.outcome).toBe('changed');
        expect(result.run.alerts).toEqual([
            {
                measurementId: 'RP7',
                kind: 'value_changed',
                expected: { found: true },
                obtained: { found: false },
                details: []
            }
        ]);
        expect(result.mayPingWatchdog).toBe(true);
    });

    it('alerts when a field of a response was renamed since the previous run', async () => {
        const previous: WatchShapeBaseline = {
            RP7: { get: shapeOf({ body: { id: 'x', payer_email: 'a' } }) }
        };
        const { transport } = scripted({ id: 'x', payer_mail: 'a' });
        const result = await run({ catalog: [readEntry()], transport, previous });
        expect(result.run.alerts).toHaveLength(1);
        expect(result.run.alerts[0]).toMatchObject({
            measurementId: 'RP7',
            kind: 'shape_changed',
            label: 'get',
            expected: { payer_email: 'string' },
            obtained: { payer_mail: 'string' },
            details: ['removed: payer_email (string)', 'added: payer_mail (string)']
        });
    });

    it('alerts on EVERY run, with its own kind, while no baseline was accepted', async () => {
        const store = memoryRunStore({ baseline: null });
        const { transport } = scripted({ id: 'x' });
        const first = await run({ catalog: [readEntry()], transport, store });
        const second = await run({ catalog: [readEntry()], transport, store });
        for (const result of [first, second]) {
            expect(result.run.alerts).toHaveLength(1);
            expect(result.run.alerts[0]).toMatchObject({
                measurementId: 'RP7',
                kind: 'shape_baseline_missing',
                obtained: { get: { $: 'object', id: 'string' } }
            });
        }
        expect(second.mayPingWatchdog).toBe(true);
    });

    it('alerts for a measurement missing from an otherwise accepted baseline', async () => {
        const store = memoryRunStore({ baseline: { RP8: { get: { $: 'object' } } } });
        const { transport } = scripted({ id: 'x' });
        const result = await run({ catalog: [readEntry()], transport, store });
        expect(result.run.alerts.map((alert) => alert.kind)).toEqual(['shape_baseline_missing']);
    });

    it('does not alert while the shape equals the accepted baseline', async () => {
        const accepted: WatchShapeBaseline = {
            RP7: { get: shapeOf({ body: { id: 'x' } }) }
        };
        const store = memoryRunStore({ baseline: accepted });
        const { transport } = scripted({ id: 'x' });
        const first = await run({ catalog: [readEntry()], transport, store });
        const second = await run({ catalog: [readEntry()], transport, store });
        expect(first.run.alerts).toEqual([]);
        expect(second.run.alerts).toEqual([]);
    });

    it('alerts, on every run, for a request label that is NEW for an accepted measurement', async () => {
        const accepted: WatchShapeBaseline = { RP7: { get: shapeOf({ body: { id: 'x' } }) } };
        const store = memoryRunStore({ baseline: accepted });
        const entry = readEntry({
            measure: async (ctx) => {
                await ctx.send({
                    label: 'get',
                    request: { method: 'GET', path: '/preapproval/abc' }
                });
                await ctx.send({
                    label: 'extra',
                    request: { method: 'GET', path: '/preapproval/def' }
                });
                return { found: true };
            }
        });
        const { transport } = scripted({ id: 'x' });
        const first = await run({ catalog: [entry], transport, store });
        const second = await run({ catalog: [entry], transport, store });
        for (const result of [first, second]) {
            expect(result.run.alerts).toEqual([
                {
                    measurementId: 'RP7',
                    kind: 'shape_changed',
                    label: 'extra',
                    expected: {},
                    obtained: { $: 'object', id: 'string' },
                    details: ['new request: extra']
                }
            ]);
        }
    });

    it('alerts for a request label that is GONE from an accepted measurement', async () => {
        const previous: WatchShapeBaseline = {
            RP7: { get: shapeOf({ body: { id: 'x' } }), gone: { $: 'object', a: 'string' } }
        };
        const { transport } = scripted({ id: 'x' });
        const result = await run({ catalog: [readEntry()], transport, previous });
        expect(result.run.alerts).toEqual([
            {
                measurementId: 'RP7',
                kind: 'shape_changed',
                label: 'gone',
                expected: { $: 'object', a: 'string' },
                obtained: {},
                details: ['request no longer observed: gone']
            }
        ]);
    });

    it('says the same thing the admin review says: one rule for both', async () => {
        const accepted = { a: { $: 'object', x: 'string' }, gone: { $: 'object' } };
        const observed = { a: { $: 'object', y: 'string' }, extra: { $: 'object' } };
        expect(diffMeasurementShapes({ accepted, observed }).flatMap((d) => d.formatted)).toEqual([
            'a: removed: x (string)',
            'a: added: y (string)',
            'new request: extra',
            'request no longer observed: gone'
        ]);
    });

    it('fails the run, after running the others, when a measurement cannot be read', async () => {
        const { transport } = scripted({ id: 'x' });
        const broken = readEntry({
            id: 'RP8',
            measure: async () => {
                throw new Error('socket hang up');
            }
        });
        const result = await run({ catalog: [broken, readEntry()], transport });
        expect(result.run.outcome).toBe('failed');
        expect(result.run.reason).toContain('RP8 could not be read: socket hang up');
        expect(result.run.measurements.RP7?.outcome).toBe('matched');
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('keeps what was read when a guard aborts later in the run', async () => {
        const { transport } = scripted({ id: 'x' });
        const mutating = readEntry({
            id: 'RP8',
            effect: 'mutates',
            measure: async () => 'never'
        });
        const failingAccount: WatchTransport = async (request) =>
            request.path === '/users/me' ? { status: 200, body: { tags: [] } } : transport(request);
        const result = await run({
            catalog: [readEntry(), mutating],
            transport: failingAccount
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.measurements.RP7?.outcome).toBe('matched');
        expect(result.run.measurements.RP8).toMatchObject({ outcome: 'errored' });
    });
});

describe('the run is written as part of the run', () => {
    it('rejects when the record cannot be written', async () => {
        const { transport } = scripted({ id: 'x' });
        await expect(
            run({
                catalog: [readEntry()],
                transport,
                finishRun: async () => {
                    throw new Error('db down');
                }
            })
        ).rejects.toThrow('db down');
    });

    it('leaves a FAILED run row, and burns nothing, when the accepted baseline cannot be read', async () => {
        const { transport } = scripted({ id: 'x' });
        const store = memoryRunStore();
        const result = await runWatchBattery({
            account: 'sandbox',
            catalog: [readEntry()],
            transport,
            authorization: null,
            clock,
            ...store.ports,
            readBaseline: async () => {
                throw new Error('db down');
            }
        });
        expect(result.run.outcome).toBe('failed');
        expect(result.run.reason).toContain('BASELINE_UNREADABLE');
        expect(result.mayPingWatchdog).toBe(false);
        expect(store.started).toHaveLength(1);
        expect(store.finished).toHaveLength(1);
        expect(store.started[0]?.consume).toBeUndefined();
    });
});

describe('createWatchTransport', () => {
    it('sends the token only as a bearer header and parses JSON', async () => {
        const calls: { url: string; init: RequestInit }[] = [];
        const transport = createWatchTransport({
            baseUrl: 'https://mp.test/',
            accessToken: 'SECRET',
            fetch: async (url, init) => {
                calls.push({ url: String(url), init: init ?? {} });
                return new Response('{"ok":true}', { status: 201 });
            }
        });
        const response = await transport({
            method: 'POST',
            path: '/x?y=1',
            body: { a: 1 },
            headers: { 'x-idempotency-key': 'k' }
        });
        expect(response).toEqual({ status: 201, body: { ok: true } });
        expect(calls[0]?.url).toBe('https://mp.test/x?y=1');
        expect(calls[0]?.init.headers).toMatchObject({
            authorization: 'Bearer SECRET',
            'content-type': 'application/json',
            'x-idempotency-key': 'k'
        });
        expect(calls[0]?.init.body).toBe('{"a":1}');
    });

    it('answers an undefined body for an empty or non-JSON answer, and keeps non-2xx statuses', async () => {
        const answers = [
            new Response('', { status: 200 }),
            new Response('<html>', { status: 502 })
        ];
        const transport = createWatchTransport({
            baseUrl: 'https://mp.test',
            accessToken: 'SECRET',
            fetch: async () => answers.shift() as Response
        });
        expect(await transport({ method: 'GET', path: '/a' })).toEqual({
            status: 200,
            body: undefined
        });
        expect(await transport({ method: 'GET', path: '/b' })).toEqual({
            status: 502,
            body: undefined
        });
    });

    it('stops sending when the run signal is aborted', async () => {
        const controller = new AbortController();
        const transport = createWatchTransport({
            baseUrl: 'https://mp.test',
            accessToken: 'SECRET',
            signal: controller.signal,
            fetch: async (_url, init) =>
                new Promise<Response>((_resolve, reject) => {
                    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
                })
        });
        const pending = transport({ method: 'GET', path: '/a' });
        controller.abort();
        await expect(pending).rejects.toThrow('aborted');
    });

    it('rejects on a network failure without the token in the message', async () => {
        const transport = createWatchTransport({
            baseUrl: 'https://mp.test',
            accessToken: 'SECRET',
            fetch: async () => {
                throw new TypeError('fetch failed');
            }
        });
        await expect(transport({ method: 'GET', path: '/a' })).rejects.toThrow('fetch failed');
    });
});

describe('one authorization, one production run (HOS-1512 D3)', () => {
    const catalog = [readEntry(), moneyEntry()];
    const production = (store: MemoryRunStore) => {
        const { transport } = scripted({ id: 'x' }, PRODUCTION_ME);
        return run({ account: 'production', catalog, transport, authorization: AUTHORIZED, store });
    };

    it('consumes the authorization when the run starts and records which run consumed it', async () => {
        const store = memoryRunStore();
        const result = await production(store);
        expect(result.run.outcome).toBe('completed');
        expect(store.started).toEqual([{ runId: result.runId, consume: '2026-11' }]);
        expect(store.consumedBy()).toBe(result.runId);
    });

    it('refuses a second run once the authorization is consumed, sending nothing', async () => {
        const store = memoryRunStore({ consumedBy: 'run-1' });
        const { transport, sent } = scripted({ id: 'x' }, PRODUCTION_ME);
        const result = await run({
            account: 'production',
            catalog,
            transport,
            authorization: { ...AUTHORIZED, consumedByRunId: 'run-1' },
            store
        });
        expect(result.run.outcome).toBe('refused');
        expect(result.run.reason).toContain('AUTHORIZATION_CONSUMED');
        expect(result.run.reason).toContain('run-1');
        expect(sent).toEqual([]);
        expect(store.started[0]?.consume).toBeUndefined();
        expect(store.consumedBy()).toBe('run-1');
    });

    it('lets only one of two concurrent runs consume the same authorization', async () => {
        const store = memoryRunStore();
        const [first, second] = await Promise.all([production(store), production(store)]);
        const outcomes = [first.run.outcome, second.run.outcome].sort();
        expect(outcomes).toEqual(['completed', 'refused']);
        const loser = first.run.outcome === 'refused' ? first : second;
        expect(loser.run.reason).toContain('AUTHORIZATION_CONSUMED');
        expect(loser.mayPingWatchdog).toBe(false);
        expect(Object.keys(loser.run.measurements)).toEqual([]);
        expect(store.consumedBy()).toBe(
            first.run.outcome === 'completed' ? first.runId : second.runId
        );
    });

    it('does not burn the authorization on an empty money catalog', async () => {
        const store = memoryRunStore();
        const { transport } = scripted({ id: 'x' }, PRODUCTION_ME);
        const empty = await run({
            account: 'production',
            catalog: [],
            transport,
            authorization: AUTHORIZED,
            store
        });
        expect(empty.run.outcome).toBe('refused');
        expect(empty.run.reason).toContain('AUTHORIZATION_SUM_MISMATCH');
        expect(store.consumedBy()).toBeUndefined();
    });

    it('keeps the authorization consumed when the run it started later fails', async () => {
        const store = memoryRunStore();
        const { transport } = scripted({ id: 'x' }, PRODUCTION_ME);
        const broken = readEntry({
            measure: async () => {
                throw new Error('socket hang up');
            }
        });
        const result = await run({
            account: 'production',
            catalog: [broken, moneyEntry()],
            transport,
            authorization: AUTHORIZED,
            store
        });
        expect(result.run.outcome).toBe('failed');
        expect(store.consumedBy()).toBe(result.runId);
    });

    it('refuses the run, burning nothing, when the authorization was rewritten after its pre-flight', async () => {
        const store = memoryRunStore({
            stored: { month: '2026-11', maxChargeMinor: 999999, accountId: '100000001' }
        });
        const { transport } = scripted({ id: 'x' }, PRODUCTION_ME);
        const result = await run({
            account: 'production',
            catalog,
            transport,
            authorization: AUTHORIZED,
            store
        });
        expect(result.run.outcome).toBe('refused');
        expect(result.run.reason).toContain('AUTHORIZATION_CONSUMED');
        expect(store.consumedBy()).toBeUndefined();
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('hands the consumption the very values the run was pre-flighted with', async () => {
        const store = memoryRunStore();
        const { transport } = scripted({ id: 'x' }, PRODUCTION_ME);
        await run({ account: 'production', catalog, transport, authorization: AUTHORIZED, store });
        expect(store.started).toHaveLength(1);
        expect(store.started[0]?.consume).toBe('2026-11');
    });

    it('does not burn the authorization when the baseline cannot be read, and records the failure', async () => {
        const store = memoryRunStore();
        const { transport } = scripted({ id: 'x' }, PRODUCTION_ME);
        const result = await runWatchBattery({
            account: 'production',
            catalog,
            transport,
            authorization: AUTHORIZED,
            clock,
            ...store.ports,
            readBaseline: async () => {
                throw new Error('db down');
            }
        });
        expect(result.run.outcome).toBe('failed');
        expect(store.consumedBy()).toBeUndefined();
        expect(store.started[0]?.consume).toBeUndefined();
        expect(store.finished).toHaveLength(1);
    });

    it('does not consume anything in a sandbox run', async () => {
        const store = memoryRunStore();
        const { transport } = scripted({ id: 'x' });
        await run({ catalog, transport, authorization: AUTHORIZED, store });
        expect(store.consumedBy()).toBeUndefined();
    });
});

describe('the accepted baseline (HOS-1512 D1)', () => {
    const previous: WatchShapeBaseline = {
        RP7: { get: shapeOf({ body: { id: 'x', payer_email: 'a' } }) }
    };

    it('alerts on EVERY run while the owner has not accepted the new shape', async () => {
        const store = memoryRunStore({ baseline: previous });
        const { transport } = scripted({ id: 'x', payer_mail: 'a' });
        const first = await run({ catalog: [readEntry()], transport, store });
        const second = await run({ catalog: [readEntry()], transport, store });
        expect(first.run.alerts).toHaveLength(1);
        expect(second.run.alerts).toHaveLength(1);
        expect(second.run.alerts[0]?.kind).toBe('shape_changed');
    });

    it('stops alerting once the new shape is the accepted baseline', async () => {
        const accepted: WatchShapeBaseline = {
            RP7: { get: shapeOf({ body: { id: 'x', payer_mail: 'a' } }) }
        };
        const store = memoryRunStore({ baseline: accepted });
        const { transport } = scripted({ id: 'x', payer_mail: 'a' });
        const result = await run({ catalog: [readEntry()], transport, store });
        expect(result.run.alerts).toEqual([]);
    });
});

describe('cancellation and the deadline (HOS-1512)', () => {
    const entry = (id: string, calls: string[]): WatchEntry =>
        readEntry({
            id,
            measure: async (ctx) => {
                calls.push(id);
                await ctx.send({
                    label: 'get',
                    request: { method: 'GET', path: '/preapproval/abc' }
                });
                return { found: true };
            }
        });
    const { transport } = scripted({ id: 'x' });

    it('never starts a measurement once the signal is aborted, and records the run as failed', async () => {
        const calls: string[] = [];
        const controller = new AbortController();
        const first: WatchEntry = readEntry({
            id: 'RP7',
            measure: async () => {
                calls.push('RP7');
                controller.abort();
                return { found: true };
            }
        });
        const result = await run({
            catalog: [first, entry('RP8', calls), entry('RP9', calls)],
            transport,
            signal: controller.signal
        });
        expect(calls).toEqual(['RP7']);
        expect(result.run.outcome).toBe('failed');
        expect(result.run.reason).toContain('TIMED_OUT');
        expect(result.mayPingWatchdog).toBe(false);
        expect(result.recorded).toHaveLength(1);
    });

    it('does not start at all when the signal is already aborted', async () => {
        const calls: string[] = [];
        const controller = new AbortController();
        controller.abort();
        const result = await run({
            catalog: [entry('RP7', calls)],
            transport,
            signal: controller.signal
        });
        expect(calls).toEqual([]);
        expect(result.run.outcome).toBe('failed');
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('never starts a measurement at or past the deadline', async () => {
        const calls: string[] = [];
        const deadlineClock = createAdjustableClock({ start: NOW });
        const slow: WatchEntry = readEntry({
            id: 'RP7',
            measure: async () => {
                calls.push('RP7');
                deadlineClock.advance({ ms: 60_000 });
                return { found: true };
            }
        });
        const result = await run({
            catalog: [slow, entry('RP8', calls)],
            transport,
            clock: deadlineClock,
            deadlineAt: new Date(NOW.getTime() + 30_000)
        });
        expect(calls).toEqual(['RP7']);
        expect(result.run.outcome).toBe('failed');
        expect(result.run.reason).toContain('TIMED_OUT');
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('stores a run aborted during its LAST measurement as failed, never completed or pingable', async () => {
        const controller = new AbortController();
        const last: WatchEntry = readEntry({
            measure: async () => {
                controller.abort();
                return { found: true };
            }
        });
        const result = await run({
            catalog: [last],
            transport,
            signal: controller.signal,
            previous: accepted({ id: 'x' })
        });
        expect(result.run.outcome).toBe('failed');
        expect(result.run.reason).toContain('TIMED_OUT');
        expect(result.recorded[0]?.outcome).toBe('failed');
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('stores a run whose deadline passed during its last measurement as failed', async () => {
        const deadlineClock = createAdjustableClock({ start: NOW });
        const slow: WatchEntry = readEntry({
            measure: async () => {
                deadlineClock.advance({ ms: 60_000 });
                return { found: true };
            }
        });
        const result = await run({
            catalog: [slow],
            transport,
            clock: deadlineClock,
            deadlineAt: new Date(NOW.getTime() + 30_000),
            previous: accepted({ id: 'x' })
        });
        expect(result.run.outcome).toBe('failed');
        expect(result.mayPingWatchdog).toBe(false);
    });
});

describe('provider ids of what a run created', () => {
    it('keeps the id of every write, including those of a measurement a guard aborted', async () => {
        const transport: WatchTransport = async (request) =>
            request.path === '/users/me'
                ? { status: 200, body: SANDBOX_ME }
                : { status: 201, body: { id: 'pre-123' } };
        const writer = readEntry({
            id: 'RP8',
            effect: 'mutates',
            measure: async (ctx) => {
                await ctx.send({
                    label: 'a',
                    request: { method: 'POST', path: '/v1/customers', body: {} }
                });
                await ctx.send({
                    label: 'b',
                    request: { method: 'POST', path: '/preapproval', body: {} }
                });
                return 'unreachable';
            }
        });
        const result = await run({ catalog: [writer], transport });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.measurements.RP8?.providerIds).toEqual(['pre-123']);
    });
});

describe('HOS-1512 M4: provider ids are persisted the moment the write answers', () => {
    const writer = (args: { readonly after?: () => Promise<void> } = {}): WatchEntry =>
        readEntry({
            id: 'RP8',
            effect: 'mutates',
            measure: async (ctx) => {
                await ctx.send({
                    label: 'customer',
                    request: { method: 'POST', path: '/v1/customers', body: {} }
                });
                await args.after?.();
                await ctx.send({
                    label: 'second',
                    request: { method: 'POST', path: '/v1/customers', body: {} }
                });
                return 'done';
            }
        });
    const answering = (): WatchTransport => async (request) =>
        request.path === '/users/me'
            ? { status: 200, body: SANDBOX_ME }
            : { status: 201, body: { id: `pre-${Math.random().toString(36).slice(2, 8)}` } };

    it('has the id on record while the run is still going: a process that dies mid-run loses nothing', async () => {
        const store = memoryRunStore();
        let release: () => void = () => undefined;
        const blocked = new Promise<void>((resolve) => {
            release = resolve;
        });
        const pending = runWatchBattery({
            account: 'sandbox',
            catalog: [writer({ after: () => blocked })],
            transport: answering(),
            authorization: null,
            clock,
            ...store.ports
        });
        for (let turn = 0; turn < 50 && store.progress.length === 0; turn += 1) {
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
        // The run never closed (the "process died" here), yet the id is already stored.
        expect(store.finished).toEqual([]);
        expect(store.progress).toHaveLength(1);
        expect(store.progress[0]).toMatchObject({ measurementId: 'RP8' });
        expect(store.progress[0]?.providerIds).toHaveLength(1);
        release();
        await pending;
    });

    it('keeps the ids recorded when the closing of the run fails', async () => {
        const store = memoryRunStore();
        await expect(
            runWatchBattery({
                account: 'sandbox',
                catalog: [writer()],
                transport: answering(),
                authorization: null,
                clock,
                ...store.ports,
                finishRun: async () => {
                    throw new Error('db down');
                }
            })
        ).rejects.toThrow('db down');
        expect(store.progress.map((entry) => entry.measurementId)).toEqual(['RP8', 'RP8']);
        expect(store.progress.flatMap((entry) => entry.providerIds)).toHaveLength(2);
    });

    it('aborts, sending nothing more, when an id cannot be recorded', async () => {
        const store = memoryRunStore();
        const sent: string[] = [];
        const transport: WatchTransport = async (request) => {
            sent.push(`${request.method} ${request.path}`);
            return answering()(request);
        };
        const result = await runWatchBattery({
            account: 'sandbox',
            catalog: [writer()],
            transport,
            authorization: null,
            clock,
            ...store.ports,
            recordProgress: async () => {
                throw new Error('db down');
            }
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('PROGRESS_NOT_RECORDED');
        expect(sent.filter((entry) => entry.startsWith('POST'))).toHaveLength(1);
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('does not record anything for a GET', async () => {
        const store = memoryRunStore();
        await run({ catalog: [readEntry()], transport: scripted({ id: 'x' }).transport, store });
        expect(store.progress).toEqual([]);
    });
});
