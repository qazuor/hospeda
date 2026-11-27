/** AC-F1-12: execute the real preview service through HTTP over an instrumented DB boundary. */
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCampaignPreview } from '../../../../../packages/service-core/src/services/newsletter/dynamic/resolve-campaign-preview';
import type { AppBindings } from '../../../src/types';

vi.hoisted(() => vi.resetModules());

const state = vi.hoisted(() => ({
    rows: [] as Record<string, unknown>[],
    read: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    transaction: vi.fn(),
    preview: vi.fn(),
    fetchCandidates: vi.fn(),
    revalidate: vi.fn(),
    loadCards: vi.fn()
}));
vi.mock('@repo/db', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@repo/db')>()),
    ...(await import(
        '../../../../../packages/db/src/schemas/newsletter/newsletter_campaigns.dbschema'
    )),
    getDb: () => ({
        select: () => ({ from: () => ({ where: () => ({ limit: state.read }) }) }),
        update: state.update,
        insert: state.insert,
        transaction: state.transaction
    })
}));
vi.mock('@repo/service-core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/service-core')>();
    state.preview.mockImplementation(original.resolveCampaignPreview);
    return {
        ...original,
        resolveCampaignPreview: state.preview,
        DrizzleDynamicSource: class {
            fetchCandidates = state.fetchCandidates;
            revalidate = state.revalidate;
            loadCards = state.loadCards;
        }
    };
});
vi.mock('../../../src/routes/newsletter/admin/_singletons', () => ({
    getDefaultCampaignService: vi.fn()
}));

import { adminResolvePreviewCampaignRoute } from '../../../src/routes/newsletter/admin/campaigns';

const id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const actor = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roles: [RoleEnum.ADMIN],
    emailVerified: true,
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.NEWSLETTER_CAMPAIGN_SEND]
};
const config = {
    blockKey: 'newest-01',
    entityType: 'ACCOMMODATION',
    source: 'newest',
    count: 1,
    params: {},
    minItems: 1,
    ifBelowMin: 'skip_run',
    excludeRecentEditions: 0,
    fillWithRepeats: false
};

function request() {
    const app = new Hono<AppBindings>();
    app.use('*', async (c, next) => {
        c.set('actor', actor);
        await next();
    });
    app.route('/api/v1/admin/newsletter', adminResolvePreviewCampaignRoute);
    return app.request(`/api/v1/admin/newsletter/campaigns/${id}/resolve-preview`, {
        method: 'POST',
        headers: { 'user-agent': 'vitest' }
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    state.preview.mockImplementation(resolveCampaignPreview);
    state.rows = [
        {
            id,
            status: 'draft',
            localeFilter: 'en',
            subject: 'Preview',
            resolvedBodyJson: null,
            resolvedAt: null,
            bodyJson: {
                type: 'doc',
                content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Before the cards' }] },
                    {
                        type: 'dynamicBlock',
                        attrs: { blockKey: config.blockKey, config: JSON.stringify(config) }
                    }
                ]
            }
        }
    ];
    state.read.mockImplementation(async () => state.rows);
    state.fetchCandidates.mockResolvedValue(['card-1']);
    state.revalidate.mockResolvedValue({ validIds: ['card-1'], dropped: [] });
    state.loadCards.mockResolvedValue(
        new Map([
            [
                'card-1',
                {
                    en: {
                        name: 'River cabin',
                        summary: 'A quiet stay',
                        imageUrl: null,
                        url: 'https://hospeda.com.ar/en/alojamientos/cabin/'
                    }
                }
            ]
        ])
    );
});

describe('real resolve-preview path', () => {
    it('renders cards and diagnostics while leaving the entire campaign row unchanged', async () => {
        const before = structuredClone(state.rows);
        const response = await request();
        expect(state.preview).toHaveBeenCalledOnce();
        await expect(state.preview.mock.results[0]?.value).resolves.toBeDefined();
        expect(response.status).toBe(200);
        const { data } = await response.json();
        expect(data.html).toContain('River cabin');
        expect(data.html).toContain('Before the cards');
        expect(data.report).toEqual({
            blocks: [
                {
                    blockKey: config.blockKey,
                    candidates: ['card-1'],
                    dropped: [],
                    repeatsUsed: 0,
                    belowMin: false,
                    action: 'send'
                }
            ]
        });
        expect(state.preview.mock.calls[0]?.[0]).toMatchObject({ actor, id });
        expect(state.fetchCandidates.mock.calls[0]?.[0]).toMatchObject({
            block: config,
            excludeIds: []
        });
        expect(state.rows).toEqual(before);
        expect(state.update).not.toHaveBeenCalled();
        expect(state.insert).not.toHaveBeenCalled();
        expect(state.transaction).not.toHaveBeenCalled();
    });
    it('returns 422 and diagnostics without writes when the real resolver is below minimum', async () => {
        state.fetchCandidates.mockResolvedValue([]);
        state.revalidate.mockResolvedValue({ validIds: [], dropped: [] });
        const before = structuredClone(state.rows);
        const response = await request();
        expect(response.status).toBe(422);
        expect((await response.json()).error).toMatchObject({
            code: 'DYNAMIC_BLOCK_BELOW_MIN',
            details: {
                report: {
                    blocks: [expect.objectContaining({ belowMin: true, action: 'skip_run' })]
                }
            }
        });
        expect(state.rows).toEqual(before);
        expect(state.update).not.toHaveBeenCalled();
        expect(state.insert).not.toHaveBeenCalled();
    });
    it('maps malformed stored JSON config to 400 rather than INTERNAL_ERROR', async () => {
        state.rows[0] = {
            ...state.rows[0],
            bodyJson: {
                type: 'doc',
                content: [
                    { type: 'dynamicBlock', attrs: { blockKey: config.blockKey, config: '{' } }
                ]
            }
        };
        const response = await request();
        expect(response.status).toBe(400);
        expect((await response.json()).error.code).toBe('INVALID_DYNAMIC_BLOCK');
        expect(state.fetchCandidates).not.toHaveBeenCalled();
    });
    it('returns 404 before resolution for a missing campaign', async () => {
        state.rows = [];
        expect((await request()).status).toBe(404);
        expect(state.fetchCandidates).not.toHaveBeenCalled();
    });
    it('keeps static campaigns on the legacy renderer with an empty report', async () => {
        state.rows[0] = {
            ...state.rows[0],
            bodyJson: {
                type: 'doc',
                content: [
                    { type: 'paragraph', content: [{ type: 'text', text: 'Static newsletter' }] }
                ]
            }
        };
        const response = await request();
        expect(response.status).toBe(200);
        const { data } = await response.json();
        expect(data.html).toContain('Static newsletter');
        expect(data.report).toEqual({ blocks: [] });
        expect(state.fetchCandidates).not.toHaveBeenCalled();
    });
});
