/**
 * Tests for admin AI usage reporting routes (SPEC-173 T-033).
 *
 * Uses the handler-capture-via-mock pattern (identical to prompts.test.ts).
 *
 * Key invariants:
 * - GET /monthly returns paginated monthly aggregate rows; pagination slices correctly.
 * - GET /by-user  returns paginated per-user rows; year/month required and validated.
 * - GET /by-feature returns paginated per-feature rows; year/month required and validated.
 * - since > until on /monthly → validation error (ZodError).
 * - Invalid userId (not UUID) → ZodError.
 * - Year out of range → ZodError.
 * - Month out of range → ZodError.
 * - Non-admin actor → the route factory enforces the permission guard (tested via
 *   the route-factory mock asserting requiredPermissions config).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

type CapturedHandler = (
    ctx: unknown,
    params?: Record<string, unknown>,
    body?: Record<string, unknown>,
    query?: Record<string, unknown>
) => Promise<unknown>;

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { capturedListHandlers } = vi.hoisted(() => ({
    capturedListHandlers: new Map<string, CapturedHandler>()
}));

const { mockGetMonthlyUsage, mockGetUsageByUser, mockGetUsageByFeature } = vi.hoisted(() => ({
    mockGetMonthlyUsage: vi.fn(),
    mockGetUsageByUser: vi.fn(),
    mockGetUsageByFeature: vi.fn()
}));

// Capture `requiredPermissions` config to verify permission guard wiring.
const { capturedPermissions } = vi.hoisted(() => ({
    capturedPermissions: new Map<string, string[]>()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/route-factory', () => ({
    createAdminListRoute: vi.fn(
        (config: { path: string; handler: CapturedHandler; requiredPermissions?: string[] }) => {
            capturedListHandlers.set(config.path, config.handler);
            if (config.requiredPermissions) {
                capturedPermissions.set(config.path, config.requiredPermissions);
            }
            return config.handler;
        }
    ),
    // createAdminRoute not used by usage routes but mock for completeness
    createAdminRoute: vi.fn()
}));

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: () => ({
        route: vi.fn()
    })
}));

vi.mock('@repo/ai-core', () => ({
    getMonthlyUsage: mockGetMonthlyUsage,
    getUsageByUser: mockGetUsageByUser,
    getUsageByFeature: mockGetUsageByFeature
}));

// Importing the module captures handlers via the route-factory mock.
await import('../../../src/routes/ai/usage/index');

const fakeCtx = {} as unknown;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MONTHLY_ROW_JAN: {
    month: string;
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
} = {
    month: '2026-01',
    calls: 5,
    tokensIn: 1200,
    tokensOut: 600,
    costMicroUsd: 400
};

const MONTHLY_ROW_FEB: typeof MONTHLY_ROW_JAN = {
    month: '2026-02',
    calls: 12,
    tokensIn: 3000,
    tokensOut: 1500,
    costMicroUsd: 950
};

const USER_ROW_A: {
    userId: string | null;
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
} = {
    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    calls: 50,
    tokensIn: 10000,
    tokensOut: 4000,
    costMicroUsd: 3200
};

const USER_ROW_ANON: typeof USER_ROW_A = {
    userId: null,
    calls: 2,
    tokensIn: 400,
    tokensOut: 200,
    costMicroUsd: 120
};

const FEATURE_ROW_CHAT: {
    feature: string;
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
} = {
    feature: 'chat',
    calls: 100,
    tokensIn: 20000,
    tokensOut: 8000,
    costMicroUsd: 5000
};

const FEATURE_ROW_TEXT: typeof FEATURE_ROW_CHAT = {
    feature: 'text_improve',
    calls: 30,
    tokensIn: 6000,
    tokensOut: 2500,
    costMicroUsd: 1800
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin AI usage reporting routes (SPEC-173 T-033)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // GET /monthly
    // =========================================================================

    describe('GET /monthly', () => {
        it('registers the /monthly list route', () => {
            expect(capturedListHandlers.has('/monthly')).toBe(true);
        });

        it('requires AI_SETTINGS_MANAGE permission', () => {
            expect(capturedPermissions.get('/monthly')).toContain('ai.settings.manage');
        });

        it('returns paginated monthly rows', async () => {
            mockGetMonthlyUsage.mockResolvedValue([MONTHLY_ROW_JAN, MONTHLY_ROW_FEB]);

            const handler = capturedListHandlers.get('/monthly') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                page: '1',
                pageSize: '10'
            })) as { items: (typeof MONTHLY_ROW_JAN)[]; pagination: { total: number } };

            expect(res.items).toHaveLength(2);
            expect(res.items[0]?.month).toBe('2026-01');
            expect(res.items[1]?.month).toBe('2026-02');
            expect(res.pagination.total).toBe(2);
        });

        it('passes since/until/userId/feature to getMonthlyUsage', async () => {
            mockGetMonthlyUsage.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/monthly') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                since: '2026-01-01',
                until: '2026-06-30',
                userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                feature: 'chat'
            });

            expect(mockGetMonthlyUsage).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
                    feature: 'chat'
                })
            );
        });

        it('pagination slices correctly across pages', async () => {
            // 3 rows, page=2 pageSize=2 → only the 3rd row
            const rows = [
                MONTHLY_ROW_JAN,
                MONTHLY_ROW_FEB,
                { ...MONTHLY_ROW_FEB, month: '2026-03' }
            ];
            mockGetMonthlyUsage.mockResolvedValue(rows);

            const handler = capturedListHandlers.get('/monthly') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                page: '2',
                pageSize: '2'
            })) as { items: (typeof MONTHLY_ROW_JAN)[]; pagination: { total: number } };

            expect(res.items).toHaveLength(1);
            expect(res.items[0]?.month).toBe('2026-03');
            expect(res.pagination.total).toBe(3);
        });

        it('throws ZodError when since > until', async () => {
            const handler = capturedListHandlers.get('/monthly') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    since: '2026-07-01',
                    until: '2026-01-01'
                })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError for invalid userId (not a UUID)', async () => {
            const handler = capturedListHandlers.get('/monthly') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    userId: 'not-a-uuid'
                })
            ).rejects.toThrow(ZodError);
        });

        it('returns empty items when getMonthlyUsage returns empty array', async () => {
            mockGetMonthlyUsage.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/monthly') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {})) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(res.items).toHaveLength(0);
            expect(res.pagination.total).toBe(0);
        });
    });

    // =========================================================================
    // GET /by-user
    // =========================================================================

    describe('GET /by-user', () => {
        it('registers the /by-user list route', () => {
            expect(capturedListHandlers.has('/by-user')).toBe(true);
        });

        it('requires AI_SETTINGS_MANAGE permission', () => {
            expect(capturedPermissions.get('/by-user')).toContain('ai.settings.manage');
        });

        it('returns paginated per-user rows including null userId', async () => {
            mockGetUsageByUser.mockResolvedValue([USER_ROW_A, USER_ROW_ANON]);

            const handler = capturedListHandlers.get('/by-user') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6'
            })) as {
                items: (typeof USER_ROW_A)[];
                pagination: { total: number };
            };

            expect(res.items).toHaveLength(2);
            expect(res.items[0]?.userId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
            expect(res.items[1]?.userId).toBeNull();
            expect(res.pagination.total).toBe(2);
        });

        it('passes year/month/feature to getUsageByUser', async () => {
            mockGetUsageByUser.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-user') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6',
                feature: 'text_improve'
            });

            expect(mockGetUsageByUser).toHaveBeenCalledWith(
                expect.objectContaining({ year: 2026, month: 6, feature: 'text_improve' })
            );
        });

        it('pagination slices correctly across pages', async () => {
            const rows = [
                USER_ROW_A,
                USER_ROW_ANON,
                { ...USER_ROW_A, userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' }
            ];
            mockGetUsageByUser.mockResolvedValue(rows);

            const handler = capturedListHandlers.get('/by-user') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6',
                page: '2',
                pageSize: '2'
            })) as { items: (typeof USER_ROW_A)[]; pagination: { total: number } };

            expect(res.items).toHaveLength(1);
            expect(res.pagination.total).toBe(3);
        });

        it('throws ZodError when year is missing', async () => {
            const handler = capturedListHandlers.get('/by-user') as CapturedHandler;

            await expect(handler(fakeCtx, undefined, undefined, { month: '6' })).rejects.toThrow(
                ZodError
            );
        });

        it('throws ZodError when month is missing', async () => {
            const handler = capturedListHandlers.get('/by-user') as CapturedHandler;

            await expect(handler(fakeCtx, undefined, undefined, { year: '2026' })).rejects.toThrow(
                ZodError
            );
        });

        it('throws ZodError when year is below 2024', async () => {
            const handler = capturedListHandlers.get('/by-user') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2000', month: '6' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when year exceeds 2100', async () => {
            const handler = capturedListHandlers.get('/by-user') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2101', month: '6' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when month is 0 (below 1)', async () => {
            const handler = capturedListHandlers.get('/by-user') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2026', month: '0' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when month is 13 (above 12)', async () => {
            const handler = capturedListHandlers.get('/by-user') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2026', month: '13' })
            ).rejects.toThrow(ZodError);
        });
    });

    // =========================================================================
    // GET /by-feature
    // =========================================================================

    describe('GET /by-feature', () => {
        it('registers the /by-feature list route', () => {
            expect(capturedListHandlers.has('/by-feature')).toBe(true);
        });

        it('requires AI_SETTINGS_MANAGE permission', () => {
            expect(capturedPermissions.get('/by-feature')).toContain('ai.settings.manage');
        });

        it('returns paginated per-feature rows', async () => {
            mockGetUsageByFeature.mockResolvedValue([FEATURE_ROW_CHAT, FEATURE_ROW_TEXT]);

            const handler = capturedListHandlers.get('/by-feature') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6'
            })) as {
                items: (typeof FEATURE_ROW_CHAT)[];
                pagination: { total: number };
            };

            expect(res.items).toHaveLength(2);
            expect(res.items[0]?.feature).toBe('chat');
            expect(res.items[1]?.feature).toBe('text_improve');
            expect(res.pagination.total).toBe(2);
        });

        it('passes year/month/userId to getUsageByFeature', async () => {
            mockGetUsageByFeature.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-feature') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '3',
                userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
            });

            expect(mockGetUsageByFeature).toHaveBeenCalledWith(
                expect.objectContaining({
                    year: 2026,
                    month: 3,
                    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
                })
            );
        });

        it('pagination slices correctly across pages', async () => {
            const rows = [
                FEATURE_ROW_CHAT,
                FEATURE_ROW_TEXT,
                { ...FEATURE_ROW_TEXT, feature: 'search' }
            ];
            mockGetUsageByFeature.mockResolvedValue(rows);

            const handler = capturedListHandlers.get('/by-feature') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6',
                page: '2',
                pageSize: '2'
            })) as { items: (typeof FEATURE_ROW_CHAT)[]; pagination: { total: number } };

            expect(res.items).toHaveLength(1);
            expect(res.items[0]?.feature).toBe('search');
            expect(res.pagination.total).toBe(3);
        });

        it('throws ZodError when year is missing', async () => {
            const handler = capturedListHandlers.get('/by-feature') as CapturedHandler;

            await expect(handler(fakeCtx, undefined, undefined, { month: '6' })).rejects.toThrow(
                ZodError
            );
        });

        it('throws ZodError when month is missing', async () => {
            const handler = capturedListHandlers.get('/by-feature') as CapturedHandler;

            await expect(handler(fakeCtx, undefined, undefined, { year: '2026' })).rejects.toThrow(
                ZodError
            );
        });

        it('throws ZodError when year is out of range (below 2024)', async () => {
            const handler = capturedListHandlers.get('/by-feature') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '1999', month: '6' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when month is out of range (above 12)', async () => {
            const handler = capturedListHandlers.get('/by-feature') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2026', month: '99' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError for invalid userId (not a UUID)', async () => {
            const handler = capturedListHandlers.get('/by-feature') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    year: '2026',
                    month: '6',
                    userId: 'not-a-valid-uuid'
                })
            ).rejects.toThrow(ZodError);
        });

        it('returns empty items when getUsageByFeature returns empty array', async () => {
            mockGetUsageByFeature.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-feature') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6'
            })) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(res.items).toHaveLength(0);
            expect(res.pagination.total).toBe(0);
        });
    });

    // =========================================================================
    // Permission guard wiring — non-admin scenario
    // =========================================================================

    describe('permission guard wiring', () => {
        it('all three routes are configured with AI_SETTINGS_MANAGE', () => {
            // Each route must declare AI_SETTINGS_MANAGE so the route factory
            // can enforce the permission. This is the contract test for
            // "non-admin actor → 403": the factory mock receives the permission
            // list, and the real factory enforces it at request time.
            const paths = ['/monthly', '/by-user', '/by-feature'];
            for (const path of paths) {
                expect(capturedPermissions.get(path)).toContain('ai.settings.manage');
            }
        });
    });
});
