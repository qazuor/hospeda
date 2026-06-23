/**
 * Tests for admin AI usage reporting routes — SPEC-260 T-009…T-012.
 *
 * Covers four new endpoints:
 *   - GET /by-model        (T-009)
 *   - GET /by-provider     (T-010)
 *   - GET /by-feature-model (T-011)
 *   - GET /daily           (T-012)
 *
 * Uses the same handler-capture-via-mock pattern as usage.test.ts (SPEC-173 T-033).
 *
 * Key invariants per endpoint:
 *   - Registered route path exists in capturedListHandlers.
 *   - Requires AI_SETTINGS_MANAGE permission (capturedPermissions check).
 *   - Returns paginated rows with correct shape.
 *   - Passes filter params through to the ai-core wrapper.
 *   - Pagination slices correctly (page N, pageSize M).
 *   - `since > until` → ZodError (422 VALIDATION_ERROR at runtime).
 *   - Invalid `userId` (not UUID) → ZodError.
 *   - Year / month out of range → ZodError.
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

const {
    mockGetUsageByModel,
    mockGetUsageByProvider,
    mockGetUsageByFeatureModel,
    mockGetDailyUsage
} = vi.hoisted(() => ({
    mockGetUsageByModel: vi.fn(),
    mockGetUsageByProvider: vi.fn(),
    mockGetUsageByFeatureModel: vi.fn(),
    mockGetDailyUsage: vi.fn()
}));

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
    createAdminRoute: vi.fn()
}));

vi.mock('../../../src/utils/create-app', () => ({
    createRouter: () => ({
        route: vi.fn()
    })
}));

vi.mock('@repo/ai-core', () => {
    class AiFeatureNotConfiguredError extends Error {
        readonly feature: string;
        constructor(feature: string) {
            super(
                `AI feature '${feature}' is not configured in ai_settings. An admin must save a configuration for this feature before it can be used.`
            );
            this.name = 'AiFeatureNotConfiguredError';
            this.feature = feature;
        }
    }
    return {
        // Re-export existing functions (used by the base routes already imported)
        getMonthlyUsage: vi.fn(),
        getUsageByUser: vi.fn(),
        getUsageByFeature: vi.fn(),
        // New SPEC-260 functions
        getUsageByModel: mockGetUsageByModel,
        getUsageByProvider: mockGetUsageByProvider,
        getUsageByFeatureModel: mockGetUsageByFeatureModel,
        getDailyUsage: mockGetDailyUsage,
        AiFeatureNotConfiguredError
    };
});

// Import the route module — this triggers all createAdminListRoute calls and
// populates capturedListHandlers / capturedPermissions.
await import('../../../src/routes/ai/usage/index');

const fakeCtx = {} as unknown;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MODEL_ROW_MINI: {
    model: string;
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
} = {
    model: 'gpt-4o-mini',
    calls: 120,
    tokensIn: 240000,
    tokensOut: 90000,
    costMicroUsd: 90000
};

const MODEL_ROW_HAIKU: typeof MODEL_ROW_MINI = {
    model: 'claude-3-5-haiku-20241022',
    calls: 40,
    tokensIn: 80000,
    tokensOut: 30000,
    costMicroUsd: 184000
};

const PROVIDER_ROW_OPENAI: {
    provider: string;
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
} = {
    provider: 'openai',
    calls: 200,
    tokensIn: 400000,
    tokensOut: 150000,
    costMicroUsd: 120000
};

const PROVIDER_ROW_ANTHROPIC: typeof PROVIDER_ROW_OPENAI = {
    provider: 'anthropic',
    calls: 50,
    tokensIn: 100000,
    tokensOut: 40000,
    costMicroUsd: 90000
};

const FEATURE_MODEL_ROW_CHAT_MINI: {
    feature: string;
    model: string;
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
} = {
    feature: 'chat',
    model: 'gpt-4o-mini',
    calls: 120,
    tokensIn: 240000,
    tokensOut: 90000,
    costMicroUsd: 90000
};

const FEATURE_MODEL_ROW_CHAT_HAIKU: typeof FEATURE_MODEL_ROW_CHAT_MINI = {
    feature: 'chat',
    model: 'claude-3-5-haiku-20241022',
    calls: 40,
    tokensIn: 80000,
    tokensOut: 30000,
    costMicroUsd: 184000
};

const DAILY_ROW_JUN01: {
    day: string;
    calls: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
} = {
    day: '2026-06-01',
    calls: 5,
    tokensIn: 10000,
    tokensOut: 4000,
    costMicroUsd: 3200
};

const DAILY_ROW_JUN02: typeof DAILY_ROW_JUN01 = {
    day: '2026-06-02',
    calls: 12,
    tokensIn: 24000,
    tokensOut: 9000,
    costMicroUsd: 7800
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin AI usage reporting routes — SPEC-260 T-009…T-012', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // GET /by-model (T-009)
    // =========================================================================

    describe('GET /by-model', () => {
        it('registers the /by-model list route', () => {
            expect(capturedListHandlers.has('/by-model')).toBe(true);
        });

        it('requires AI_SETTINGS_MANAGE permission', () => {
            expect(capturedPermissions.get('/by-model')).toContain('ai.settings.manage');
        });

        it('returns paginated per-model rows ordered by cost DESC', async () => {
            mockGetUsageByModel.mockResolvedValue([MODEL_ROW_HAIKU, MODEL_ROW_MINI]);

            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6'
            })) as { items: (typeof MODEL_ROW_MINI)[]; pagination: { total: number } };

            expect(res.items).toHaveLength(2);
            expect(res.items[0]?.model).toBe('claude-3-5-haiku-20241022');
            expect(res.items[1]?.model).toBe('gpt-4o-mini');
            expect(res.pagination.total).toBe(2);
        });

        it('passes year/month/feature/provider/userId to getUsageByModel', async () => {
            mockGetUsageByModel.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6',
                feature: 'chat',
                provider: 'openai',
                userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
            });

            expect(mockGetUsageByModel).toHaveBeenCalledWith(
                expect.objectContaining({
                    year: 2026,
                    month: 6,
                    feature: 'chat',
                    provider: 'openai',
                    userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
                })
            );
        });

        it('accepts since/until date range instead of year/month', async () => {
            mockGetUsageByModel.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                since: '2026-06-01',
                until: '2026-06-30'
            });

            expect(mockGetUsageByModel).toHaveBeenCalledWith(
                expect.objectContaining({
                    since: new Date('2026-06-01'),
                    until: new Date('2026-06-30')
                })
            );
        });

        it('pagination slices correctly across pages', async () => {
            const rows = [MODEL_ROW_HAIKU, MODEL_ROW_MINI, { ...MODEL_ROW_MINI, model: 'gpt-4o' }];
            mockGetUsageByModel.mockResolvedValue(rows);

            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6',
                page: '2',
                pageSize: '2'
            })) as { items: (typeof MODEL_ROW_MINI)[]; pagination: { total: number } };

            expect(res.items).toHaveLength(1);
            expect(res.items[0]?.model).toBe('gpt-4o');
            expect(res.pagination.total).toBe(3);
        });

        it('returns empty items when getUsageByModel returns empty array', async () => {
            mockGetUsageByModel.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {})) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(res.items).toHaveLength(0);
            expect(res.pagination.total).toBe(0);
        });

        it('throws ZodError when since > until', async () => {
            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    since: '2026-07-01',
                    until: '2026-01-01'
                })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError for invalid userId (not a UUID)', async () => {
            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    year: '2026',
                    month: '6',
                    userId: 'not-a-uuid'
                })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when year is below 2024', async () => {
            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2000', month: '6' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when year exceeds 2100', async () => {
            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2101', month: '6' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when month is 0 (below 1)', async () => {
            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2026', month: '0' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when month is 13 (above 12)', async () => {
            const handler = capturedListHandlers.get('/by-model') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2026', month: '13' })
            ).rejects.toThrow(ZodError);
        });
    });

    // =========================================================================
    // GET /by-provider (T-010)
    // =========================================================================

    describe('GET /by-provider', () => {
        it('registers the /by-provider list route', () => {
            expect(capturedListHandlers.has('/by-provider')).toBe(true);
        });

        it('requires AI_SETTINGS_MANAGE permission', () => {
            expect(capturedPermissions.get('/by-provider')).toContain('ai.settings.manage');
        });

        it('returns paginated per-provider rows', async () => {
            mockGetUsageByProvider.mockResolvedValue([PROVIDER_ROW_OPENAI, PROVIDER_ROW_ANTHROPIC]);

            const handler = capturedListHandlers.get('/by-provider') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6'
            })) as { items: (typeof PROVIDER_ROW_OPENAI)[]; pagination: { total: number } };

            expect(res.items).toHaveLength(2);
            expect(res.items[0]?.provider).toBe('openai');
            expect(res.items[1]?.provider).toBe('anthropic');
            expect(res.pagination.total).toBe(2);
        });

        it('passes year/month/feature/userId to getUsageByProvider', async () => {
            mockGetUsageByProvider.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-provider') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6',
                feature: 'chat',
                userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
            });

            expect(mockGetUsageByProvider).toHaveBeenCalledWith(
                expect.objectContaining({
                    year: 2026,
                    month: 6,
                    feature: 'chat',
                    userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
                })
            );
        });

        it('accepts since/until date range', async () => {
            mockGetUsageByProvider.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-provider') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                since: '2026-01-01',
                until: '2026-03-31'
            });

            expect(mockGetUsageByProvider).toHaveBeenCalledWith(
                expect.objectContaining({
                    since: new Date('2026-01-01'),
                    until: new Date('2026-03-31')
                })
            );
        });

        it('pagination slices correctly across pages', async () => {
            const rows = [
                PROVIDER_ROW_OPENAI,
                PROVIDER_ROW_ANTHROPIC,
                { ...PROVIDER_ROW_ANTHROPIC, provider: 'stub' }
            ];
            mockGetUsageByProvider.mockResolvedValue(rows);

            const handler = capturedListHandlers.get('/by-provider') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6',
                page: '2',
                pageSize: '2'
            })) as { items: (typeof PROVIDER_ROW_OPENAI)[]; pagination: { total: number } };

            expect(res.items).toHaveLength(1);
            expect(res.items[0]?.provider).toBe('stub');
            expect(res.pagination.total).toBe(3);
        });

        it('throws ZodError when since > until', async () => {
            const handler = capturedListHandlers.get('/by-provider') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    since: '2026-12-01',
                    until: '2026-01-01'
                })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError for invalid userId (not a UUID)', async () => {
            const handler = capturedListHandlers.get('/by-provider') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    year: '2026',
                    month: '6',
                    userId: 'bad-id'
                })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when year is out of range', async () => {
            const handler = capturedListHandlers.get('/by-provider') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '1990', month: '6' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when month is out of range', async () => {
            const handler = capturedListHandlers.get('/by-provider') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2026', month: '99' })
            ).rejects.toThrow(ZodError);
        });

        it('returns empty items when getUsageByProvider returns empty array', async () => {
            mockGetUsageByProvider.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-provider') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {})) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(res.items).toHaveLength(0);
            expect(res.pagination.total).toBe(0);
        });
    });

    // =========================================================================
    // GET /by-feature-model (T-011)
    // =========================================================================

    describe('GET /by-feature-model', () => {
        it('registers the /by-feature-model list route', () => {
            expect(capturedListHandlers.has('/by-feature-model')).toBe(true);
        });

        it('requires AI_SETTINGS_MANAGE permission', () => {
            expect(capturedPermissions.get('/by-feature-model')).toContain('ai.settings.manage');
        });

        it('returns paginated feature × model rows ordered by feature ASC then cost DESC', async () => {
            mockGetUsageByFeatureModel.mockResolvedValue([
                FEATURE_MODEL_ROW_CHAT_HAIKU,
                FEATURE_MODEL_ROW_CHAT_MINI
            ]);

            const handler = capturedListHandlers.get('/by-feature-model') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6'
            })) as {
                items: (typeof FEATURE_MODEL_ROW_CHAT_MINI)[];
                pagination: { total: number };
            };

            expect(res.items).toHaveLength(2);
            expect(res.items[0]?.feature).toBe('chat');
            expect(res.items[0]?.model).toBe('claude-3-5-haiku-20241022');
            expect(res.items[1]?.model).toBe('gpt-4o-mini');
            expect(res.pagination.total).toBe(2);
        });

        it('passes year/month/userId to getUsageByFeatureModel', async () => {
            mockGetUsageByFeatureModel.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-feature-model') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '3',
                userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
            });

            expect(mockGetUsageByFeatureModel).toHaveBeenCalledWith(
                expect.objectContaining({
                    year: 2026,
                    month: 3,
                    userId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
                })
            );
        });

        it('accepts since/until date range', async () => {
            mockGetUsageByFeatureModel.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-feature-model') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                since: '2026-05-01',
                until: '2026-06-01'
            });

            expect(mockGetUsageByFeatureModel).toHaveBeenCalledWith(
                expect.objectContaining({
                    since: new Date('2026-05-01'),
                    until: new Date('2026-06-01')
                })
            );
        });

        it('pagination slices correctly across pages', async () => {
            const rows = [
                FEATURE_MODEL_ROW_CHAT_HAIKU,
                FEATURE_MODEL_ROW_CHAT_MINI,
                { ...FEATURE_MODEL_ROW_CHAT_MINI, feature: 'text_improve' }
            ];
            mockGetUsageByFeatureModel.mockResolvedValue(rows);

            const handler = capturedListHandlers.get('/by-feature-model') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6',
                page: '2',
                pageSize: '2'
            })) as {
                items: (typeof FEATURE_MODEL_ROW_CHAT_MINI)[];
                pagination: { total: number };
            };

            expect(res.items).toHaveLength(1);
            expect(res.items[0]?.feature).toBe('text_improve');
            expect(res.pagination.total).toBe(3);
        });

        it('throws ZodError when since > until', async () => {
            const handler = capturedListHandlers.get('/by-feature-model') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    since: '2026-07-01',
                    until: '2026-01-01'
                })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError for invalid userId (not a UUID)', async () => {
            const handler = capturedListHandlers.get('/by-feature-model') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    year: '2026',
                    month: '6',
                    userId: 'not-valid'
                })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when year is out of range', async () => {
            const handler = capturedListHandlers.get('/by-feature-model') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2200', month: '6' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when month is out of range', async () => {
            const handler = capturedListHandlers.get('/by-feature-model') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2026', month: '13' })
            ).rejects.toThrow(ZodError);
        });

        it('returns empty items when getUsageByFeatureModel returns empty array', async () => {
            mockGetUsageByFeatureModel.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/by-feature-model') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {})) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(res.items).toHaveLength(0);
            expect(res.pagination.total).toBe(0);
        });
    });

    // =========================================================================
    // GET /daily (T-012)
    // =========================================================================

    describe('GET /daily', () => {
        it('registers the /daily list route', () => {
            expect(capturedListHandlers.has('/daily')).toBe(true);
        });

        it('requires AI_SETTINGS_MANAGE permission', () => {
            expect(capturedPermissions.get('/daily')).toContain('ai.settings.manage');
        });

        it('returns paginated daily rows ordered by day ASC', async () => {
            mockGetDailyUsage.mockResolvedValue([DAILY_ROW_JUN01, DAILY_ROW_JUN02]);

            const handler = capturedListHandlers.get('/daily') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6'
            })) as { items: (typeof DAILY_ROW_JUN01)[]; pagination: { total: number } };

            expect(res.items).toHaveLength(2);
            expect(res.items[0]?.day).toBe('2026-06-01');
            expect(res.items[1]?.day).toBe('2026-06-02');
            expect(res.pagination.total).toBe(2);
        });

        it('passes year/month/feature/model/provider/userId to getDailyUsage', async () => {
            mockGetDailyUsage.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/daily') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6',
                feature: 'chat',
                model: 'gpt-4o-mini',
                provider: 'openai',
                userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
            });

            expect(mockGetDailyUsage).toHaveBeenCalledWith(
                expect.objectContaining({
                    year: 2026,
                    month: 6,
                    feature: 'chat',
                    model: 'gpt-4o-mini',
                    provider: 'openai',
                    userId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
                })
            );
        });

        it('accepts since/until date range', async () => {
            mockGetDailyUsage.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/daily') as CapturedHandler;
            await handler(fakeCtx, undefined, undefined, {
                since: '2026-06-01',
                until: '2026-06-30'
            });

            expect(mockGetDailyUsage).toHaveBeenCalledWith(
                expect.objectContaining({
                    since: new Date('2026-06-01'),
                    until: new Date('2026-06-30')
                })
            );
        });

        it('pagination slices correctly across pages', async () => {
            const rows = [
                DAILY_ROW_JUN01,
                DAILY_ROW_JUN02,
                { ...DAILY_ROW_JUN02, day: '2026-06-03' }
            ];
            mockGetDailyUsage.mockResolvedValue(rows);

            const handler = capturedListHandlers.get('/daily') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {
                year: '2026',
                month: '6',
                page: '2',
                pageSize: '2'
            })) as { items: (typeof DAILY_ROW_JUN01)[]; pagination: { total: number } };

            expect(res.items).toHaveLength(1);
            expect(res.items[0]?.day).toBe('2026-06-03');
            expect(res.pagination.total).toBe(3);
        });

        it('throws ZodError when since > until', async () => {
            const handler = capturedListHandlers.get('/daily') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    since: '2026-12-31',
                    until: '2026-01-01'
                })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError for invalid userId (not a UUID)', async () => {
            const handler = capturedListHandlers.get('/daily') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, {
                    year: '2026',
                    month: '6',
                    userId: 'bad-uuid'
                })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when year is below 2024', async () => {
            const handler = capturedListHandlers.get('/daily') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2023', month: '6' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when year exceeds 2100', async () => {
            const handler = capturedListHandlers.get('/daily') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2101', month: '6' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when month is 0 (below 1)', async () => {
            const handler = capturedListHandlers.get('/daily') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2026', month: '0' })
            ).rejects.toThrow(ZodError);
        });

        it('throws ZodError when month is 13 (above 12)', async () => {
            const handler = capturedListHandlers.get('/daily') as CapturedHandler;

            await expect(
                handler(fakeCtx, undefined, undefined, { year: '2026', month: '13' })
            ).rejects.toThrow(ZodError);
        });

        it('returns empty items when getDailyUsage returns empty array', async () => {
            mockGetDailyUsage.mockResolvedValue([]);

            const handler = capturedListHandlers.get('/daily') as CapturedHandler;
            const res = (await handler(fakeCtx, undefined, undefined, {})) as {
                items: unknown[];
                pagination: { total: number };
            };

            expect(res.items).toHaveLength(0);
            expect(res.pagination.total).toBe(0);
        });
    });

    // =========================================================================
    // Permission guard wiring — all four new routes
    // =========================================================================

    describe('permission guard wiring', () => {
        it('all four SPEC-260 routes are configured with AI_SETTINGS_MANAGE', () => {
            const paths = ['/by-model', '/by-provider', '/by-feature-model', '/daily'];
            for (const path of paths) {
                expect(capturedPermissions.get(path)).toContain('ai.settings.manage');
            }
        });
    });
});
