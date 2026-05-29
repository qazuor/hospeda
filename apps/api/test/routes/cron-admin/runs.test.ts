import { beforeEach, describe, expect, it, vi } from 'vitest';

type CapturedHandler = (
    ctx: unknown,
    params?: unknown,
    body?: unknown,
    query?: unknown
) => Promise<unknown>;

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<string, CapturedHandler>()
}));
const { mockListRuns, mockGetById, mockGetSummary } = vi.hoisted(() => ({
    mockListRuns: vi.fn(),
    mockGetById: vi.fn(),
    mockGetSummary: vi.fn()
}));
const { mockActor } = vi.hoisted(() => ({
    mockActor: {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'SUPER_ADMIN',
        permissions: ['system.maintenanceMode']
    }
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn((config: { path: string; handler: CapturedHandler }) => {
        capturedHandlers.set(config.path, config.handler);
        return config.handler;
    })
}));

vi.mock('../../../src/utils/actor', () => ({ getActorFromContext: () => mockActor }));

vi.mock('@repo/service-core', () => ({
    CronRunService: vi.fn(() => ({
        listRuns: mockListRuns,
        getById: mockGetById,
        getSummary: mockGetSummary
    })),
    ServiceError: class ServiceError extends Error {
        constructor(
            public readonly code: string,
            message: string
        ) {
            super(message);
            this.name = 'ServiceError';
        }
    }
}));

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Importing the module runs createAdminRoute and captures the handlers.
await import('../../../src/routes/cron-admin/runs');

const fakeCtx = {} as unknown;

describe('cron-admin runs routes (SPEC-161)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers the three run-history routes', () => {
        expect(capturedHandlers.has('/runs')).toBe(true);
        expect(capturedHandlers.has('/runs/summary')).toBe(true);
        expect(capturedHandlers.has('/runs/{id}')).toBe(true);
    });

    describe('GET /runs', () => {
        it('returns items + total with default pagination echoed back', async () => {
            mockListRuns.mockResolvedValue({ data: { items: [{ id: 'a' }], total: 1 } });

            const handler = capturedHandlers.get('/runs') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, undefined)) as {
                items: unknown[];
                total: number;
                page: number;
                pageSize: number;
            };

            expect(res.total).toBe(1);
            expect(res.items).toHaveLength(1);
            expect(res.page).toBe(1);
            expect(res.pageSize).toBe(50);
        });

        it('throws when the service returns an error', async () => {
            mockListRuns.mockResolvedValue({ error: { code: 'INTERNAL_ERROR', message: 'boom' } });

            const handler = capturedHandlers.get('/runs') as CapturedHandler;
            await expect(handler(fakeCtx, undefined, undefined, undefined)).rejects.toThrow('boom');
        });
    });

    describe('GET /runs/summary', () => {
        it('returns the summary payload', async () => {
            const summary = {
                lastRuns: [],
                recentFailures: [],
                failingJobsCount: 0,
                generatedAt: new Date()
            };
            mockGetSummary.mockResolvedValue({ data: summary });

            const handler = capturedHandlers.get('/runs/summary') as CapturedHandler;
            const res = await handler(fakeCtx);

            expect(res).toEqual(summary);
        });
    });

    describe('GET /runs/{id}', () => {
        it('returns the run when found', async () => {
            mockGetById.mockResolvedValue({ data: { id: 'run-1' } });

            const handler = capturedHandlers.get('/runs/{id}') as CapturedHandler;
            const res = (await handler(fakeCtx, { id: 'run-1' })) as { id: string };

            expect(res.id).toBe('run-1');
        });

        it('throws NOT_FOUND when the run does not exist', async () => {
            mockGetById.mockResolvedValue({ data: null });

            const handler = capturedHandlers.get('/runs/{id}') as CapturedHandler;
            await expect(handler(fakeCtx, { id: 'missing' })).rejects.toThrow('Cron run not found');
        });
    });
});
