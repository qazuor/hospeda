/**
 * HOS-2589 D-6 (AC-33, AC-34): the public accommodation list carries the
 * «Promo» / «VIP» search-badge presence per item. Presence only, the same for
 * every reader, so it stays in the actor-blind cached list response; a failed
 * presence read degrades to no badge and never fails the search.
 */

import type { VerticalEnum } from '@repo/schemas';
import { rehydrateEffectiveSet } from '@repo/verticals';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Mock handles ──────────────────────────────────────────────────────────────

const mockSearch = vi.fn();
const mockEffectiveSet = vi.fn();
const mockPresence = vi.fn();

// ── Owner ids ────────────────────────────────────────────────────────────────

const OWNER_WITH_AI = 'eeeeeeee-0000-4000-8000-00000000aaaa';
const OWNER_WITHOUT_AI = 'eeeeeeee-0000-4000-8000-00000000bbbb';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function accommodation(overrides: Record<string, unknown>): Record<string, unknown> {
    return {
        id: 'b1b2b3b4-0000-4000-8000-000000000004',
        slug: 'lodge',
        name: 'Lodge',
        summary: 'A nice lodge',
        description: 'Plain description',
        type: 'CABIN',
        isFeatured: false,
        averageRating: 4.5,
        reviewsCount: 10,
        media: null,
        price: null,
        location: null,
        seo: null,
        extraInfo: null,
        destinationId: 'dddddddd-0000-4000-8000-000000000004',
        ownerId: OWNER_WITH_AI,
        publicationStatus: 'PUBLISHED',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        ...overrides
    };
}

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                search: mockSearch
            };
        }),
        ServiceError: class ServiceError extends Error {
            public readonly code: string;
            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        }
    };
});

vi.mock('@repo/db', async (importActual) => ({
    ...(await importActual<typeof import('@repo/db')>()),
    ownerPromotionTouristModel: { findAccommodationPromotionPresence: mockPresence }
}));

vi.mock('../../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({ effectiveSet: mockEffectiveSet })
}));

vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    return {
        ...actual,
        getActorFromContext: vi.fn(() => ({
            id: '00000000-0000-4000-8000-000000000000',
            roles: ['GUEST'],
            permissions: []
        }))
    };
});

vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../../../src/routes/accommodation/public/quick-amenity-resolver', () => ({
    resolveQuickAmenityFlags: vi.fn().mockResolvedValue([])
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicListRoute: (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (
            c: unknown,
            params: Record<string, unknown>,
            body: unknown,
            query: Record<string, string>
        ) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        app[options.method](honoPath, async (c) => {
            const result = await options.handler(
                c,
                c.req.param(),
                undefined,
                c.req.query() as Record<string, string>
            );
            return c.json({ success: true, ...(result as object) });
        });
        return app;
    }
}));

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp() {
    vi.resetModules();
    const { publicListAccommodationsRoute } = await import(
        '../../../../src/routes/accommodation/public/list'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicListAccommodationsRoute);
    return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('publicListAccommodationsRoute — promotion presence badges', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEffectiveSet.mockImplementation(
            async ({ userId, vertical }: { userId: string; vertical: VerticalEnum }) =>
                rehydrateEffectiveSet({
                    version: 1,
                    userId,
                    vertical,
                    hasLiveNonTrialTitle: true,
                    inheritsTouristVip: false,
                    entries: []
                })
        );
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    accommodation({ id: 'acc-1', slug: 'both', ownerId: OWNER_WITH_AI }),
                    accommodation({ id: 'acc-2', slug: 'plus', ownerId: OWNER_WITH_AI }),
                    accommodation({ id: 'acc-3', slug: 'none', ownerId: OWNER_WITHOUT_AI })
                ],
                total: 3
            },
            error: null
        });
    });

    it('maps presence onto hasFreePromotion and hasVipPromotion per item', async () => {
        mockPresence.mockResolvedValue(
            new Map([
                ['acc-1', { hasFreePromotion: true, hasVipPromotion: true }],
                ['acc-2', { hasFreePromotion: true, hasVipPromotion: false }]
            ])
        );

        const app = await buildApp();
        const body = await (await app.request('/')).json();
        const items = body.items as Array<Record<string, unknown>>;

        expect(items.find((i) => i.id === 'acc-1')).toMatchObject({
            hasFreePromotion: true,
            hasVipPromotion: true
        });
        expect(items.find((i) => i.id === 'acc-2')).toMatchObject({
            hasFreePromotion: true,
            hasVipPromotion: false
        });
        expect(items.find((i) => i.id === 'acc-3')).toMatchObject({
            hasFreePromotion: false,
            hasVipPromotion: false
        });
        expect(mockPresence).toHaveBeenCalledTimes(1);
        expect(mockPresence.mock.calls[0]?.[0].listings).toHaveLength(3);
    });

    it('carries no promotion content, only the two flags', async () => {
        mockPresence.mockResolvedValue(
            new Map([['acc-1', { hasFreePromotion: true, hasVipPromotion: true }]])
        );
        const app = await buildApp();
        const json = JSON.stringify(await (await app.request('/')).json());
        expect(json).not.toMatch(/discountValue|promotionTitle|touristAudience/);
    });

    it('a failed presence read omits the badges and the search still answers', async () => {
        mockPresence.mockRejectedValue(new Error('db down'));
        const app = await buildApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);
        const items = (await res.json()).items as Array<Record<string, unknown>>;
        expect(
            items.every((i) => i.hasFreePromotion === false && i.hasVipPromotion === false)
        ).toBe(true);
    });
});
