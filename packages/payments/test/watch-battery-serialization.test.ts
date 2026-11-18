/**
 * HOS-1512 (G1, G2): a measurement's sends run one at a time, nothing is in flight or may start
 * once the measurement has settled, and a refused write's answered id is kept for traceability.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    type JsonValue,
    runWatchBattery,
    type WatchContext,
    type WatchEntry,
    type WatchTransport
} from '../src/battery/index';
import { memoryRunStore } from './watch-battery-fixtures';

const NOW = new Date('2026-11-17T12:00:00.000Z');
const CAP = 150000;

const preapproval = (amount: number) => ({
    reason: 'watch',
    external_reference: 'x',
    back_url: 'https://hospeda.test/return',
    auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: amount,
        currency_id: 'ARS'
    }
});

const create = (label: string, amount: number) => ({
    label,
    request: { method: 'POST' as const, path: '/preapproval', body: preapproval(amount) },
    chargeMinor: amount * 100
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function money(id: string, measure: WatchEntry['measure']): WatchEntry {
    return {
        id,
        accounts: ['sandbox'],
        effect: 'moves-money',
        maxChargeMinor: CAP,
        expected: 'done',
        measure
    };
}

/** A provider whose writes take `delayMs` and that counts how many are in flight at once. */
function provider(
    args: { delayMs?: number; onWrite?: (n: number) => { status: number; body: unknown } } = {}
) {
    let writes = 0;
    let inFlight = 0;
    let maxInFlight = 0;
    const answered: string[] = [];
    const transport: WatchTransport = async (request) => {
        if (request.path === '/users/me')
            return { status: 200, body: { id: 900000001, tags: ['test_user'] } };
        if (request.method === 'GET') return { status: 200, body: {} };
        writes += 1;
        const n = writes;
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await sleep(args.delayMs ?? 0);
        inFlight -= 1;
        const custom = args.onWrite?.(n);
        const response = custom ?? { status: 201, body: { id: `obj-${n}` } };
        answered.push(`answered-${n}`);
        return response;
    };
    return { transport, writes: () => writes, maxInFlight: () => maxInFlight, answered };
}

async function run(args: {
    readonly catalog: readonly WatchEntry[];
    readonly transport: WatchTransport;
    readonly store?: ReturnType<typeof memoryRunStore>;
}) {
    const store = args.store ?? memoryRunStore();
    const result = await runWatchBattery({
        account: 'sandbox',
        catalog: args.catalog,
        transport: args.transport,
        authorization: { month: '2026-11', maxChargeMinor: CAP, accountId: '100000001' },
        clock: createAdjustableClock({ start: NOW }),
        ...store.ports
    });
    return { ...result, store };
}

describe('G1a: the sends of a measurement are serialized', () => {
    it('records both concurrent money writes and a ledger equal to their sum, in order', async () => {
        const { transport, maxInFlight } = provider({ delayMs: 20 });
        const store = memoryRunStore();
        const result = await run({
            store,
            transport,
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    await Promise.all([ctx.send(create('a', 700)), ctx.send(create('b', 800))]);
                    return 'done';
                })
            ]
        });
        expect(result.run.outcome).toBe('completed');
        expect(maxInFlight()).toBe(1);
        expect(result.run.ledger).toEqual({ charged: 150000, refunded: 0 });
        expect(result.run.measurements['M1']?.providerIds).toEqual(['obj-1', 'obj-2']);
        const charged = store.progress.map((entry) => entry.ledger?.charged ?? 0);
        expect(charged).toEqual([...charged].sort((x, y) => x - y));
        expect(store.progress.flatMap((entry) => entry.writeKeys ?? [])).toHaveLength(2);
        expect(charged.at(-1)).toBe(150000);
    });

    it('keeps the id of the write in flight when a sibling trips a guard', async () => {
        const { transport } = provider({ delayMs: 20 });
        const store = memoryRunStore();
        const result = await run({
            store,
            transport,
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    await Promise.all([
                        ctx.send(create('a', 700)),
                        ctx.send({
                            label: 'bad',
                            request: {
                                method: 'PUT',
                                path: '/preapproval/foreign-1',
                                body: { status: 'cancelled' }
                            }
                        })
                    ]);
                    return 'done';
                })
            ]
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('TARGET_NOT_CREATED_BY_RUN');
        expect(result.run.measurements['M1']?.providerIds).toEqual(['obj-1']);
        expect(store.progress.flatMap((entry) => entry.providerIds ?? [])).toEqual(['obj-1']);
        expect(result.run.ledger.charged).toBe(70000);
    });

    it('does not start a queued write once an earlier one tripped a guard', async () => {
        const { transport, writes } = provider();
        const result = await run({
            transport,
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    const bad = ctx.send({
                        label: 'bad',
                        request: {
                            method: 'PUT',
                            path: '/preapproval/foreign-1',
                            body: { status: 'paused' }
                        },
                        chargeMinor: 0
                    });
                    const later = ctx.send(create('a', 700));
                    await Promise.allSettled([bad, later]);
                    await bad;
                    return 'done';
                })
            ]
        });
        expect(result.run.outcome).toBe('aborted');
        expect(writes()).toBe(0);
    });
});

describe('G1b: nothing is in flight, and nothing may start, once the measurement settled', () => {
    it('refuses a send started after the measurement settled', async () => {
        const { transport, writes } = provider();
        let late: WatchContext['send'] | undefined;
        const result = await run({
            transport,
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    late = ctx.send;
                    return 'done';
                })
            ]
        });
        expect(result.run.outcome).toBe('completed');
        if (!late) throw new Error('the measurement did not run');
        await expect(late(create('a', 700))).rejects.toMatchObject({ code: 'SEND_AFTER_SETTLED' });
        expect(writes()).toBe(0);
    });

    it('waits for a write the measurement left in flight before the run is closed', async () => {
        const { transport, answered } = provider({ delayMs: 40 });
        const store = memoryRunStore();
        const events: string[] = [];
        const result = await run({
            transport,
            store: {
                ...store,
                ports: {
                    ...store.ports,
                    recordProgress: async (progress) => {
                        events.push(`progress:${(progress.providerIds ?? []).join(',')}`);
                        await store.ports.recordProgress(progress);
                    },
                    finishRun: async (finish) => {
                        events.push(`finish:answered=${answered.length}`);
                        await store.ports.finishRun(finish);
                    }
                }
            },
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    // Fired and not awaited: the measurement returns while it is still in flight.
                    void ctx.send(create('a', 700));
                    return 'done';
                })
            ]
        });
        expect(events.at(-1)).toBe('finish:answered=1');
        expect(events).toContain('progress:obj-1');
        expect(result.run.measurements['M1']?.providerIds).toEqual(['obj-1']);
        expect(result.run.ledger.charged).toBe(70000);
    });
});

describe('G2: the release path keeps the id the provider answered', () => {
    it('records the id of a 422 in providerIds, and it is never a valid target', async () => {
        const { transport } = provider({
            onWrite: () => ({ status: 422, body: { id: 'rejected-1', message: 'invalid' } })
        });
        const store = memoryRunStore();
        const result = await run({
            store,
            transport,
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    const refused = await ctx.send(create('a', 700));
                    if (refused.status !== 422) throw new Error('expected a 422');
                    await ctx.send({
                        label: 'cancel',
                        request: {
                            method: 'PUT',
                            path: '/preapproval/rejected-1',
                            body: { status: 'cancelled' }
                        }
                    });
                    return 'done';
                })
            ]
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('TARGET_NOT_CREATED_BY_RUN');
        expect(result.run.measurements['M1']?.providerIds).toEqual(['rejected-1']);
        expect(store.progress.flatMap((entry) => entry.providerIds ?? [])).toEqual(['rejected-1']);
        // The reservation was given back: a refusal moved no money.
        expect(result.run.ledger).toEqual({ charged: 0, refunded: 0 });
    });
});

describe('H1: the guard that tripped first is the reason of the run', () => {
    it('reports BUDGET_EXCEEDED when the measurement swallows it and a later send is refused', async () => {
        const { transport } = provider();
        const result = await run({
            transport,
            catalog: [
                money('M1', async (ctx): Promise<JsonValue> => {
                    // 2000 pesos is above the 1500 the run may charge.
                    await ctx.send(create('a', 2000)).catch(() => undefined);
                    await ctx.send(create('b', 100));
                    return 'done';
                })
            ]
        });
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toMatch(/^BUDGET_EXCEEDED/);
    });
});

describe('H3: a send the measurement never awaits is not an unhandled rejection', () => {
    it('raises no unhandledRejection for a non-awaited send that trips a guard', async () => {
        const unhandled: unknown[] = [];
        const listener = (reason: unknown) => unhandled.push(reason);
        process.on('unhandledRejection', listener);
        try {
            const { transport } = provider();
            const result = await run({
                transport,
                catalog: [
                    money('M1', async (ctx): Promise<JsonValue> => {
                        void ctx.send({
                            label: 'bad',
                            request: {
                                method: 'PUT',
                                path: '/preapproval/foreign-1',
                                body: { status: 'paused' }
                            },
                            chargeMinor: 0
                        });
                        return 'done';
                    })
                ]
            });
            expect(result.run.outcome).toBe('aborted');
            await sleep(50);
            expect(unhandled).toEqual([]);
        } finally {
            process.off('unhandledRejection', listener);
        }
    });

    it('raises no unhandledRejection for a non-awaited send refused after the measurement settled', async () => {
        const unhandled: unknown[] = [];
        const listener = (reason: unknown) => unhandled.push(reason);
        process.on('unhandledRejection', listener);
        try {
            const { transport } = provider();
            let late: WatchContext['send'] | undefined;
            await run({
                transport,
                catalog: [
                    money('M1', async (ctx): Promise<JsonValue> => {
                        late = ctx.send;
                        return 'done';
                    })
                ]
            });
            if (!late) throw new Error('the measurement did not run');
            void late(create('a', 700));
            await sleep(50);
            expect(unhandled).toEqual([]);
        } finally {
            process.off('unhandledRejection', listener);
        }
    });
});
