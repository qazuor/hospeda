import { beforeEach, describe, expect, it, vi } from 'vitest';

type CapturedHandler = (
    ctx: unknown,
    params?: unknown,
    body?: unknown,
    query?: unknown
) => Promise<unknown>;

const { capturedHandlers } = vi.hoisted(() => ({
    // keyed by route summary so the two '/'-path routes don't collide
    capturedHandlers: new Map<string, CapturedHandler>()
}));
const { mockListEntries } = vi.hoisted(() => ({
    mockListEntries: vi.fn()
}));
const { mockActor } = vi.hoisted(() => ({
    mockActor: {
        id: '11111111-1111-4111-8111-111111111111',
        role: 'SUPER_ADMIN',
        permissions: ['auditLog.view', 'securityLog.view']
    }
}));

vi.mock('../../../src/utils/route-factory', () => ({
    createAdminListRoute: vi.fn((config: { summary: string; handler: CapturedHandler }) => {
        capturedHandlers.set(config.summary, config.handler);
        return config.handler;
    })
}));

vi.mock('../../../src/utils/actor', () => ({ getActorFromContext: () => mockActor }));

vi.mock('@repo/service-core', () => ({
    AuditLogEntryService: vi.fn(() => ({
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

// Importing the module runs createAdminListRoute twice and captures both handlers.
await import('../../../src/routes/audit-logs/list');

const AUDIT = 'List audit log entries';
const SECURITY = 'List security log entries';
const fakeCtx = {} as unknown;

describe('admin audit/security-logs list routes (SPEC-162)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('registers both list routes', () => {
        expect(capturedHandlers.has(AUDIT)).toBe(true);
        expect(capturedHandlers.has(SECURITY)).toBe(true);
    });

    describe('logType injection (privilege isolation)', () => {
        it('audit route injects logType=audit regardless of query', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get(AUDIT) as CapturedHandler;
            // Even if a client tries to smuggle logType, the route ignores it.
            await handler(fakeCtx, undefined, undefined, { logType: 'security' });

            const callArg = mockListEntries.mock.calls[0]?.[0] as { logType: string };
            expect(callArg.logType).toBe('audit');
        });

        it('security route injects logType=security regardless of query', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get(SECURITY) as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { logType: 'audit' });

            const callArg = mockListEntries.mock.calls[0]?.[0] as { logType: string };
            expect(callArg.logType).toBe('security');
        });
    });

    describe('standard envelope', () => {
        it('returns items + full pagination metadata with default params', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [{ id: 'a' }], total: 1 } });

            const handler = capturedHandlers.get(AUDIT) as CapturedHandler;
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
            expect(res.pagination.pageSize).toBe(50);
            expect(res.pagination.totalPages).toBe(1);
            expect(res.pagination.hasNextPage).toBe(false);
            expect(res.pagination.hasPreviousPage).toBe(false);
        });

        it('calculates totalPages correctly for multi-page result', async () => {
            mockListEntries.mockResolvedValue({
                data: { items: Array(10).fill({ id: 'x' }), total: 55 }
            });

            const handler = capturedHandlers.get(SECURITY) as CapturedHandler;
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
    });

    describe('filters', () => {
        it('forwards eventType/severity/actorId/date filters to the service', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });
            const actorId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

            const handler = capturedHandlers.get(AUDIT) as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                eventType: 'billing.mutation',
                severity: 'critical',
                actorId,
                fromDate: '2026-06-01',
                page: '2',
                pageSize: '25'
            });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                filter: Record<string, unknown>;
            };
            expect(callArg.filter.eventType).toBe('billing.mutation');
            expect(callArg.filter.severity).toBe('critical');
            expect(callArg.filter.actorId).toBe(actorId);
            expect(callArg.filter.fromDate).toEqual(new Date('2026-06-01'));
            expect(callArg.filter.page).toBe(2);
            expect(callArg.filter.pageSize).toBe(25);
        });

        it('rejects an invalid actorId (non-UUID) via schema validation', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get(AUDIT) as CapturedHandler;
            await expect(
                handler(fakeCtx, undefined, undefined, { actorId: 'not-a-uuid' })
            ).rejects.toThrow();
        });
    });

    describe('sort param', () => {
        it('uses loggedAt desc by default (no sort param)', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get(AUDIT) as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, undefined);

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                sort: { field: string; direction: string };
            };
            expect(callArg.sort.field).toBe('loggedAt');
            expect(callArg.sort.direction).toBe('desc');
        });

        it('accepts severity:desc sort', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get(SECURITY) as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, { sort: 'severity:desc' });

            const callArg = mockListEntries.mock.calls[0]?.[0] as {
                sort: { field: string; direction: string };
            };
            expect(callArg.sort.field).toBe('severity');
            expect(callArg.sort.direction).toBe('desc');
        });

        it('rejects an invalid sort field (not in whitelist)', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get(AUDIT) as CapturedHandler;
            // 'message' is not a whitelisted field — schema regex rejects it
            await expect(
                handler(fakeCtx, undefined, undefined, { sort: 'message:desc' })
            ).rejects.toThrow();
        });

        it('rejects an invalid sort direction', async () => {
            mockListEntries.mockResolvedValue({ data: { items: [], total: 0 } });

            const handler = capturedHandlers.get(AUDIT) as CapturedHandler;
            await expect(
                handler(fakeCtx, undefined, undefined, { sort: 'loggedAt:random' })
            ).rejects.toThrow();
        });
    });

    describe('error handling', () => {
        it('throws when the service returns an error', async () => {
            mockListEntries.mockResolvedValue({
                error: { code: 'INTERNAL_ERROR', message: 'boom' }
            });

            const handler = capturedHandlers.get(AUDIT) as CapturedHandler;
            await expect(handler(fakeCtx, undefined, undefined, undefined)).rejects.toThrow('boom');
        });
    });
});
