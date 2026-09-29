/**
 * Regression tests for HOS-410: `?dryRun=false` used to run the manually
 * triggered cron in dry-run because the query schema used `z.coerce.boolean()`
 * (`Boolean('false') === true`).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

type RouteConfig = {
    path: string;
    requestQuery?: Record<string, z.ZodTypeAny>;
    handler: (ctx: unknown, params?: unknown, body?: unknown, query?: unknown) => Promise<unknown>;
};

const { capturedRoutes, mockJobHandler, mockRecordCronRun } = vi.hoisted(() => ({
    capturedRoutes: new Map<string, unknown>(),
    mockJobHandler: vi.fn(),
    mockRecordCronRun: vi.fn()
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn((config: RouteConfig) => {
        capturedRoutes.set(config.path, config);
        return new Hono();
    })
}));
vi.mock('../../../src/routes/cron-admin/runs', () => ({
    cronRunSummaryRoute: new Hono(),
    getCronRunByIdRoute: new Hono(),
    listCronRunsRoute: new Hono()
}));
vi.mock('../../../src/cron/registry', () => ({
    cronJobs: [],
    getCronJob: vi.fn(() => ({
        name: 'demo',
        enabled: true,
        schedule: '* * * * *',
        description: 'demo',
        handler: mockJobHandler
    }))
}));
vi.mock('../../../src/cron/record-run', () => ({ recordCronRun: mockRecordCronRun }));
vi.mock('@repo/service-core', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    CronRunService: vi.fn()
}));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

await import('../../../src/routes/cron-admin/index');

const triggerConfig = capturedRoutes.get('/{jobName}') as RouteConfig;
const querySchema = z.object(triggerConfig.requestQuery ?? {});

/** Runs the request query through the route schema, then the handler, like the factory does. */
const trigger = async (rawQuery: Record<string, string>) => {
    const parsed = querySchema.parse(rawQuery);
    return (await triggerConfig.handler({}, { jobName: 'demo' }, {}, parsed)) as {
        dryRun: boolean;
    };
};

describe('POST /admin/cron/{jobName} dryRun query (HOS-410)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockJobHandler.mockResolvedValue({
            success: true,
            message: 'ok',
            processed: 0,
            errors: 0,
            durationMs: 1
        });
    });

    it('?dryRun=false runs the job for real', async () => {
        const res = await trigger({ dryRun: 'false' });

        expect(res.dryRun).toBe(false);
        expect(mockJobHandler).toHaveBeenCalledWith(expect.objectContaining({ dryRun: false }));
    });

    it('?dryRun=true runs the job in dry-run', async () => {
        const res = await trigger({ dryRun: 'true' });

        expect(res.dryRun).toBe(true);
        expect(mockJobHandler).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    });

    it('an absent dryRun keeps the historical default (real run)', async () => {
        const res = await trigger({});

        expect(res.dryRun).toBe(false);
    });

    it.each(['', 'yes', '1', 'TRUE'])('rejects the ambiguous value %j instead of guessing', (v) => {
        expect(() => querySchema.parse({ dryRun: v })).toThrow();
    });
});
