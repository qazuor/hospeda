/**
 * Integration tests for GET /api/v1/ai/social/catalog — SPEC-254 T-026.
 *
 * Tests:
 *  - valid api-key → 200 with all 8 collections + defaults
 *  - missing api-key header → 401
 *  - invalid api-key value → 401
 *  - only active/enabled rows returned (inactive rows excluded)
 *  - defaults assembled from settings rows (fallbacks when rows absent)
 *
 * Pattern: mock `createApiKeyRoute` (from route-factory-tiered) to capture the
 * raw handler, and mock `apiKeyMiddleware` to bypass auth in handler-level tests.
 * Auth 401 scenarios boot a minimal Hono app with the real middleware against
 * mocked DB models.
 *
 * @module test/routes/social/ai/social-catalog
 * @see SPEC-254 T-026
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<string, CapturedHandler>()
}));

// ---------------------------------------------------------------------------
// DB model mocks
// ---------------------------------------------------------------------------

const {
    mockHashtagFindAll,
    mockHashtagSetFindAll,
    mockFooterFindAll,
    mockPlatformFormatFindAll,
    mockCampaignFindAll,
    mockBatchFindAll,
    mockAudienceFindAll,
    mockSettingFindAll
} = vi.hoisted(() => ({
    mockHashtagFindAll: vi.fn(),
    mockHashtagSetFindAll: vi.fn(),
    mockFooterFindAll: vi.fn(),
    mockPlatformFormatFindAll: vi.fn(),
    mockCampaignFindAll: vi.fn(),
    mockBatchFindAll: vi.fn(),
    mockAudienceFindAll: vi.fn(),
    mockSettingFindAll: vi.fn()
}));

vi.mock('@repo/db', () => ({
    socialHashtagModel: { findAll: mockHashtagFindAll },
    socialHashtagSetModel: { findAll: mockHashtagSetFindAll },
    socialPostFooterModel: { findAll: mockFooterFindAll },
    socialPlatformFormatModel: { findAll: mockPlatformFormatFindAll },
    socialCampaignModel: { findAll: mockCampaignFindAll },
    socialContentBatchModel: { findAll: mockBatchFindAll },
    socialAudienceModel: { findAll: mockAudienceFindAll },
    socialSettingModel: { findAll: mockSettingFindAll }
}));

// ---------------------------------------------------------------------------
// Route factory mocks (capture handler, skip auth middleware)
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory-tiered', () => ({
    createApiKeyRoute: vi.fn((config: { path: string; handler: CapturedHandler }) => {
        capturedHandlers.set(config.path, config.handler);
        return config.handler;
    })
}));

// Needed because catalog.ts imports env
vi.mock('../../../../src/utils/env', () => ({
    env: {
        HOSPEDA_AI_SOCIAL_KEY: 'test-secret-key'
    }
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ACTIVE_HASHTAG = {
    id: '00000000-0000-4000-8000-000000000001',
    hashtag: '#playa',
    normalizedHashtag: '#playa',
    category: 'nature',
    platform: undefined,
    audienceId: undefined,
    priority: 0,
    active: true
};

const INACTIVE_HASHTAG = {
    id: '00000000-0000-4000-8000-000000000002',
    hashtag: '#inactive',
    normalizedHashtag: '#inactive',
    category: 'nature',
    platform: undefined,
    audienceId: undefined,
    priority: 0,
    active: false
};

const ACTIVE_HASHTAG_SET = {
    id: '00000000-0000-4000-8001-000000000001',
    name: 'Beach set',
    slug: 'beach-set',
    platform: undefined,
    hashtagsText: '#playa #verano',
    priority: 0,
    active: true
};

const ACTIVE_FOOTER = {
    id: '00000000-0000-4000-8002-000000000001',
    name: 'Main footer',
    slug: 'main-footer',
    content: 'Reservá en hospeda.com.ar',
    platform: undefined,
    active: true,
    isDefault: true,
    priority: 0
};

const ENABLED_PLATFORM_FORMAT = {
    id: '00000000-0000-4000-8003-000000000001',
    platform: 'INSTAGRAM',
    publishFormat: 'FEED_POST',
    mediaType: 'IMAGE',
    enabled: true,
    mvpEnabled: true,
    recommendedRatio: '1:1',
    recommendedSize: '1080x1080',
    maxCaptionLength: 2200,
    requiresPublicUrl: false,
    requiresMedia: true,
    makeChannelKey: 'instagram-feed'
};

const ACTIVE_CAMPAIGN = {
    id: '00000000-0000-4000-8004-000000000001',
    name: 'Institucional Hospeda',
    slug: 'institucional-hospeda',
    description: 'Campaign description',
    active: true,
    startsAt: undefined,
    endsAt: undefined
};

const ACTIVE_BATCH = {
    id: '00000000-0000-4000-8005-000000000001',
    name: 'Hospeda Launch 2026',
    slug: 'hospeda-launch-2026',
    description: 'Batch description',
    active: true,
    startsAt: undefined,
    endsAt: undefined
};

const ACTIVE_AUDIENCE = {
    id: '00000000-0000-4000-8006-000000000001',
    name: 'Turistas',
    slug: 'turistas',
    description: 'Tourist audience',
    active: true
};

const SETTINGS_ROWS = [
    { key: 'default_timezone', value: 'America/Argentina/Cordoba' },
    { key: 'default_campaign_slug', value: 'institucional-hospeda' },
    { key: 'default_batch_slug', value: 'hospeda-launch-2026-06' },
    { key: 'max_hashtags_instagram', value: '30' },
    { key: 'max_hashtags_facebook', value: '10' },
    { key: 'max_hashtags_x', value: '5' }
];

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

// Import the catalog module AFTER mocks are in place
let catalogHandler: CapturedHandler | undefined;

beforeEach(async () => {
    vi.clearAllMocks();
    capturedHandlers.clear();

    // Trigger module evaluation so createApiKeyRoute is called
    await import('../../../../src/routes/ai/social/catalog');
    catalogHandler = capturedHandlers.get('/');
});

afterEach(() => {
    vi.resetModules();
    capturedHandlers.clear();
});

// ---------------------------------------------------------------------------
// Helper: default model mock setup
// ---------------------------------------------------------------------------

function setupDefaultMocks(): void {
    // findAll called with active filter — mock returns only active rows
    mockHashtagFindAll.mockResolvedValue({ items: [ACTIVE_HASHTAG], total: 1 });
    mockHashtagSetFindAll.mockResolvedValue({ items: [ACTIVE_HASHTAG_SET], total: 1 });
    mockFooterFindAll.mockResolvedValue({ items: [ACTIVE_FOOTER], total: 1 });
    mockPlatformFormatFindAll.mockResolvedValue({ items: [ENABLED_PLATFORM_FORMAT], total: 1 });
    mockCampaignFindAll.mockResolvedValue({ items: [ACTIVE_CAMPAIGN], total: 1 });
    mockBatchFindAll.mockResolvedValue({ items: [ACTIVE_BATCH], total: 1 });
    mockAudienceFindAll.mockResolvedValue({ items: [ACTIVE_AUDIENCE], total: 1 });
    mockSettingFindAll.mockResolvedValue({ items: SETTINGS_ROWS, total: SETTINGS_ROWS.length });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/ai/social/catalog (handler-level)', () => {
    describe('200 — valid request', () => {
        it('should return 200 with all 8 collections', async () => {
            setupDefaultMocks();

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const result = (await catalogHandler!(null, {}, {}, {})) as {
                hashtags: unknown[];
                hashtagSets: unknown[];
                footers: unknown[];
                platformFormats: unknown[];
                campaigns: unknown[];
                batches: unknown[];
                audiences: unknown[];
                defaults: unknown;
            };

            expect(result.hashtags).toHaveLength(1);
            expect(result.hashtagSets).toHaveLength(1);
            expect(result.footers).toHaveLength(1);
            expect(result.platformFormats).toHaveLength(1);
            expect(result.campaigns).toHaveLength(1);
            expect(result.batches).toHaveLength(1);
            expect(result.audiences).toHaveLength(1);
            expect(result.defaults).toBeDefined();
        });

        it('should populate defaults from settings rows', async () => {
            setupDefaultMocks();

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const result = (await catalogHandler!(null, {}, {}, {})) as {
                defaults: {
                    timezone: string;
                    campaignSlug: string;
                    batchSlug: string;
                    maxHashtagsPerPlatform: { INSTAGRAM: number; FACEBOOK: number; X: number };
                };
            };

            expect(result.defaults.timezone).toBe('America/Argentina/Cordoba');
            expect(result.defaults.campaignSlug).toBe('institucional-hospeda');
            expect(result.defaults.batchSlug).toBe('hospeda-launch-2026-06');
            expect(result.defaults.maxHashtagsPerPlatform.INSTAGRAM).toBe(30);
            expect(result.defaults.maxHashtagsPerPlatform.FACEBOOK).toBe(10);
            expect(result.defaults.maxHashtagsPerPlatform.X).toBe(5);
        });

        it('should use fallback defaults when settings rows are absent', async () => {
            setupDefaultMocks();
            // Override settings to return empty
            mockSettingFindAll.mockResolvedValue({ items: [], total: 0 });

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const result = (await catalogHandler!(null, {}, {}, {})) as {
                defaults: {
                    timezone: string;
                    campaignSlug: string;
                    batchSlug: string;
                    maxHashtagsPerPlatform: { INSTAGRAM: number; FACEBOOK: number; X: number };
                };
            };

            expect(result.defaults.timezone).toBe('America/Argentina/Cordoba');
            expect(result.defaults.campaignSlug).toBe('');
            expect(result.defaults.batchSlug).toBe('');
            expect(result.defaults.maxHashtagsPerPlatform.INSTAGRAM).toBe(30);
            expect(result.defaults.maxHashtagsPerPlatform.FACEBOOK).toBe(10);
            expect(result.defaults.maxHashtagsPerPlatform.X).toBe(5);
        });

        it('should query hashtags with active: true filter', async () => {
            setupDefaultMocks();

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            await catalogHandler!(null, {}, {}, {});

            expect(mockHashtagFindAll).toHaveBeenCalledWith({ active: true }, { pageSize: 200 });
        });

        it('should query platformFormats with enabled: true filter', async () => {
            setupDefaultMocks();

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            await catalogHandler!(null, {}, {}, {});

            expect(mockPlatformFormatFindAll).toHaveBeenCalledWith(
                { enabled: true },
                { pageSize: 200 }
            );
        });

        it('should project GPT-safe fields (no audit FKs)', async () => {
            setupDefaultMocks();
            // Add a hashtag with audit fields that should be stripped
            const hashtagWithAudit = {
                ...ACTIVE_HASHTAG,
                notes: 'Internal note - should be stripped',
                createdById: 'user-uuid',
                updatedById: 'user-uuid',
                deletedAt: null,
                deletedById: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockHashtagFindAll.mockResolvedValue({ items: [hashtagWithAudit], total: 1 });

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const result = (await catalogHandler!(null, {}, {}, {})) as {
                hashtags: Array<Record<string, unknown>>;
            };

            const hashtag = result.hashtags[0];
            expect(hashtag).not.toHaveProperty('notes');
            expect(hashtag).not.toHaveProperty('createdById');
            expect(hashtag).not.toHaveProperty('updatedById');
            expect(hashtag).not.toHaveProperty('deletedAt');
            expect(hashtag).not.toHaveProperty('deletedById');
            expect(hashtag).not.toHaveProperty('createdAt');
            expect(hashtag).not.toHaveProperty('updatedAt');
            // but GPT fields are present
            expect(hashtag).toHaveProperty('id');
            expect(hashtag).toHaveProperty('hashtag');
            expect(hashtag).toHaveProperty('normalizedHashtag');
            expect(hashtag).toHaveProperty('category');
        });

        it('should return empty arrays when no active rows exist', async () => {
            mockHashtagFindAll.mockResolvedValue({ items: [], total: 0 });
            mockHashtagSetFindAll.mockResolvedValue({ items: [], total: 0 });
            mockFooterFindAll.mockResolvedValue({ items: [], total: 0 });
            mockPlatformFormatFindAll.mockResolvedValue({ items: [], total: 0 });
            mockCampaignFindAll.mockResolvedValue({ items: [], total: 0 });
            mockBatchFindAll.mockResolvedValue({ items: [], total: 0 });
            mockAudienceFindAll.mockResolvedValue({ items: [], total: 0 });
            mockSettingFindAll.mockResolvedValue({ items: [], total: 0 });

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const result = (await catalogHandler!(null, {}, {}, {})) as {
                hashtags: unknown[];
                hashtagSets: unknown[];
                footers: unknown[];
                platformFormats: unknown[];
                campaigns: unknown[];
                batches: unknown[];
                audiences: unknown[];
            };

            expect(result.hashtags).toHaveLength(0);
            expect(result.hashtagSets).toHaveLength(0);
            expect(result.footers).toHaveLength(0);
            expect(result.platformFormats).toHaveLength(0);
            expect(result.campaigns).toHaveLength(0);
            expect(result.batches).toHaveLength(0);
            expect(result.audiences).toHaveLength(0);
        });
    });

    describe('auth gating — api-key middleware behaviour', () => {
        it('should return 401 when x-hospeda-ai-key header is missing', async () => {
            // Boot a minimal Hono app with the real apiKeyMiddleware
            const { apiKeyMiddleware } = await import('../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-ai-key',
                    getExpectedKey: () => 'test-secret-key',
                    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
                })
            );
            miniApp.get('/', (c) => c.json({ ok: true }));

            const res = await miniApp.request('/');
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 401 when x-hospeda-ai-key has wrong value', async () => {
            const { apiKeyMiddleware } = await import('../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-ai-key',
                    getExpectedKey: () => 'test-secret-key',
                    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
                })
            );
            miniApp.get('/', (c) => c.json({ ok: true }));

            const res = await miniApp.request('/', {
                headers: { 'x-hospeda-ai-key': 'wrong-key' }
            });
            expect(res.status).toBe(401);
            const body = await res.json();
            expect(body.success).toBe(false);
            expect(body.error.code).toBe('UNAUTHORIZED');
        });

        it('should return 401 when env key is not configured (fail-closed)', async () => {
            const { apiKeyMiddleware } = await import('../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-ai-key',
                    getExpectedKey: () => undefined, // not configured
                    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
                })
            );
            miniApp.get('/', (c) => c.json({ ok: true }));

            const res = await miniApp.request('/', {
                headers: { 'x-hospeda-ai-key': 'any-key' }
            });
            expect(res.status).toBe(401);
        });

        it('should pass through with correct api key', async () => {
            const { apiKeyMiddleware } = await import('../../../../src/middlewares/api-key');
            const miniApp = new Hono();
            miniApp.use(
                '*',
                apiKeyMiddleware({
                    headerName: 'x-hospeda-ai-key',
                    getExpectedKey: () => 'test-secret-key',
                    actor: { id: 'gpt-action', name: 'Custom GPT Social Action' }
                })
            );
            miniApp.get('/', (c) => c.json({ ok: true }));

            const res = await miniApp.request('/', {
                headers: { 'x-hospeda-ai-key': 'test-secret-key' }
            });
            expect(res.status).toBe(200);
        });
    });

    describe('active/enabled filter correctness', () => {
        it('should pass active:true to hashtag model (inactive rows excluded by DB)', async () => {
            // The model is called with the active filter; the mock returns only active rows.
            // The route does NOT do post-hoc filtering — it trusts the model.
            setupDefaultMocks();
            // Override to return mixed rows (simulates model returning what it was called with)
            mockHashtagFindAll.mockResolvedValue({ items: [ACTIVE_HASHTAG], total: 1 });

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            await catalogHandler!(null, {}, {}, {});

            const hashtagCall = mockHashtagFindAll.mock.calls[0];
            expect(hashtagCall).toBeDefined();
            // biome-ignore lint/style/noNonNullAssertion: asserted above
            expect(hashtagCall![0]).toEqual({ active: true });
        });

        it('should pass enabled:true to platformFormats model', async () => {
            setupDefaultMocks();

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            await catalogHandler!(null, {}, {}, {});

            const pfCall = mockPlatformFormatFindAll.mock.calls[0];
            expect(pfCall).toBeDefined();
            // biome-ignore lint/style/noNonNullAssertion: asserted above
            expect(pfCall![0]).toEqual({ enabled: true });
        });

        it('should not include inactive hashtag in result when model returns only active', async () => {
            setupDefaultMocks();
            // Model only returns active row (simulating DB filter)
            mockHashtagFindAll.mockResolvedValue({ items: [ACTIVE_HASHTAG], total: 1 });

            // biome-ignore lint/style/noNonNullAssertion: handler is set in beforeEach
            const result = (await catalogHandler!(null, {}, {}, {})) as {
                hashtags: Array<{ id: string; active: boolean }>;
            };

            expect(result.hashtags.every((h) => h.active === true)).toBe(true);
            expect(result.hashtags.find((h) => h.id === INACTIVE_HASHTAG.id)).toBeUndefined();
        });
    });
});
