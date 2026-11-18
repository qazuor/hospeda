/**
 * HOS-1512 (AC:B1:15): the provider watch battery cron wires the engine to its ports. The
 * safeguards under test: an empty catalog FAILS loudly and never pings the watchdog; only a
 * completed run that measured something pings; production waits for its authorization; a run cut
 * short by its signal or deadline fails and never pings.
 */
import type { WatchEntry, WatchRunRecord, WatchTransport } from '@repo/payments';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createProviderWatchBatteryJob,
    PROVIDER_WATCH_SCHEDULE,
    type ProviderWatchBatteryDeps
} from '../../src/cron/jobs/provider-watch-battery.job';
import type { CronJobContext } from '../../src/cron/types';

/** A Monday: the sandbox account's day. */
const MONDAY = new Date('2026-11-02T10:00:00.000Z');
/** The 1st of the month: production's day. */
const FIRST = new Date('2026-11-01T10:00:00.000Z');
const SANDBOX_ME = { id: 900000001, tags: ['test_user'] };
const PRODUCTION_ME = { id: 100000001, tags: ['normal'] };
const AUTHORIZED = { month: '2026-11', maxChargeMinor: 100, accountId: '100000001' };

function context(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        startedAt: new Date(),
        runId: crypto.randomUUID(),
        correlationId: crypto.randomUUID(),
        dryRun: false,
        executionMode: 'scheduled',
        ...overrides
    };
}

const readEntry: WatchEntry = {
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
    }
};

/** Sends nothing; gives a production catalog the sum its authorization must equal. */
const moneyEntry: WatchEntry = {
    id: 'RP9',
    accounts: ['sandbox', 'production'],
    effect: 'moves-money',
    maxChargeMinor: 100,
    expected: 'idle',
    measure: async () => 'idle'
};

function deps(overrides: Partial<ProviderWatchBatteryDeps> = {}, me: unknown = SANDBOX_ME) {
    const recorded: WatchRunRecord[] = [];
    const started: { consume: string | undefined }[] = [];
    const transport: WatchTransport = async (request) =>
        request.path === '/users/me'
            ? { status: 200, body: me }
            : { status: 200, body: { id: 'x' } };
    const pingWatchdog = vi.fn(async () => undefined);
    const base: ProviderWatchBatteryDeps = {
        resolveAccount: () => 'sandbox',
        catalog: [readEntry],
        buildTransport: () => transport,
        readAuthorization: async () => null,
        readBaseline: async () => null,
        startRun: async ({ consumeAuthorization }) => {
            started.push({ consume: consumeAuthorization?.month });
            return { runId: crypto.randomUUID(), authorizationConsumed: true };
        },
        recordProgress: async () => undefined,
        finishRun: async ({ run }) => {
            recorded.push(run);
        },
        now: () => MONDAY,
        pingWatchdog
    };
    return { deps: { ...base, ...overrides }, recorded, started, pingWatchdog };
}

describe('provider watch battery cron', () => {
    beforeEach(() => vi.clearAllMocks());

    it('registers an exclusive job that ships NOT scheduled but stays enabled for the manual trigger', () => {
        const job = createProviderWatchBatteryJob(deps().deps);
        expect(job).toMatchObject({
            name: 'provider-watch-battery',
            schedule: PROVIDER_WATCH_SCHEDULE,
            exclusive: true,
            enabled: true,
            scheduled: false,
            budgetMs: 540_000,
            timeoutMs: 600_000
        });
        expect(PROVIDER_WATCH_SCHEDULE).toBe('17 7 * * *');
    });

    it('FAILS loudly and never pings the watchdog when the catalog is empty', async () => {
        const { deps: d, recorded, pingWatchdog } = deps({ catalog: [] });
        const ctx = context();
        const result = await createProviderWatchBatteryJob(d).handler(ctx);
        expect(result.success).toBe(false);
        expect(result.message).toContain('failed');
        expect(result.details).toMatchObject({ outcome: 'failed', measured: 0 });
        expect(pingWatchdog).not.toHaveBeenCalled();
        expect(recorded).toHaveLength(1);
        expect(recorded[0]?.outcome).toBe('failed');
        expect(ctx.logger.error).toHaveBeenCalledWith(
            expect.stringContaining('measures nothing is a failure'),
            expect.anything(),
            { capture: true }
        );
    });

    it('pings the watchdog after a completed run that measured something', async () => {
        const { deps: d, recorded, pingWatchdog } = deps();
        const result = await createProviderWatchBatteryJob(d).handler(context());
        expect(result).toMatchObject({ success: true, processed: 1, errors: 0 });
        expect(pingWatchdog).toHaveBeenCalledTimes(1);
        expect(recorded[0]?.outcome).toBe('completed');
    });

    it('still succeeds and pings when the run found changes, and records them', async () => {
        const changed = { ...readEntry, expected: { found: false } };
        const {
            deps: d,
            recorded,
            pingWatchdog
        } = deps({
            catalog: [changed],
            readBaseline: async () => ({ RP7: { get: { $: 'object', id: 'string' } } })
        });
        const result = await createProviderWatchBatteryJob(d).handler(context());
        expect(result.success).toBe(true);
        expect(result.details).toMatchObject({ alerts: 1 });
        expect(recorded[0]?.alerts).toHaveLength(1);
        expect(pingWatchdog).toHaveBeenCalledTimes(1);
    });

    it('alerts on every run while nothing was accepted, and still completes and pings', async () => {
        const { deps: d, recorded, pingWatchdog } = deps();
        const job = createProviderWatchBatteryJob(d);
        for (let run = 1; run <= 2; run += 1) {
            const result = await job.handler(context());
            expect(result).toMatchObject({ success: true, details: { alerts: 1 } });
            expect(recorded[run - 1]?.alerts[0]?.kind).toBe('shape_baseline_missing');
        }
        expect(pingWatchdog).toHaveBeenCalledTimes(2);
    });

    it('does not ping when a guard aborts the run', async () => {
        const mutating: WatchEntry = {
            ...readEntry,
            id: 'RP8',
            effect: 'mutates',
            measure: async () => 'x'
        };
        const wrongAccount: WatchTransport = async () => ({ status: 200, body: { tags: [] } });
        const { deps: d, pingWatchdog } = deps({
            catalog: [mutating],
            buildTransport: () => wrongAccount
        });
        const result = await createProviderWatchBatteryJob(d).handler(context());
        expect(result.success).toBe(false);
        expect(result.details).toMatchObject({ outcome: 'aborted' });
        expect(pingWatchdog).not.toHaveBeenCalled();
    });

    describe('production', () => {
        const production = (overrides: Partial<ProviderWatchBatteryDeps> = {}) =>
            deps(
                { resolveAccount: () => 'production', now: () => FIRST, ...overrides },
                PRODUCTION_ME
            );

        it('refuses without the authorization of the month and sends nothing', async () => {
            const sent: string[] = [];
            const {
                deps: d,
                started,
                pingWatchdog
            } = production({
                buildTransport: () => async (request) => {
                    sent.push(request.path);
                    return { status: 200, body: {} };
                }
            });
            const result = await createProviderWatchBatteryJob(d).handler(
                context({ executionMode: 'manual' })
            );
            expect(result.success).toBe(false);
            expect(result.details).toMatchObject({ outcome: 'refused' });
            expect(sent).toEqual([]);
            expect(started[0]?.consume).toBeUndefined();
            expect(pingWatchdog).not.toHaveBeenCalled();
        });

        it('runs with the authorization of the current month and consumes it', async () => {
            const {
                deps: d,
                started,
                pingWatchdog
            } = production({
                catalog: [readEntry, moneyEntry],
                readAuthorization: async () => AUTHORIZED
            });
            const result = await createProviderWatchBatteryJob(d).handler(context());
            expect(result.success).toBe(true);
            expect(started).toEqual([{ consume: '2026-11' }]);
            expect(pingWatchdog).toHaveBeenCalledTimes(1);
        });

        it('refuses a consumed authorization', async () => {
            const { deps: d, pingWatchdog } = production({
                readAuthorization: async () => ({ ...AUTHORIZED, consumedByRunId: 'run-1' })
            });
            const result = await createProviderWatchBatteryJob(d).handler(context());
            expect(result.success).toBe(false);
            expect(result.details).toMatchObject({ outcome: 'refused' });
            expect(pingWatchdog).not.toHaveBeenCalled();
        });

        it('is due on the 1st of the month and not on any other day', async () => {
            const handle = (now: Date) =>
                createProviderWatchBatteryJob(
                    production({ now: () => now, readAuthorization: async () => AUTHORIZED }).deps
                ).handler(context());
            expect((await handle(FIRST)).message).not.toBe('Not due today');
            expect((await handle(new Date('2026-11-02T10:00:00.000Z'))).message).toBe(
                'Not due today'
            );
            expect((await handle(new Date('2026-11-09T10:00:00.000Z'))).message).toBe(
                'Not due today'
            );
            expect((await handle(new Date('2026-11-30T10:00:00.000Z'))).message).toBe(
                'Not due today'
            );
        });

        it('skips a not-due scheduled tick without recording, consuming or pinging', async () => {
            const {
                deps: d,
                recorded,
                started,
                pingWatchdog
            } = production({
                now: () => new Date('2026-11-16T10:00:00.000Z'),
                readAuthorization: async () => AUTHORIZED
            });
            const result = await createProviderWatchBatteryJob(d).handler(context());
            expect(result).toMatchObject({ success: true, message: 'Not due today' });
            expect(recorded).toEqual([]);
            expect(started).toEqual([]);
            expect(pingWatchdog).not.toHaveBeenCalled();
        });

        it('runs a manual trigger on any day', async () => {
            const { deps: d, recorded } = production({
                now: () => new Date('2026-11-16T10:00:00.000Z'),
                readAuthorization: async () => AUTHORIZED
            });
            await createProviderWatchBatteryJob(d).handler(context({ executionMode: 'manual' }));
            expect(recorded).toHaveLength(1);
        });
    });

    it('ticks the sandbox account on Mondays only', async () => {
        const handle = (now: Date) =>
            createProviderWatchBatteryJob(deps({ now: () => now }).deps).handler(context());
        expect((await handle(MONDAY)).message).not.toBe('Not due today');
        expect((await handle(new Date('2026-11-03T10:00:00.000Z'))).message).toBe('Not due today');
    });

    it('fails when the environment does not say which account to watch', async () => {
        const { deps: d, recorded, pingWatchdog } = deps({ resolveAccount: () => null });
        const result = await createProviderWatchBatteryJob(d).handler(context());
        expect(result.success).toBe(false);
        expect(recorded).toEqual([]);
        expect(pingWatchdog).not.toHaveBeenCalled();
    });

    it('fails, without pinging, when the run cannot be written', async () => {
        const { deps: d, pingWatchdog } = deps({
            finishRun: async () => {
                throw new Error('db down');
            }
        });
        const ctx = context();
        const result = await createProviderWatchBatteryJob(d).handler(ctx);
        expect(result).toMatchObject({
            success: false,
            message: expect.stringContaining('db down')
        });
        expect(pingWatchdog).not.toHaveBeenCalled();
        expect(ctx.logger.error).toHaveBeenCalledWith(
            'Provider watch battery failed',
            { error: 'db down' },
            { capture: true }
        );
    });

    it('does nothing in a dry run', async () => {
        const { deps: d, recorded, started, pingWatchdog } = deps();
        const result = await createProviderWatchBatteryJob(d).handler(context({ dryRun: true }));
        expect(result).toMatchObject({ success: true, details: { dryRun: true } });
        expect(recorded).toEqual([]);
        expect(started).toEqual([]);
        expect(pingWatchdog).not.toHaveBeenCalled();
    });

    describe('cancellation and the deadline', () => {
        it('hands the run signal to the transport', async () => {
            const controller = new AbortController();
            const buildTransport = vi.fn(() => async () => ({ status: 200, body: { id: 'x' } }));
            const { deps: d } = deps({ buildTransport });
            await createProviderWatchBatteryJob(d).handler(context({ signal: controller.signal }));
            expect(buildTransport).toHaveBeenCalledWith({ signal: controller.signal });
        });

        it('persists a run whose signal was aborted as failed, never pings, and starts no measurement', async () => {
            const controller = new AbortController();
            controller.abort();
            const measure = vi.fn(async () => ({ found: true }));
            const {
                deps: d,
                recorded,
                pingWatchdog
            } = deps({ catalog: [{ ...readEntry, measure }] });
            const result = await createProviderWatchBatteryJob(d).handler(
                context({ signal: controller.signal })
            );
            expect(result.success).toBe(false);
            expect(result.details).toMatchObject({ outcome: 'failed' });
            expect(recorded[0]?.outcome).toBe('failed');
            expect(recorded[0]?.reason).toContain('TIMED_OUT');
            expect(measure).not.toHaveBeenCalled();
            expect(pingWatchdog).not.toHaveBeenCalled();
        });

        it('does not start a measurement past the deadline and never pings', async () => {
            const measure = vi.fn(async () => ({ found: true }));
            const {
                deps: d,
                recorded,
                pingWatchdog
            } = deps({ catalog: [{ ...readEntry, measure }] });
            const result = await createProviderWatchBatteryJob(d).handler(
                context({ deadlineAt: new Date(MONDAY.getTime() - 1) })
            );
            expect(result.success).toBe(false);
            expect(recorded[0]?.outcome).toBe('failed');
            expect(measure).not.toHaveBeenCalled();
            expect(pingWatchdog).not.toHaveBeenCalled();
        });

        it('fails, and does not ping, a run whose signal aborted during its last measurement', async () => {
            const controller = new AbortController();
            const last: WatchEntry = {
                ...readEntry,
                measure: async () => {
                    controller.abort();
                    return { found: true };
                }
            };
            const { deps: d, pingWatchdog } = deps({ catalog: [last] });
            const result = await createProviderWatchBatteryJob(d).handler(
                context({ signal: controller.signal })
            );
            expect(result.success).toBe(false);
            expect(result.details).toMatchObject({ outcome: 'failed' });
            expect(pingWatchdog).not.toHaveBeenCalled();
        });
    });
});
