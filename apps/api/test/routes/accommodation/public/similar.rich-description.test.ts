/**
 * SPEC-187 regression — similar endpoint must NOT expose richDescription.
 *
 * richDescription is a PREMIUM field gated per-owner by the entitlement system.
 * The similar-cards endpoint never renders it, so it must be absent from the
 * payload regardless of what the DB row contains.
 *
 * This test mocks @repo/db to return a row that includes richDescription and
 * asserts the field is absent from the endpoint response.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── DB mock ──────────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockFindMany = vi.fn();

/**
 * Shared accommodation stub that includes a richDescription value.
 * The fix must ensure this field never reaches the HTTP response.
 */
const ACCOMMODATION_WITH_RICH = {
    id: 'b1b2b3b4-0000-4000-8000-000000000001',
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
    destinationId: 'dddddddd-0000-4000-8000-000000000001',
    ownerId: 'eeeeeeee-0000-4000-8000-000000000001',
    visibility: 'PUBLIC',
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ownerSuspended: false,
    planRestricted: false,
    contactInfo: null,
    socialNetworks: null,
    destination: {
        id: 'dddddddd-0000-4000-8000-000000000001',
        name: 'Concepción del Uruguay',
        slug: 'concepcion-del-uruguay',
        summary: 'City summary',
        destinationType: 'CITY',
        level: 1,
        path: null,
        pathIds: null
    }
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn(() => ({
            select: mockSelect,
            query: {
                accommodations: {
                    findMany: mockFindMany
                }
            }
        })),
        accommodations: {
            id: 'acc.id',
            slug: 'acc.slug',
            type: 'acc.type',
            destinationId: 'acc.destinationId',
            lifecycleState: 'acc.lifecycleState',
            visibility: 'acc.visibility',
            averageRating: 'acc.averageRating'
        }
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        ServiceError: class ServiceError extends Error {
            public readonly code: string;
            constructor(code: string, message: string) {
                super(message);
                this.code = code;
            }
        }
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
            return c.json({ success: true, data: result });
        });
        return app;
    }
}));

// ── helpers ───────────────────────────────────────────────────────────────────

const SOURCE_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

function buildSelectChain(rows: unknown[]) {
    const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(rows)
    };
    return chain;
}

async function buildApp() {
    vi.resetModules();
    const { publicGetSimilarRoute } = await import(
        '../../../../src/routes/accommodation/public/similar'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetSimilarRoute);
    return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('publicGetSimilarRoute — SPEC-187 richDescription must be absent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('excludes richDescription from the response when a DB row contains it', async () => {
        // First select() call: fetch source accommodation (type + destinationId)
        mockSelect.mockImplementationOnce(() =>
            buildSelectChain([
                {
                    type: 'CABIN',
                    destinationId: 'dddddddd-0000-4000-8000-000000000001'
                }
            ])
        );

        // findMany() returns a row that includes richDescription
        mockFindMany.mockResolvedValue([ACCOMMODATION_WITH_RICH]);

        const app = await buildApp();
        const res = await app.request(`/${SOURCE_ID}/similar`);
        expect(res.status).toBe(200);

        const body = await res.json();
        const items: unknown[] = body.data ?? [];
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThan(0);

        for (const item of items) {
            expect(item).not.toHaveProperty('richDescription');
        }
    });

    it('returns slug, name, summary, and other public card fields without richDescription', async () => {
        mockSelect.mockImplementationOnce(() =>
            buildSelectChain([
                {
                    type: 'CABIN',
                    destinationId: 'dddddddd-0000-4000-8000-000000000001'
                }
            ])
        );

        mockFindMany.mockResolvedValue([ACCOMMODATION_WITH_RICH]);

        const app = await buildApp();
        const res = await app.request(`/${SOURCE_ID}/similar`);
        const body = await res.json();
        const item = (body.data as unknown[])[0] as Record<string, unknown>;

        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('slug');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('summary');
        expect(item).not.toHaveProperty('richDescription');
    });
});
