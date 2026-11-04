import { currentTrafficContext } from '@repo/payments';
import { describe, expect, it } from 'vitest';
import { runCronHandlerInBackground } from '../../src/cron/traffic';
import type { CronJobContext } from '../../src/cron/types';

const context: CronJobContext = {
    logger: { info() {}, warn() {}, error() {}, debug() {} },
    startedAt: new Date('2026-10-01T00:00:00.000Z'),
    runId: 'memo-hit-run',
    correlationId: 'memo-hit-correlation',
    dryRun: false
};

describe('cron provider memo hit counters', () => {
    it('counts memo hits without counting them as requests', async () => {
        const result = await runCronHandlerInBackground({
            ctx: context,
            job: {
                handler: async () => {
                    currentTrafficContext()?.counters?.record({
                        trafficClass: 'background',
                        capability: 'read',
                        memoHit: true
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
                requests: 0,
                memoHits: 1,
                byCapability: { 'background:read': { requests: 0, memoHits: 1 } }
            }
        });
    });
});
