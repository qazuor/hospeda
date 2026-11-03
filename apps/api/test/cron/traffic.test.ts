import {
    currentTrafficContext,
    GOVERNOR_MAX_WAIT_SAMPLES,
    ProviderTrafficGovernor,
    runWithTrafficClass
} from '@repo/payments';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runCronHandlerInBackground } from '../../src/cron/traffic';
import type { CronJobContext } from '../../src/cron/types';

const context: CronJobContext = {
    logger: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined
    },
    startedAt: new Date('2026-10-01T00:00:00.000Z'),
    runId: 'run-id',
    correlationId: 'correlation-id',
    dryRun: false
};

describe('cron provider traffic context', () => {
    afterEach(() => vi.useRealTimers());

    it('overrides an interactive parent and only attaches traffic details after a governed request (kills missing cron class)', async () => {
        const governor = new ProviderTrafficGovernor({ mode: 'observe' });
        const result = await runWithTrafficClass({
            context: { trafficClass: 'interactive' },
            fn: () =>
                runCronHandlerInBackground({
                    ctx: context,
                    job: {
                        handler: async () => {
                            expect(currentTrafficContext()?.trafficClass).toBe('background');
                            await governor.acquire({
                                trafficClass: 'background',
                                capability: 'read'
                            });
                            governor.observe({
                                trafficClass: 'background',
                                capability: 'read',
                                status: 200
                            });
                            return {
                                success: true,
                                message: 'ok',
                                processed: 1,
                                errors: 0,
                                durationMs: 1,
                                details: { retained: true }
                            };
                        }
                    }
                })
        });
        expect(result.details).toMatchObject({
            retained: true,
            providerTraffic: { requests: 1, status2xx: 1 }
        });
        const unchanged = await runCronHandlerInBackground({
            ctx: context,
            job: {
                handler: async () => ({
                    success: true,
                    message: 'ok',
                    processed: 0,
                    errors: 0,
                    durationMs: 1,
                    details: { retained: true }
                })
            }
        });
        expect(unchanged).toEqual({
            success: true,
            message: 'ok',
            processed: 0,
            errors: 0,
            durationMs: 1,
            details: { retained: true }
        });
        governor.stop();
    });

    it('bounds the run-wide wait sample list', async () => {
        const result = await runCronHandlerInBackground({
            ctx: context,
            job: {
                handler: async () => {
                    const counters = currentTrafficContext()?.counters;
                    counters?.record({
                        trafficClass: 'background',
                        capability: 'read',
                        waitMs: 999_999
                    });
                    for (let index = 1; index <= GOVERNOR_MAX_WAIT_SAMPLES; index += 1)
                        counters?.record({
                            trafficClass: 'background',
                            capability: 'read',
                            waitMs: 7
                        });
                    counters?.record({
                        trafficClass: 'background',
                        capability: 'read',
                        request: true
                    });
                    return {
                        success: true,
                        message: 'ok',
                        processed: 0,
                        errors: 0,
                        durationMs: 1,
                        details: {}
                    };
                }
            }
        });
        expect(result.details).toMatchObject({
            providerTraffic: {
                requests: 1,
                waitMs: { max: 7 }
            }
        });
    });

    it('passes the job signal through AsyncLocalStorage to governor.acquire', async () => {
        vi.useFakeTimers();
        const controller = new AbortController();
        const governor = new ProviderTrafficGovernor({
            mode: 'enforce',
            burst: 0,
            ratePerSecond: 1
        });
        const signalContext: CronJobContext = {
            ...context,
            signal: controller.signal,
            deadlineAt: new Date(Date.now() + 10)
        };
        const execution = runCronHandlerInBackground({
            ctx: signalContext,
            governor,
            job: {
                handler: async () => {
                    setTimeout(() => controller.abort(), 10);
                    await governor.acquire({ trafficClass: 'background', capability: 'read' });
                    return {
                        success: true,
                        message: 'unexpected acquisition',
                        processed: 0,
                        errors: 0,
                        durationMs: 0
                    };
                }
            }
        });
        const executionAssertion = expect(execution).rejects.toThrow('request aborted');
        await vi.advanceTimersByTimeAsync(10);
        await executionAssertion;
        governor.stop();
    });
});
