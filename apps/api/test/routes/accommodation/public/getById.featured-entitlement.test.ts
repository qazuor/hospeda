/**
 * HOS-929 regression — the public getById endpoint must feature an
 * accommodation whose owner holds a FEATURED_LISTING entitlement (plan or
 * addon), even when the admin-curated `isFeatured` column is still `false`.
 *
 * Before the fix, this route echoed the raw `isFeatured` column verbatim, so
 * an addon-purchased "visibility boost" never made the accommodation appear
 * featured anywhere — the reported bug: 4 rows in staging with
 * `featured_by_entitlement = true` and `is_featured = false` showed zero
 * badges over 112 cards.
 *
 * Mirrors the mock strategy of `getById.rich-description.test.ts`: mocks
 * @repo/service-core and the owner-entitlement helper so the assertions
 * exercise the real handler end-to-end (no early-return short-circuit).
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Mock handles ──────────────────────────────────────────────────────────────

const mockGetById = vi.fn();
const mockResolveOwnerEntitlementsForOwnerId = vi.fn();

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                getById: mockGetById
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

vi.mock('../../../../src/middlewares/owner-entitlement', () => ({
    ownerEntitlementMiddleware: vi.fn(),
    resolveOwnerEntitlementsForOwnerId: mockResolveOwnerEntitlementsForOwnerId
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

/**
 * Minimal route-factory mock: wraps the handler in a Hono app exactly the way
 * the real factory does, so the handler is exercised end-to-end.
 */
vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicRoute: (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (c: unknown, params: Record<string, unknown>) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        app[options.method](honoPath, async (c) => {
            const result = await options.handler(c, c.req.param());
            return c.json({ success: true, data: result });
        });
        return app;
    }
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ACC_ID = 'b1b2b3b4-0000-4000-8000-000000000004';
const OWNER_ID = 'eeeeeeee-0000-4000-8000-000000000004';

/** Base accommodation stub — every field a real `Accommodation` needs to reach the response. */
const BASE_ACCOMMODATION = {
    id: ACC_ID,
    slug: 'entitlement-featured-lodge',
    name: 'Entitlement Featured Lodge',
    summary: 'A lodge featured only via billing entitlement',
    description: 'Plain description text',
    type: 'CABIN',
    averageRating: 4.2,
    reviewsCount: 3,
    media: null,
    price: null,
    location: null,
    seo: null,
    extraInfo: null,
    destinationId: 'dddddddd-0000-4000-8000-000000000004',
    ownerId: OWNER_ID,
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ownerSuspended: false,
    planRestricted: false,
    contactInfo: null,
    socialNetworks: null
};

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp() {
    vi.resetModules();
    const { publicGetAccommodationByIdRoute } = await import(
        '../../../../src/routes/accommodation/public/getById'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetAccommodationByIdRoute);
    return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('publicGetAccommodationByIdRoute — HOS-929 featured entitlement OR', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveOwnerEntitlementsForOwnerId.mockResolvedValue([]);
    });

    it('reports isFeatured=true when only featuredByEntitlement is true (the reported bug)', async () => {
        // Arrange — staging's exact repro shape: is_featured=false, featured_by_entitlement=true.
        mockGetById.mockResolvedValue({
            data: { ...BASE_ACCOMMODATION, isFeatured: false, featuredByEntitlement: true },
            error: null
        });

        // Act
        const app = await buildApp();
        const res = await app.request(`/${ACC_ID}`);

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.isFeatured).toBe(true);
        // Note: `featuredByEntitlement` stripping from the public payload is the
        // job of `AccommodationPublicSchema` via `stripWithSchema` (the route
        // factory's real response pipeline), which this test's route-factory
        // mock deliberately bypasses to exercise the handler directly — that
        // stripping guarantee is covered generically wherever the schema itself
        // is tested, not per-route here.
    });

    it('reports isFeatured=true when only the admin-curated flag is true', async () => {
        mockGetById.mockResolvedValue({
            data: { ...BASE_ACCOMMODATION, isFeatured: true, featuredByEntitlement: false },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${ACC_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.isFeatured).toBe(true);
    });

    it('reports isFeatured=false when neither flag is true', async () => {
        mockGetById.mockResolvedValue({
            data: { ...BASE_ACCOMMODATION, isFeatured: false, featuredByEntitlement: false },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${ACC_ID}`);

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.isFeatured).toBe(false);
    });
});
