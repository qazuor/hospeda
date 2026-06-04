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
    createAdminRoute: vi.fn((config: { path: string; handler: CapturedHandler }) => {
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

// Importing the module runs createAdminRoute and captures the handler.
await import('../../../src/routes/app-logs/list');

const fakeCtx = {} as unknown;

describe('admin app-logs list route (SPEC-184)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers the list route', () => {
        expect(capturedHandlers.has('/')).toBe(true);
    });

    describe('GET /', () => {
        it('returns items + total with default pagination echoed back', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [{ id: 'a' }], total: 1 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;
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
            // Arrange
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;

            // Act
            await handler(fakeCtx, undefined, undefined, {
                requestId: 'req-abc-123'
            });

            // Assert
            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.requestId).toBe('req-abc-123');
        });

        it('forwards userId filter to the service', async () => {
            // Arrange
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });
            const userId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

            const handler = capturedHandlers.get('/') as CapturedHandler;

            // Act
            await handler(fakeCtx, undefined, undefined, { userId });

            // Assert
            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.userId).toBe(userId);
        });

        it('forwards method filter to the service', async () => {
            // Arrange
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;

            // Act
            await handler(fakeCtx, undefined, undefined, { method: 'DELETE' });

            // Assert
            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.method).toBe('DELETE');
        });

        it('forwards path filter to the service', async () => {
            // Arrange
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;

            // Act
            await handler(fakeCtx, undefined, undefined, { path: '/api/v1/admin' });

            // Assert
            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.path).toBe('/api/v1/admin');
        });

        it('rejects an invalid userId (non-UUID) via schema validation', async () => {
            // Arrange
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;

            // Act + Assert — AppLogEntryFilterSchema.parse throws ZodError for bad UUID
            await expect(
                handler(fakeCtx, undefined, undefined, { userId: 'not-a-uuid' })
            ).rejects.toThrow();
        });

        it('rejects a requestId longer than 64 characters via schema validation', async () => {
            // Arrange
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get('/') as CapturedHandler;

            // Act + Assert
            await expect(
                handler(fakeCtx, undefined, undefined, { requestId: 'x'.repeat(65) })
            ).rejects.toThrow();
        });

        it('forwards all four new request-context filters together', async () => {
            // Arrange
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });
            const userId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

            const handler = capturedHandlers.get('/') as CapturedHandler;

            // Act
            await handler(fakeCtx, undefined, undefined, {
                requestId: 'req-combo',
                userId,
                method: 'PATCH',
                path: '/api/v1/protected'
            });

            // Assert
            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.requestId).toBe('req-combo');
            expect(callArg.filter.userId).toBe(userId);
            expect(callArg.filter.method).toBe('PATCH');
            expect(callArg.filter.path).toBe('/api/v1/protected');
        });

        it('throws when the service returns an error', async () => {
            mockListEntries.mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'boom' }
            });

            const handler = capturedHandlers.get('/') as CapturedHandler;
            await expect(handler(fakeCtx, undefined, undefined, undefined)).rejects.toThrow('boom');
        });
    });
});
