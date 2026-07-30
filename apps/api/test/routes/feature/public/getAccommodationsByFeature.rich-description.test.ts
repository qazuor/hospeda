/**
 * SPEC-187 / SPEC-212 regression — accommodations-by-feature must NOT expose
 * either rich-description field.
 *
 * This route was missed by the original rich-description sweep entirely. It
 * declares `AccommodationPublicSchema` — the schema that deliberately re-exposes
 * BOTH `richDescription` and its i18n sibling — and returned the service payload
 * verbatim, and the service loads FULL accommodation entities via
 * `findAllWithRelations({ accommodation: true })` with no column allowlist. So
 * `stripWithSchema` hid neither field.
 *
 * It is also the worst place for that to happen: `/api/v1/public/features` is a
 * shared-cached prefix whose cache key carries no `Authorization`.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Service mock ──────────────────────────────────────────────────────────────

const mockGetAccommodationsByFeature = vi.fn();

const FEATURE_ID = 'ffffffff-0000-4000-8000-000000000001';
const OWNER_ID = 'eeeeeeee-0000-4000-8000-000000000007';

/**
 * Accommodation stub carrying BOTH premium rich-description fields.
 */
const ACCOMMODATION_WITH_RICH = {
    id: 'b1b2b3b4-0000-4000-8000-000000000007',
    slug: 'premium-lodge-by-feature',
    name: 'Premium Lodge (by-feature)',
    summary: 'A very nice lodge',
    description: 'Plain description text',
    richDescription: '## Premium\n\nThis must NOT appear in the public response.',
    richDescriptionI18n: {
        es: '## Premium ES\n\nEsto NO debe aparecer en la respuesta publica.',
        en: '## Premium EN\n\nThis must NOT appear in the public response.',
        pt: '## Premium PT\n\nIsto NAO deve aparecer na resposta publica.'
    },
    type: 'CABIN',
    isFeatured: false,
    isVerified: false,
    averageRating: 4.5,
    reviewsCount: 10,
    media: null,
    price: null,
    location: null,
    seo: null,
    extraInfo: null,
    destinationId: 'dddddddd-0000-4000-8000-000000000007',
    ownerId: OWNER_ID,
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ownerSuspended: false,
    planRestricted: false
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        FeatureService: vi.fn().mockImplementation(function () {
            return {
                getAccommodationsByFeature: mockGetAccommodationsByFeature
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

// HOS-341 wired the isVerified owner gate into this route. Without this mock the
// suite would run the REAL batch resolver against the globally mocked `@repo/db`
// and an uninitialized billing singleton. It buys hermeticity and cost, NOT a
// different verdict: nothing here asserts on `isVerified` and the fixture leaves
// it falsy, so the gate short-circuits before it ever reads an entitlement. This
// suite is about rich-description stripping; the gate has its own badge-gate suite.
vi.mock('../../../../src/middlewares/owner-entitlement', () => ({
    resolveOwnerEntitlementsForOwnerIds: vi.fn().mockResolvedValue(new Map())
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicListRoute: (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (
            c: unknown,
            params: Record<string, unknown>,
            body: unknown,
            query: Record<string, unknown>
        ) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        app[options.method](honoPath, async (c) => {
            const result = await options.handler(c, c.req.param(), undefined, c.req.query());
            return c.json({ success: true, ...(result as Record<string, unknown>) });
        });
        return app;
    }
}));

// ── helpers ───────────────────────────────────────────────────────────────────

async function buildApp() {
    vi.resetModules();
    const { publicGetAccommodationsByFeatureRoute } = await import(
        '../../../../src/routes/feature/public/getAccommodationsByFeature'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetAccommodationsByFeatureRoute);
    return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('publicGetAccommodationsByFeatureRoute — both rich-description fields must be absent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('excludes richDescription AND richDescriptionI18n from every item', async () => {
        mockGetAccommodationsByFeature.mockResolvedValue({
            data: { accommodations: [ACCOMMODATION_WITH_RICH] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${FEATURE_ID}/accommodations`);
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.items as unknown[];
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThan(0);

        for (const item of items) {
            expect(item).not.toHaveProperty('richDescription');
            expect(item).not.toHaveProperty('richDescriptionI18n');
        }
    });

    it('still returns the public card fields after stripping', async () => {
        mockGetAccommodationsByFeature.mockResolvedValue({
            data: { accommodations: [ACCOMMODATION_WITH_RICH] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${FEATURE_ID}/accommodations`);
        const body = await res.json();
        const item = (body.items as unknown[])[0] as Record<string, unknown>;

        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('slug');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('description', 'Plain description text');
        expect(item).not.toHaveProperty('richDescription');
        expect(item).not.toHaveProperty('richDescriptionI18n');
    });

    it('returns an empty list when the feature has no accommodations', async () => {
        mockGetAccommodationsByFeature.mockResolvedValue({
            data: { accommodations: [] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${FEATURE_ID}/accommodations`);
        const body = await res.json();

        expect(body.items).toHaveLength(0);
    });
});
