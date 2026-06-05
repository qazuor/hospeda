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
const { mockListEntries } = vi.hoisted(() => ({
    mockListEntries: vi.fn()
}));
const { mockActor } = vi.hoisted(() => ({
    mockActor: {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'SUPER_ADMIN',
        permissions: ['system.maintenanceMode']
    }
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createAdminListRoute: vi.fn((config: { path: string; handler: CapturedHandler }) => {
        capturedHandlers.set(config.path, config.handler);
        return config.handler;
    })
}));

vi.mock('../../../src/utils/actor', () => ({ getActorFromContext: () => mockActor }));

vi.mock('@repo/service-core', () => ({
    AppLogEntryService: vi.fn(() => ({
        listEntries: mockListEntries
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

// Importing the module runs createAdminListRoute and captures the handler.
await import('../../../src/routes/app-logs/list');

const fakeCtx = {} as unknown;

describe('admin app-logs list route (SPEC-184)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers the list route', () => {
        expect(capturedHandlers.has('/')).toBe(true);
    });

    describe('GET / — standard envelope', () => {
        it('returns items + full pagination metadata with default params', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [{ id: 'a' }], total: 1 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, undefined)) as {
                items: unknown[];
                pagination: {
                    page: number;
                    pageSize: number;
                    total: number;
                    totalPages: number;
                    hasNextPage: boolean;
                    hasPreviousPage: boolean;
                };
            };

            expect(res.items).toHaveLength(1);
            expect(res.pagination.total).toBe(1);
            expect(res.pagination.page).toBe(1);
            // NOTE: 50 is AppLogEntryFilterSchema's own default, observable here
            // because this test invokes the handler directly with no query. In
            // production, Hono's validation layer (createAdminListRoute merges
            // PaginationQuerySchema first) fills pageSize=20 before the handler
            // runs, so raw API callers omitting pageSize get 20, not 50.
            expect(res.pagination.pageSize).toBe(50);
            expect(res.pagination.totalPages).toBe(1);
            expect(res.pagination.hasNextPage).toBe(false);
            expect(res.pagination.hasPreviousPage).toBe(false);
        });

        it('calculates totalPages correctly for multi-page result', async () => {
            mockListEntries.mockResolvedValue({
                data: { items: Array(10).fill({ id: 'x' }), total: 55 }
            });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                page: '2',
                pageSize: '10'
            })) as {
                pagination: { totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
            };

            expect(res.pagination.totalPages).toBe(6);
            expect(res.pagination.hasNextPage).toBe(true);
            expect(res.pagination.hasPreviousPage).toBe(true);
        });

        it('hasNextPage is false on the last page', async () => {
            mockListEntries.mockResolvedValue({
                data: { items: Array(5).fill({ id: 'x' }), total: 15 }
            });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                page: '3',
                pageSize: '5'
            })) as {
                pagination: { hasNextPage: boolean; hasPreviousPage: boolean; totalPages: number };
            };

            expect(res.pagination.totalPages).toBe(3);
            expect(res.pagination.hasNextPage).toBe(false);
            expect(res.pagination.hasPreviousPage).toBe(true);
        });

        it('hasPreviousPage is false on the first page', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [{ id: 'a' }], total: 20 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                page: '1',
                pageSize: '10'
            })) as { pagination: { hasPreviousPage: boolean } };

            expect(res.pagination.hasPreviousPage).toBe(false);
        });
    });

    describe('GET / — filters', () => {
        it('forwards level/category/date filters to the service', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                level: 'ERROR',
                category: 'API',
                fromDate: '2026-06-01',
                page: '2',
                pageSize: '25'
            });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.level).toBe('ERROR');
            expect(callArg.filter.category).toBe('API');
            expect(callArg.filter.fromDate).toEqual(new Date('2026-06-01'));
            expect(callArg.filter.page).toBe(2);
            expect(callArg.filter.pageSize).toBe(25);
        });

        it('forwards requestId filter to the service', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { requestId: 'req-abc-123' });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.requestId).toBe('req-abc-123');
        });

        it('forwards userId filter to the service', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });
            const userId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { userId });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.userId).toBe(userId);
        });

        it('forwards method filter to the service', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { method: 'DELETE' });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.method).toBe('DELETE');
        });

        it('forwards path filter to the service', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { path: '/api/v1/admin' });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.path).toBe('/api/v1/admin');
        });

        it('forwards all four request-context filters together', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });
            const userId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                requestId: 'req-combo',
                userId,
                method: 'PATCH',
                path: '/api/v1/protected'
            });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.requestId).toBe('req-combo');
            expect(callArg.filter.userId).toBe(userId);
            expect(callArg.filter.method).toBe('PATCH');
            expect(callArg.filter.path).toBe('/api/v1/protected');
        });

        it('rejects an invalid userId (non-UUID) via schema validation', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await expect(
                handler(fakeCtx, undefined, undefined, { userId: 'not-a-uuid' })
            ).rejects.toThrow();
        });

        it('rejects a requestId longer than 64 characters via schema validation', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await expect(
                handler(fakeCtx, undefined, undefined, { requestId: 'x'.repeat(65) })
            ).rejects.toThrow();
        });
    });

    describe('GET / — sort param', () => {
        it('uses loggedAt desc by default (no sort param)', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, undefined);

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                sort: { field: string; direction: string };
            };
            expect(callArg.sort.field).toBe('loggedAt');
            expect(callArg.sort.direction).toBe('desc');
        });

        it('accepts loggedAt:asc sort', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { sort: 'loggedAt:asc' });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                sort: { field: string; direction: string };
            };
            expect(callArg.sort.field).toBe('loggedAt');
            expect(callArg.sort.direction).toBe('asc');
        });

        it('accepts loggedAt:desc sort', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { sort: 'loggedAt:desc' });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                sort: { field: string; direction: string };
            };
            expect(callArg.sort.field).toBe('loggedAt');
            expect(callArg.sort.direction).toBe('desc');
        });

        it('accepts level:asc sort', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { sort: 'level:asc' });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                sort: { field: string; direction: string };
            };
            expect(callArg.sort.field).toBe('level');
            expect(callArg.sort.direction).toBe('asc');
        });

        it('accepts level:desc sort', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { sort: 'level:desc' });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                sort: { field: string; direction: string };
            };
            expect(callArg.sort.field).toBe('level');
            expect(callArg.sort.direction).toBe('desc');
        });

        it('rejects an invalid sort field (not in whitelist)', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            // 'message' is not a whitelisted field — schema regex rejects it
            await expect(
                handler(fakeCtx, undefined, undefined, { sort: 'message:desc' })
            ).rejects.toThrow();
        });

        it('rejects an invalid sort direction', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await expect(
                handler(fakeCtx, undefined, undefined, { sort: 'loggedAt:random' })
            ).rejects.toThrow();
        });

        it('rejects a sort value with no colon separator', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await expect(
                handler(fakeCtx, undefined, undefined, { sort: 'loggedAt' })
            ).rejects.toThrow();
        });
    });

    describe('GET / — error handling', () => {
        it('throws when the service returns an error', async () => {
            mockListEntries.mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'boom' }
            });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await expect(handler(fakeCtx, undefined, undefined, undefined)).rejects.toThrow('boom');
        });
    });
});
