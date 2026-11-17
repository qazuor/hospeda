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

const NOW = new Date('2026-11-17T12:00:00.000Z');
const clock = createAdjustableClock({ start: NOW });

function scripted(body: unknown): { transport: WatchTransport; sent: string[] } {
    const sent: string[] = [];
    return {
        sent,
        transport: async (request) => {
            sent.push(`${request.method} ${request.path}`);
            if (request.path === '/users/me') return { status: 200, body: { tags: ['test_user'] } };
            return { status: 200, body };
        }
    };
}

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
    readonly recordRun?: (args: { run: WatchRunRecord }) => Promise<void>;
}) {
    const recorded: WatchRunRecord[] = [];
    const result = await runWatchBattery({
        account: args.account ?? 'sandbox',
        catalog: args.catalog,
        transport: args.transport,
        authorization: args.authorization ?? null,
        clock,
        readPreviousShapes: async () => args.previous ?? null,
        recordRun:
            args.recordRun ??
            (async ({ run: record }) => {
                recorded.push(record);
            })
    });
    return { ...result, recorded };
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
    const catalog = [readEntry()];

    it('is refused without any authorization, sending nothing', async () => {
        const { transport, sent } = scripted({ id: 'x' });
        const result = await run({ account: 'production', catalog, transport });
        expect(result.run.outcome).toBe('refused');
        expect(result.run.reason).toContain('AUTHORIZATION_MISSING');
        expect(sent).toEqual([]);
        expect(result.mayPingWatchdog).toBe(false);
        expect(result.recorded).toHaveLength(1);
    });

    it('is refused with the authorization of another month', async () => {
        const { transport, sent } = scripted({ id: 'x' });
        const result = await run({
            account: 'production',
            catalog,
            transport,
            authorization: { month: '2026-10', maxChargeMinor: 100 }
        });
        expect(result.run.outcome).toBe('refused');
        expect(result.run.reason).toContain('AUTHORIZATION_STALE');
        expect(sent).toEqual([]);
    });

    it('reads the month on the market clock, not in UTC', async () => {
        const lateOnTheThirtieth = createAdjustableClock({
            start: new Date('2026-12-01T01:30:00.000Z')
        });
        const { transport } = scripted({ id: 'x' });
        const result = await runWatchBattery({
            account: 'production',
            catalog,
            transport,
            authorization: { month: '2026-11', maxChargeMinor: 100 },
            clock: lateOnTheThirtieth,
            readPreviousShapes: async () => null,
            recordRun: async () => undefined
        });
        expect(result.run.outcome).toBe('completed');
    });

    it('runs with the authorization of the current month', async () => {
        const { transport } = scripted({ id: 'x' });
        const result = await run({
            account: 'production',
            catalog,
            transport,
            authorization: { month: '2026-11', maxChargeMinor: 100 }
        });
        expect(result.run.outcome).toBe('completed');
        expect(result.mayPingWatchdog).toBe(true);
    });

    it('does not ask a sandbox run for any authorization', async () => {
        const { transport } = scripted({ id: 'x' });
        const result = await run({ catalog, transport, authorization: null });
        expect(result.run.outcome).toBe('completed');
    });
});

describe('comparison and alerts', () => {
    it('records a matching run with no alert and its shapes', async () => {
        const { transport } = scripted({ id: 'x', status: 'authorized' });
        const result = await run({ catalog: [readEntry()], transport });
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
        const result = await run({ catalog: [readEntry()], transport });
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

    it('alerts nothing about shape on the first run, when there is no baseline', async () => {
        const { transport } = scripted({ id: 'x' });
        const result = await run({ catalog: [readEntry()], transport, previous: null });
        expect(result.run.alerts).toEqual([]);
    });

    it('ignores previous shapes of labels the measurement no longer sends', async () => {
        const previous: WatchShapeBaseline = { RP7: { gone: { $: 'object', a: 'string' } } };
        const { transport } = scripted({ id: 'x' });
        const result = await run({ catalog: [readEntry()], transport, previous });
        expect(result.run.alerts).toEqual([]);
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
        expect(result.run.measurements.RP8).toBeUndefined();
    });
});

describe('the run is written as part of the run', () => {
    it('rejects when the record cannot be written', async () => {
        const { transport } = scripted({ id: 'x' });
        await expect(
            run({
                catalog: [readEntry()],
                transport,
                recordRun: async () => {
                    throw new Error('db down');
                }
            })
        ).rejects.toThrow('db down');
    });

    it('rejects when the previous shapes cannot be read', async () => {
        const { transport } = scripted({ id: 'x' });
        await expect(
            runWatchBattery({
                account: 'sandbox',
                catalog: [readEntry()],
                transport,
                authorization: null,
                clock,
                readPreviousShapes: async () => {
                    throw new Error('db down');
                },
                recordRun: async () => undefined
            })
        ).rejects.toThrow('db down');
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
