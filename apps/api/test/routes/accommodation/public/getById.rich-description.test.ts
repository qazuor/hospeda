/**
 * SPEC-187 regression — getById endpoint must apply owner-entitlement gating
 * for richDescription.
 *
 * richDescription is a PREMIUM field gated per-owner by the entitlement system.
 * The getById detail endpoint must:
 *   (a) OMIT richDescription when the owning host lacks CAN_USE_RICH_DESCRIPTION.
 *   (b) EXPOSE richDescription when the owning host has CAN_USE_RICH_DESCRIPTION.
 *   (c) OMIT richDescription when the accommodation has no ownerId (fail-closed).
 *
 * This test mocks @repo/service-core and the owner-entitlement helper so the
 * assertions stay focused on the route-level entitlement gate introduced for
 * SPEC-187. The mocks are intentionally exercising the real handler (no
 * early-return short-circuit), so the test WOULD FAIL without the fix.
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
        AccommodationService: vi.fn().mockImplementation(() => ({
            getById: mockGetById
        })),
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
            role: 'GUEST',
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

const ACC_ID = 'b1b2b3b4-0000-4000-8000-000000000003';
const OWNER_ID = 'eeeeeeee-0000-4000-8000-000000000003';

/**
 * Accommodation stub that always carries richDescription.
 * The fix must expose or omit the field based on ownerEntitlements.
 */
const ACCOMMODATION_WITH_RICH = {
    id: ACC_ID,
    slug: 'premium-lodge-id',
    name: 'Premium Lodge (by-id)',
    summary: 'A very nice lodge',
    description: 'Plain description text',
    richDescription: '## Premium\n\nThis must be gated by owner entitlements.',
    type: 'CABIN',
    isFeatured: false,
    averageRating: 4.5,
    reviewsCount: 10,
    media: null,
    price: null,
    location: null,
    seo: null,
    extraInfo: null,
    destinationId: 'dddddddd-0000-4000-8000-000000000003',
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

describe('publicGetAccommodationByIdRoute — SPEC-187 richDescription gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('omits richDescription when the owning host lacks CAN_USE_RICH_DESCRIPTION', async () => {
        // Arrange
        mockGetById.mockResolvedValue({ data: ACCOMMODATION_WITH_RICH, error: null });
        // Owner has NO premium entitlements → richDescription must be omitted.
        mockResolveOwnerEntitlementsForOwnerId.mockResolvedValue([]);

        // Act
        const app = await buildApp();
        const res = await app.request(`/${ACC_ID}`);

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).not.toHaveProperty('richDescription');
        expect(body.data).toHaveProperty('description', 'Plain description text');
        // resolveOwnerEntitlementsForOwnerId must have been called with the right owner
        expect(mockResolveOwnerEntitlementsForOwnerId).toHaveBeenCalledWith(OWNER_ID);
    });

    it('exposes richDescription when the owning host has CAN_USE_RICH_DESCRIPTION', async () => {
        // Arrange
        mockGetById.mockResolvedValue({ data: ACCOMMODATION_WITH_RICH, error: null });
        // Owner has the premium entitlement → richDescription must reach the payload.
        mockResolveOwnerEntitlementsForOwnerId.mockResolvedValue(['can_use_rich_description']);

        // Act
        const app = await buildApp();
        const res = await app.request(`/${ACC_ID}`);

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.richDescription).toBe(
            '## Premium\n\nThis must be gated by owner entitlements.'
        );
    });

    it('omits richDescription when the accommodation has no ownerId (fail-closed)', async () => {
        // Arrange: accommodation without an ownerId
        const noOwnerAccommodation = { ...ACCOMMODATION_WITH_RICH, ownerId: undefined };
        mockGetById.mockResolvedValue({ data: noOwnerAccommodation, error: null });
        // resolveOwnerEntitlementsForOwnerId must NOT be called — the route uses []
        // (empty entitlements) directly when ownerId is absent.

        // Act
        const app = await buildApp();
        const res = await app.request(`/${ACC_ID}`);

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).not.toHaveProperty('richDescription');
        // No entitlement lookup should occur when there is no owner
        expect(mockResolveOwnerEntitlementsForOwnerId).not.toHaveBeenCalled();
    });

    it('returns null when the service returns no data', async () => {
        // Arrange
        mockGetById.mockResolvedValue({ data: null, error: null });

        // Act
        const app = await buildApp();
        const res = await app.request(`/${ACC_ID}`);

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data).toBeNull();
    });
});
