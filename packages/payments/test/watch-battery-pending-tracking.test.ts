/**
 * HOS-1512 PR 2 (security review 2026-11-18): the engine tracks every pending preapproval a run
 * creates. One per measurement, only at the amount the measurement declares, its derived key
 * recorded before it leaves and its id as it answers, and a run that leaves one uncancelled is
 * aborted.
 */
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it } from 'vitest';
import {
    CLEANUP_CANCEL_LABEL,
    runWatchBattery,
    type WatchContext,
    type WatchEntry,
    type WatchResponse,
    type WatchTransport
} from '../src/battery/index';
import { FAKE_AMOUNT_CEILING_MINOR, FAKE_AMOUNT_FLOOR_MINOR } from '../src/fake/fake-rules';
import { memoryRunStore } from './watch-battery-fixtures';

const clock = createAdjustableClock({ start: new Date('2026-11-17T12:00:00.000Z') });
const SANDBOX_ME = { id: 900000001, tags: ['test_user'] };

/** A pending, no-token creation at `minor` centavos. */
function pendingBody(minor: number) {
    return {
        reason: 'watch',
        external_reference: 'hospeda-watch-run-1',
        payer_email: 'watch-payer@hospeda.test',
        back_url: 'https://hospeda.test',
        auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: minor / 100,
            currency_id: 'ARS'
        }
    };
}

interface Sent {
    readonly method: string;
    readonly path: string;
    readonly headers?: Readonly<Record<string, string>>;
}

/** Answers each create with a new id, each cancel with `cancelStatus`, `/users/me` as sandbox. */
function provider(args: { readonly cancelStatus?: number; readonly createThrows?: boolean } = {}) {
    const sent: Sent[] = [];
    let counter = 0;
    const transport: WatchTransport = async (request) => {
        sent.push({
            method: request.method,
            path: request.path,
            ...(request.headers ? { headers: request.headers } : {})
        });
        if (request.path === '/users/me') return { status: 200, body: SANDBOX_ME };
        if (request.method === 'POST') {
            if (args.createThrows) throw new Error('socket hang up');
            counter += 1;
            return { status: 201, body: { id: `pre-${counter}` } };
        }
        if (request.method === 'PUT') {
            return { status: args.cancelStatus ?? 200, body: { status: 'cancelled' } };
        }
        return { status: 200, body: {} };
    };
    return { sent, transport, writes: () => sent.filter((item) => item.method !== 'GET') };
}

async function create(ctx: WatchContext, minor = FAKE_AMOUNT_FLOOR_MINOR): Promise<WatchResponse> {
    return ctx.send({
        label: 'create',
        request: { method: 'POST', path: '/preapproval', body: pendingBody(minor) }
    });
}

async function cancel(ctx: WatchContext, id: string): Promise<WatchResponse> {
    return ctx.send({
        label: 'cancel',
        request: { method: 'PUT', path: `/preapproval/${id}`, body: { status: 'cancelled' } }
    });
}

const idOf = (response: WatchResponse) => String((response.body as { id: string }).id);

function entry(measure: WatchEntry['measure'], extra: Partial<WatchEntry> = {}): WatchEntry {
    return {
        id: 'lifecycle-sbx',
        rows: ['M9'],
        accounts: ['sandbox'],
        effect: 'mutates',
        expected: 'done',
        measure,
        ...extra
    };
}

async function run(catalog: readonly WatchEntry[], transport: WatchTransport) {
    const store = memoryRunStore();
    const result = await runWatchBattery({
        account: 'sandbox',
        catalog,
        transport,
        authorization: null,
        clock,
        settings: { payerEmail: 'watch-payer@hospeda.test', returnUrl: 'https://hospeda.test' },
        ...store.ports
    });
    return { ...result, store };
}

describe('one pending creation per measurement', () => {
    it('refuses a second creation, sending nothing more, and still cancels the first', async () => {
        const fake = provider();
        const result = await run(
            [
                entry(async (ctx) => {
                    const first = await create(ctx);
                    try {
                        await create(ctx);
                    } finally {
                        await cancel(ctx, idOf(first));
                    }
                    return 'done';
                })
            ],
            fake.transport
        );
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('PENDING_CREATE_LIMIT');
        expect(result.run.reason).not.toContain('PENDING_NOT_CANCELLED');
        expect(fake.writes().filter((item) => item.method === 'POST')).toHaveLength(1);
    });

    it('after a guard trips, lets through only the cancel of its own uncancelled pending creation', async () => {
        const fake = provider();
        const refusals: string[] = [];
        const attempt = async (work: () => Promise<unknown>) => {
            try {
                await work();
            } catch (error) {
                refusals.push((error as { code?: string }).code ?? 'error');
            }
        };
        const result = await run(
            [
                entry(async (ctx) => {
                    const id = idOf(await create(ctx));
                    await attempt(() => create(ctx));
                    // A cancel of an id it did not create, a GET and a second cancel are refused.
                    await attempt(() => cancel(ctx, 'someone-else'));
                    await attempt(() =>
                        ctx.send({
                            label: 'read',
                            request: { method: 'GET', path: `/preapproval/${id}` }
                        })
                    );
                    await cancel(ctx, id);
                    await attempt(() => cancel(ctx, id));
                    return 'done';
                })
            ],
            fake.transport
        );
        expect(refusals).toEqual([
            'PENDING_CREATE_LIMIT',
            'SEND_AFTER_SETTLED',
            'SEND_AFTER_SETTLED',
            'SEND_AFTER_SETTLED'
        ]);
        expect(fake.writes().map((item) => `${item.method} ${item.path}`)).toEqual([
            'POST /preapproval',
            'PUT /preapproval/pre-1'
        ]);
        expect(result.run.reason).not.toContain('PENDING_NOT_CANCELLED');
    });

    it('refuses the cleanup cancel once the measurement has settled', async () => {
        const fake = provider({ cancelStatus: 500 });
        let late: WatchContext | undefined;
        let id = '';
        const result = await run(
            [
                entry(async (ctx) => {
                    late = ctx;
                    id = idOf(await create(ctx));
                    return 'done';
                })
            ],
            fake.transport
        );
        // The engine's own cancel failed; a late one from the measurement is refused all the same.
        await expect(cancel(late as WatchContext, id)).rejects.toMatchObject({
            code: 'SEND_AFTER_SETTLED'
        });
        expect(fake.writes().filter((item) => item.method === 'PUT')).toHaveLength(1);
        expect(result.run.reason).toContain('PENDING_NOT_CANCELLED');
    });

    it('lets two measurements create one each', async () => {
        const fake = provider();
        const measure: WatchEntry['measure'] = async (ctx) => {
            await cancel(ctx, idOf(await create(ctx)));
            return 'done';
        };
        const result = await run(
            [entry(measure), entry(measure, { id: 'first-charge-sec', rows: ['RP17'] })],
            fake.transport
        );
        expect(result.run.outcome).toBe('completed');
        expect(fake.writes().filter((item) => item.method === 'POST')).toHaveLength(2);
    });
});

describe('the amount a measurement declares', () => {
    it('refuses, sending nothing, a probe amount the measurement does not declare', async () => {
        const fake = provider();
        const result = await run(
            [
                entry(async (ctx) => {
                    await create(ctx, FAKE_AMOUNT_CEILING_MINOR + 100);
                    return 'done';
                })
            ],
            fake.transport
        );
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('PENDING_AMOUNT_MISMATCH');
        expect(fake.writes()).toEqual([]);
    });

    it('sends the probe amount the measurement declares', async () => {
        const fake = provider();
        const result = await run(
            [
                entry(
                    async (ctx) => {
                        await cancel(ctx, idOf(await create(ctx, FAKE_AMOUNT_CEILING_MINOR + 100)));
                        return 'done';
                    },
                    {
                        id: 'amount-ceiling',
                        rows: ['RP3'],
                        pendingAmountMinor: FAKE_AMOUNT_CEILING_MINOR + 100
                    }
                )
            ],
            fake.transport
        );
        expect(result.run.outcome).toBe('completed');
    });

    it('refuses a catalog that declares an amount outside the allowed set', async () => {
        const fake = provider();
        const result = await run(
            [entry(async () => 'done', { pendingAmountMinor: FAKE_AMOUNT_FLOOR_MINOR + 100 })],
            fake.transport
        );
        expect(result.run.outcome).toBe('failed');
        expect(result.run.reason).toContain('declares a pending amount that is not allowed');
        expect(fake.writes()).toEqual([]);
    });
});

describe('traceability', () => {
    it('records the derived key before the creation leaves, sends it, and records the id', async () => {
        const fake = provider();
        const result = await run(
            [
                entry(async (ctx) => {
                    await cancel(ctx, idOf(await create(ctx)));
                    return 'done';
                })
            ],
            fake.transport
        );
        const [keyRecord, idRecord] = result.store.progress;
        const key = keyRecord?.writeKeys?.[0];
        expect(key).toMatch(/^hw-[0-9a-f]{40}$/);
        expect(idRecord?.providerIds).toEqual(['pre-1']);
        const post = fake.writes().find((item) => item.method === 'POST');
        expect(post?.headers?.['X-Idempotency-Key']).toBe(key);
    });

    it('stops the run when the answer to a creation is lost', async () => {
        const fake = provider({ createThrows: true });
        const result = await run(
            [
                entry(async (ctx) => {
                    await create(ctx);
                    return 'done';
                })
            ],
            fake.transport
        );
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('WRITE_OUTCOME_UNKNOWN');
        expect(result.run.reason).toContain('a pending preapproval may exist');
        expect(result.store.progress[0]?.writeKeys).toHaveLength(1);
    });
});

describe('every created pending preapproval is cancelled', () => {
    // Review of #4538 (K1): the engine, not the measurement, guarantees the cancel.
    it('cancels, from the engine, one the measurement left behind, and completes', async () => {
        const fake = provider();
        const result = await run(
            [
                entry(async (ctx) => {
                    await create(ctx);
                    return 'done';
                })
            ],
            fake.transport
        );
        expect(fake.writes().map((item) => `${item.method} ${item.path}`)).toEqual([
            'POST /preapproval',
            'PUT /preapproval/pre-1'
        ]);
        expect(result.run.measurements['lifecycle-sbx']?.shapes).toHaveProperty(
            CLEANUP_CANCEL_LABEL
        );
        expect(result.run.outcome).toBe('completed');
        expect(result.run.reason).toBeUndefined();
    });

    it('cancels, from the engine, one left by a measurement that threw, and keeps its failure', async () => {
        const fake = provider();
        const result = await run(
            [
                entry(async (ctx) => {
                    await create(ctx);
                    throw new Error('the read failed');
                })
            ],
            fake.transport
        );
        expect(fake.writes().filter((item) => item.method === 'PUT')).toHaveLength(1);
        expect(result.run.outcome).toBe('failed');
        expect(result.run.reason).toContain('the read failed');
        expect(result.run.reason).not.toContain('PENDING_NOT_CANCELLED');
    });

    it('cancels, from the engine, one left after a guard tripped', async () => {
        const fake = provider();
        const result = await run(
            [
                entry(async (ctx) => {
                    await create(ctx);
                    await create(ctx);
                    return 'done';
                })
            ],
            fake.transport
        );
        expect(fake.writes().map((item) => `${item.method} ${item.path}`)).toEqual([
            'POST /preapproval',
            'PUT /preapproval/pre-1'
        ]);
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('PENDING_CREATE_LIMIT');
        expect(result.run.reason).not.toContain('PENDING_NOT_CANCELLED');
    });

    it('never cancels, from the engine, one another measurement created', async () => {
        // The first one's cancel fails, so its preapproval is still uncancelled when the second ends.
        const fake = provider({ cancelStatus: 500 });
        const result = await run(
            [
                entry(async (ctx) => {
                    await create(ctx);
                    return 'done';
                }),
                entry(async () => 'done', { id: 'first-charge-sec', rows: ['RP17'] })
            ],
            fake.transport
        );
        // One cancel, by the first measurement's cleanup: the second has nothing of its own.
        expect(fake.writes().filter((item) => item.method === 'PUT')).toHaveLength(1);
        expect(result.run.reason).toContain('PENDING_NOT_CANCELLED');
        expect(result.run.measurements['first-charge-sec']?.shapes).not.toHaveProperty(
            CLEANUP_CANCEL_LABEL
        );
    });

    it('aborts the run, naming the id, the measurement and the key, when the cancel fails', async () => {
        const fake = provider({ cancelStatus: 500 });
        const result = await run(
            [
                entry(async (ctx) => {
                    await create(ctx);
                    return 'done';
                })
            ],
            fake.transport
        );
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toMatch(
            /^PENDING_NOT_CANCELLED: the run created and did not cancel pre-1 \(lifecycle-sbx, key hw-[0-9a-f]{40}\)$/
        );
        expect(result.mayPingWatchdog).toBe(false);
    });

    it('aborts the run when the engine cancel loses its answer', async () => {
        const base = provider();
        const transport: WatchTransport = async (request) => {
            if (request.method === 'PUT') throw new Error('socket hang up');
            return base.transport(request);
        };
        const result = await run(
            [
                entry(async (ctx) => {
                    await create(ctx);
                    return 'done';
                })
            ],
            transport
        );
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('PENDING_NOT_CANCELLED');
    });

    it('does not count a cancel the provider did not confirm', async () => {
        const fake = provider({ cancelStatus: 500 });
        const result = await run(
            [
                entry(async (ctx) => {
                    await cancel(ctx, idOf(await create(ctx)));
                    return 'done';
                })
            ],
            fake.transport
        );
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('PENDING_NOT_CANCELLED');
    });

    it('keeps the first failure in the reason when a run is cut short with one left', async () => {
        const fake = provider({ cancelStatus: 500 });
        const result = await run(
            [
                entry(async (ctx) => {
                    await create(ctx);
                    throw new Error('the read failed');
                })
            ],
            fake.transport
        );
        expect(result.run.outcome).toBe('aborted');
        expect(result.run.reason).toContain('PENDING_NOT_CANCELLED');
        expect(result.run.reason).toContain('the read failed');
    });

    it('completes, sending one cancel, when every one it created was cancelled', async () => {
        const fake = provider();
        const result = await run(
            [
                entry(async (ctx) => {
                    await cancel(ctx, idOf(await create(ctx)));
                    return 'done';
                })
            ],
            fake.transport
        );
        expect(fake.writes().filter((item) => item.method === 'PUT')).toHaveLength(1);
        expect(result.run.outcome).toBe('completed');
        expect(result.mayPingWatchdog).toBe(true);
    });
});
