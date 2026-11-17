/**
 * HOS-1512 (AC:B1:15): the provider watch battery cron wires the engine to its ports. The
 * safeguards under test: an empty catalog FAILS loudly and never pings the watchdog; only a
 * completed run that measured something pings; production waits for its authorization.
 */
import type { WatchEntry, WatchRunRecord, WatchTransport } from '@repo/payments';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    createProviderWatchBatteryJob,
    PROVIDER_WATCH_SCHEDULE,
    type ProviderWatchBatteryDeps
} from '../../src/cron/jobs/provider-watch-battery.job';
import type { CronJobContext } from '../../src/cron/types';

const NOW = new Date('2026-11-02T10:00:00.000Z');

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

function deps(overrides: Partial<ProviderWatchBatteryDeps> = {}) {
    const recorded: WatchRunRecord[] = [];
    const transport: WatchTransport = async (request) =>
        request.path === '/users/me'
            ? { status: 200, body: { tags: ['test_user'] } }
            : { status: 200, body: { id: 'x' } };
    const pingWatchdog = vi.fn(async () => undefined);
    const base: ProviderWatchBatteryDeps = {
        resolveAccount: () => 'sandbox',
        catalog: [readEntry],
        buildTransport: () => transport,
        readAuthorization: async () => null,
        readPreviousShapes: async () => null,
        recordRun: async ({ run }) => {
            recorded.push(run);
        },
        now: () => NOW,
        pingWatchdog
    };
    return { deps: { ...base, ...overrides }, recorded, pingWatchdog };
}

describe('provider watch battery cron', () => {
    beforeEach(() => vi.clearAllMocks());

    it('registers a weekly exclusive job', () => {
        const job = createProviderWatchBatteryJob(deps().deps);
        expect(job).toMatchObject({
            name: 'provider-watch-battery',
            schedule: PROVIDER_WATCH_SCHEDULE,
            exclusive: true,
            enabled: true
        });
        expect(PROVIDER_WATCH_SCHEDULE).toBe('17 7 * * 1');
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
        const { deps: d, recorded, pingWatchdog } = deps({ catalog: [changed] });
        const result = await createProviderWatchBatteryJob(d).handler(context());
        expect(result.success).toBe(true);
        expect(result.details).toMatchObject({ alerts: 1 });
        expect(recorded[0]?.alerts).toHaveLength(1);
        expect(pingWatchdog).toHaveBeenCalledTimes(1);
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

    it('refuses the production run without the authorization of the month and sends nothing', async () => {
        const sent: string[] = [];
        const { deps: d, pingWatchdog } = deps({
            resolveAccount: () => 'production',
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
        expect(pingWatchdog).not.toHaveBeenCalled();
    });

    it('runs production with the authorization of the current month', async () => {
        const { deps: d, pingWatchdog } = deps({
            resolveAccount: () => 'production',
            readAuthorization: async () => ({ month: '2026-11', maxChargeMinor: 100 })
        });
        const result = await createProviderWatchBatteryJob(d).handler(context());
        expect(result.success).toBe(true);
        expect(pingWatchdog).toHaveBeenCalledTimes(1);
    });

    it('skips a scheduled production tick after the first week of the month, without pinging', async () => {
        const {
            deps: d,
            recorded,
            pingWatchdog
        } = deps({
            resolveAccount: () => 'production',
            now: () => new Date('2026-11-16T10:00:00.000Z')
        });
        const result = await createProviderWatchBatteryJob(d).handler(context());
        expect(result).toMatchObject({ success: true, message: 'Not due this week' });
        expect(recorded).toEqual([]);
        expect(pingWatchdog).not.toHaveBeenCalled();
    });

    it('runs a manual production trigger on any day', async () => {
        const { deps: d, recorded } = deps({
            resolveAccount: () => 'production',
            now: () => new Date('2026-11-16T10:00:00.000Z'),
            readAuthorization: async () => ({ month: '2026-11', maxChargeMinor: 100 })
        });
        await createProviderWatchBatteryJob(d).handler(context({ executionMode: 'manual' }));
        expect(recorded).toHaveLength(1);
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
            recordRun: async () => {
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
        const { deps: d, recorded, pingWatchdog } = deps();
        const result = await createProviderWatchBatteryJob(d).handler(context({ dryRun: true }));
        expect(result).toMatchObject({ success: true, details: { dryRun: true } });
        expect(recorded).toEqual([]);
        expect(pingWatchdog).not.toHaveBeenCalled();
    });
});
