/**
 * Smoke tests for admin social catalog routes (5 entities) — SPEC-254 T-018.
 *
 * Covers hashtag-sets, footers, campaigns, batches, audiences.
 * One create + one list success assertion per entity.
 *
 * @module test/routes/social/admin/social-catalog-smoke
 * @see SPEC-254 T-018
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted refs
// ---------------------------------------------------------------------------

const { capturedHandlers } = vi.hoisted(() => ({
    capturedHandlers: new Map<
        string,
        (ctx: unknown, params: unknown, body: unknown, query?: unknown) => Promise<unknown>
    >()
}));

const {
    mockHashtagSetAdminList,
    mockHashtagSetCreate,
    mockFooterAdminList,
    mockFooterCreate,
    mockCampaignAdminList,
    mockCampaignCreate,
    mockBatchAdminList,
    mockBatchCreate,
    mockAudienceAdminList,
    mockAudienceCreate
} = vi.hoisted(() => ({
    mockHashtagSetAdminList: vi.fn(),
    mockHashtagSetCreate: vi.fn(),
    mockFooterAdminList: vi.fn(),
    mockFooterCreate: vi.fn(),
    mockCampaignAdminList: vi.fn(),
    mockCampaignCreate: vi.fn(),
    mockBatchAdminList: vi.fn(),
    mockBatchCreate: vi.fn(),
    mockAudienceAdminList: vi.fn(),
    mockAudienceCreate: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../../src/utils/route-factory', () => ({
    createAdminRoute: vi.fn(
        (config: {
            path: string;
            method: string;
            tags: string[];
            handler: (ctx: unknown, params: unknown, body: unknown) => Promise<unknown>;
        }) => {
            const tag = config.tags[0] ?? 'unknown';
            capturedHandlers.set(`${tag}:${config.method}:${config.path}`, config.handler);
            return config.handler;
        }
    ),
    createAdminListRoute: vi.fn(
        (config: {
            path: string;
            method: string;
            tags: string[];
            handler: (
                ctx: unknown,
                params: unknown,
                body: unknown,
                query?: unknown
            ) => Promise<unknown>;
        }) => {
            const tag = config.tags[0] ?? 'unknown';
            capturedHandlers.set(`${tag}:${config.method}:${config.path}:list`, config.handler);
            return config.handler;
        }
    )
}));

vi.mock('../../../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('@repo/service-core', () => ({
    SocialHashtagSetService: vi.fn(() => ({
        adminList: mockHashtagSetAdminList,
        create: mockHashtagSetCreate,
        getById: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn()
    })),
    SocialPostFooterService: vi.fn(() => ({
        adminList: mockFooterAdminList,
        create: mockFooterCreate,
        getById: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn()
    })),
    SocialCampaignService: vi.fn(() => ({
        adminList: mockCampaignAdminList,
        create: mockCampaignCreate,
        getById: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn()
    })),
    SocialContentBatchService: vi.fn(() => ({
        adminList: mockBatchAdminList,
        create: mockBatchCreate,
        getById: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn()
    })),
    SocialAudienceService: vi.fn(() => ({
        adminList: mockAudienceAdminList,
        create: mockAudienceCreate,
        getById: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn()
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

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn(), log: vi.fn() }
}));

vi.mock('../../../../src/utils/pagination', () => ({
    extractPaginationParams: vi.fn(() => ({ page: 1, pageSize: 20 })),
    getPaginationResponse: vi.fn((total: number) => ({ total, page: 1, pageSize: 20 }))
}));

// ---------------------------------------------------------------------------
// Trigger module execution
// ---------------------------------------------------------------------------

await import('../../../../src/routes/social/admin/hashtag-sets/list');
await import('../../../../src/routes/social/admin/hashtag-sets/create');
await import('../../../../src/routes/social/admin/footers/list');
await import('../../../../src/routes/social/admin/footers/create');
await import('../../../../src/routes/social/admin/campaigns/list');
await import('../../../../src/routes/social/admin/campaigns/create');
await import('../../../../src/routes/social/admin/batches/list');
await import('../../../../src/routes/social/admin/batches/create');
await import('../../../../src/routes/social/admin/audiences/list');
await import('../../../../src/routes/social/admin/audiences/create');

import { RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { getActorFromContext } from '../../../../src/utils/actor';

const mockGetActorFromContext = vi.mocked(getActorFromContext);

const ADMIN_ACTOR: Actor = {
    id: 'admin-id',
    role: RoleEnum.ADMIN,
    permissions: []
};

function buildCtx() {
    return { get: vi.fn(), set: vi.fn(), json: vi.fn() };
}

function getHandler(tag: string, method: string, path: string, isList = false) {
    const key = isList ? `${tag}:${method}:${path}:list` : `${tag}:${method}:${path}`;
    const h = capturedHandlers.get(key);
    if (!h)
        throw new Error(
            `No handler for key: ${key}. Registered: ${[...capturedHandlers.keys()].join(', ')}`
        );
    return h;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('admin social catalog smoke — SPEC-254 T-018', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActorFromContext.mockReturnValue(ADMIN_ACTOR);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // -----------------------------------------------------------------------
    // Hashtag Sets
    // -----------------------------------------------------------------------
    describe('hashtag-sets', () => {
        const TAG = 'Social Hashtag Sets';
        const SET_FIXTURE = {
            id: 'bbbbbbbb-0000-0000-0000-000000000001',
            name: 'Summer Set',
            slug: 'summer-set',
            hashtagsText: '#summer #verano',
            priority: 0,
            active: true
        };

        it('list: returns paginated items', async () => {
            mockHashtagSetAdminList.mockResolvedValue({
                data: { items: [SET_FIXTURE], total: 1 },
                error: undefined
            });
            const handler = getHandler(TAG, 'get', '/', true);
            const result = (await handler(buildCtx(), {}, {}, {})) as { items: unknown[] };
            expect(result.items).toHaveLength(1);
        });

        it('create: returns created item', async () => {
            mockHashtagSetCreate.mockResolvedValue({ data: SET_FIXTURE, error: undefined });
            const handler = getHandler(TAG, 'post', '/');
            const result = await handler(
                buildCtx(),
                {},
                { name: 'Summer Set', hashtagsText: '#summer' }
            );
            expect(result).toEqual(SET_FIXTURE);
        });
    });

    // -----------------------------------------------------------------------
    // Footers
    // -----------------------------------------------------------------------
    describe('footers', () => {
        const TAG = 'Social Footers';
        const FOOTER_FIXTURE = {
            id: 'cccccccc-0000-0000-0000-000000000001',
            name: 'Main Footer',
            slug: 'main-footer',
            content: 'Reservá en hospeda.com.ar',
            active: true,
            isDefault: true,
            priority: 0
        };

        it('list: returns paginated items', async () => {
            mockFooterAdminList.mockResolvedValue({
                data: { items: [FOOTER_FIXTURE], total: 1 },
                error: undefined
            });
            const handler = getHandler(TAG, 'get', '/', true);
            const result = (await handler(buildCtx(), {}, {}, {})) as { items: unknown[] };
            expect(result.items).toHaveLength(1);
        });

        it('create: returns created item', async () => {
            mockFooterCreate.mockResolvedValue({ data: FOOTER_FIXTURE, error: undefined });
            const handler = getHandler(TAG, 'post', '/');
            const result = await handler(
                buildCtx(),
                {},
                { name: 'Main Footer', content: 'Reservá en hospeda.com.ar' }
            );
            expect(result).toEqual(FOOTER_FIXTURE);
        });
    });

    // -----------------------------------------------------------------------
    // Campaigns
    // -----------------------------------------------------------------------
    describe('campaigns', () => {
        const TAG = 'Social Campaigns';
        const CAMPAIGN_FIXTURE = {
            id: 'dddddddd-0000-0000-0000-000000000001',
            name: 'Hospeda Launch 2026',
            slug: 'hospeda-launch-2026',
            active: true
        };

        it('list: returns paginated items', async () => {
            mockCampaignAdminList.mockResolvedValue({
                data: { items: [CAMPAIGN_FIXTURE], total: 1 },
                error: undefined
            });
            const handler = getHandler(TAG, 'get', '/', true);
            const result = (await handler(buildCtx(), {}, {}, {})) as { items: unknown[] };
            expect(result.items).toHaveLength(1);
        });

        it('create: returns created item', async () => {
            mockCampaignCreate.mockResolvedValue({ data: CAMPAIGN_FIXTURE, error: undefined });
            const handler = getHandler(TAG, 'post', '/');
            const result = await handler(buildCtx(), {}, { name: 'Hospeda Launch 2026' });
            expect(result).toEqual(CAMPAIGN_FIXTURE);
        });
    });

    // -----------------------------------------------------------------------
    // Batches
    // -----------------------------------------------------------------------
    describe('batches', () => {
        const TAG = 'Social Batches';
        const BATCH_FIXTURE = {
            id: 'eeeeeeee-0000-0000-0000-000000000001',
            name: 'June 2026',
            slug: 'june-2026',
            active: true
        };

        it('list: returns paginated items', async () => {
            mockBatchAdminList.mockResolvedValue({
                data: { items: [BATCH_FIXTURE], total: 1 },
                error: undefined
            });
            const handler = getHandler(TAG, 'get', '/', true);
            const result = (await handler(buildCtx(), {}, {}, {})) as { items: unknown[] };
            expect(result.items).toHaveLength(1);
        });

        it('create: returns created item', async () => {
            mockBatchCreate.mockResolvedValue({ data: BATCH_FIXTURE, error: undefined });
            const handler = getHandler(TAG, 'post', '/');
            const result = await handler(buildCtx(), {}, { name: 'June 2026' });
            expect(result).toEqual(BATCH_FIXTURE);
        });
    });

    // -----------------------------------------------------------------------
    // Audiences
    // -----------------------------------------------------------------------
    describe('audiences', () => {
        const TAG = 'Social Audiences';
        const AUDIENCE_FIXTURE = {
            id: 'ffffffff-0000-0000-0000-000000000001',
            name: 'Turistas',
            slug: 'turistas',
            active: true
        };

        it('list: returns paginated items', async () => {
            mockAudienceAdminList.mockResolvedValue({
                data: { items: [AUDIENCE_FIXTURE], total: 1 },
                error: undefined
            });
            const handler = getHandler(TAG, 'get', '/', true);
            const result = (await handler(buildCtx(), {}, {}, {})) as { items: unknown[] };
            expect(result.items).toHaveLength(1);
        });

        it('create: returns created item', async () => {
            mockAudienceCreate.mockResolvedValue({ data: AUDIENCE_FIXTURE, error: undefined });
            const handler = getHandler(TAG, 'post', '/');
            const result = await handler(buildCtx(), {}, { name: 'Turistas' });
            expect(result).toEqual(AUDIENCE_FIXTURE);
        });
    });
});
