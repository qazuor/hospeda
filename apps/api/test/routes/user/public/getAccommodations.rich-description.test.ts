/**
 * SPEC-187 regression — user/getAccommodations endpoint must NOT expose richDescription.
 *
 * richDescription is a PREMIUM field gated per-owner by the entitlement system.
 * The GET /api/v1/public/users/:id/accommodations endpoint is a card listing that
 * never renders rich text, so the field must be absent from every returned item
 * regardless of the owner's plan.
 *
 * This test mocks @repo/service-core to return accommodations that include
 * richDescription and asserts the field is absent from the endpoint response.
 * The real handler is exercised so the test WOULD FAIL without the fix.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Mock handles ──────────────────────────────────────────────────────────────

const mockSearch = vi.fn();

// ── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER_UUID = 'eeeeeeee-0000-4000-8000-000000000005';

/**
 * Accommodation stub that includes a richDescription value.
 * The fix must strip this field before the item reaches the HTTP response.
 */
const ACCOMMODATION_WITH_RICH = {
    id: 'b1b2b3b4-0000-4000-8000-000000000005',
    slug: 'premium-lodge-user',
    name: 'Premium Lodge (by-user)',
    summary: 'A very nice lodge',
    description: 'Plain description text',
    richDescription: '## Premium\n\nThis must NOT appear in the user accommodations response.',
    type: 'CABIN',
    isFeatured: false,
    averageRating: 4.5,
    reviewsCount: 10,
    media: null,
    price: null,
    location: null,
    seo: null,
    extraInfo: null,
    destinationId: 'dddddddd-0000-4000-8000-000000000005',
    ownerId: OWNER_UUID,
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ownerSuspended: false,
    planRestricted: false
};

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(() => ({
            search: mockSearch
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
 * Minimal list route-factory mock: wraps the handler in a Hono app.
 */
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
    const { publicGetUserAccommodationsRoute } = await import(
        '../../../../src/routes/user/public/getAccommodations'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetUserAccommodationsRoute);
    return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('publicGetUserAccommodationsRoute — SPEC-187 richDescription must be absent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('excludes richDescription from every item when the service returns it', async () => {
        // Arrange: service returns one accommodation with richDescription
        mockSearch.mockResolvedValue({
            data: { items: [ACCOMMODATION_WITH_RICH], total: 1 },
            error: null
        });

        // Act
        const app = await buildApp();
        const res = await app.request(`/${OWNER_UUID}/accommodations`);
        expect(res.status).toBe(200);

        // Assert: richDescription must not appear in any item.
        // The list route factory mock spreads { items, pagination } directly into
        // the response envelope, so items live at body.items (not body.data).
        const body = await res.json();
        const items: unknown[] = body.items ?? [];
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThan(0);

        for (const item of items) {
            expect(item).not.toHaveProperty('richDescription');
        }
    });

    it('still returns public card fields when richDescription is stripped', async () => {
        // Arrange
        mockSearch.mockResolvedValue({
            data: { items: [ACCOMMODATION_WITH_RICH], total: 1 },
            error: null
        });

        // Act
        const app = await buildApp();
        const res = await app.request(`/${OWNER_UUID}/accommodations`);
        const body = await res.json();
        // Items are at body.items in the list mock envelope
        const item = (body.items as unknown[])[0] as Record<string, unknown>;

        // Assert: other public fields survive the strip
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('slug');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('description');
        expect(item).not.toHaveProperty('richDescription');
    });

    it('returns an empty items array when the service returns no items', async () => {
        // Arrange
        mockSearch.mockResolvedValue({
            data: { items: [], total: 0 },
            error: null
        });

        // Act
        const app = await buildApp();
        const res = await app.request(`/${OWNER_UUID}/accommodations`);
        const body = await res.json();
        const items: unknown[] = body.items ?? [];

        // Assert
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(0);
    });
});
