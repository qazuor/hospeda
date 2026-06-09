/**
 * SPEC-187 regression — destination accommodations endpoint must NOT expose richDescription.
 *
 * GET /api/v1/public/destinations/:id/accommodations returns an array of
 * AccommodationPublicSchema cards. Since SPEC-187 added richDescription to that
 * schema, the blanket schema-strip no longer hides the premium field — this
 * card listing must strip it explicitly. This test mocks the service to return
 * an accommodation that includes richDescription and asserts it is absent from
 * the response.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Service mock ──────────────────────────────────────────────────────────────

const mockGetAccommodations = vi.fn();

/**
 * Shared accommodation stub that includes a richDescription value.
 * The fix must strip this field before it reaches the HTTP response.
 */
const ACCOMMODATION_WITH_RICH = {
    id: 'b1b2b3b4-0000-4000-8000-000000000003',
    slug: 'premium-lodge',
    name: 'Premium Lodge',
    summary: 'A very nice lodge',
    description: 'Plain description text',
    richDescription: '## Premium\n\nThis must NOT appear in the public response.',
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
    ownerId: 'eeeeeeee-0000-4000-8000-000000000003',
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
        DestinationService: vi.fn().mockImplementation(() => ({
            getAccommodations: mockGetAccommodations
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

vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicRoute: (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (
            c: { req: { param: () => Record<string, string> } },
            params: Record<string, unknown>
        ) => Promise<unknown>;
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

// ── helpers ───────────────────────────────────────────────────────────────────

const DEST_ID = 'dddddddd-0000-4000-8000-000000000003';

async function buildApp() {
    vi.resetModules();
    const { publicGetDestinationAccommodationsRoute } = await import(
        '../../../../src/routes/destination/public/getAccommodations'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetDestinationAccommodationsRoute);
    return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('publicGetDestinationAccommodationsRoute — SPEC-187 richDescription must be absent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('excludes richDescription from every item when the service returns it', async () => {
        mockGetAccommodations.mockResolvedValue({
            data: { accommodations: [ACCOMMODATION_WITH_RICH] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${DEST_ID}/accommodations`);
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.data as unknown[];
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThan(0);

        for (const item of items) {
            expect(item).not.toHaveProperty('richDescription');
        }
    });

    it('still returns public card fields when richDescription is stripped', async () => {
        mockGetAccommodations.mockResolvedValue({
            data: { accommodations: [ACCOMMODATION_WITH_RICH] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${DEST_ID}/accommodations`);
        const body = await res.json();
        const item = (body.data as unknown[])[0] as Record<string, unknown>;

        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('slug');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('description');
        expect(item).not.toHaveProperty('richDescription');
    });

    it('returns an empty array when the service returns no accommodations', async () => {
        mockGetAccommodations.mockResolvedValue({
            data: { accommodations: [] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/${DEST_ID}/accommodations`);
        const body = await res.json();
        const items = body.data as unknown[];

        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBe(0);
    });
});
