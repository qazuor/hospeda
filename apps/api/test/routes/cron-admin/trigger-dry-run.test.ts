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
const { runWithRequestContext } = await import('../../../src/lib/request-context');

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

describe('POST /admin/cron/{jobName} run ids (HOS-1424, TEST:U2:9)', () => {
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

    it('a manual run carries a fresh run id and the correlation of the request that triggered it', async () => {
        // Arrange
        const correlationId = crypto.randomUUID();

        // Act
        await runWithRequestContext({
            store: {
                requestId: 'r',
                correlationId,
                method: 'POST',
                path: '/api/v1/admin/cron/demo'
            },
            fn: async () => {
                await trigger({});
            }
        });

        // Assert
        const ctx = mockJobHandler.mock.calls[0]?.[0] as { runId: string; correlationId: string };
        expect(ctx.correlationId).toBe(correlationId);
        expect(ctx.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(ctx.runId).not.toBe(correlationId);
    });

    it('outside a request scope it mints the run correlation', async () => {
        // Act
        await trigger({});
        await trigger({});

        // Assert
        const [first, second] = mockJobHandler.mock.calls.map(
            (call) => (call[0] as { correlationId: string; runId: string }).correlationId
        );
        expect(first).toMatch(/^[0-9a-f-]{36}$/);
        expect(first).not.toBe(second);
    });
});
