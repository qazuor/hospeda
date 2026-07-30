/**
 * SPEC-187 / SPEC-212 regression — top-rated-by-destination must NOT expose
 * either rich-description field.
 *
 * This route is the worst prior offender in the family: unlike its sibling card
 * listings it carried NO rich-description stripping at all, so the service's full
 * accommodation entity flowed straight through `AccommodationPublicSchema` — a
 * schema that deliberately re-exposes BOTH `richDescription` and its SPEC-212 i18n
 * sibling `richDescriptionI18n`. `stripWithSchema` therefore hid neither.
 *
 * The suite mocks the service to return an accommodation carrying both fields and
 * asserts both are absent from the response.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Service mock ──────────────────────────────────────────────────────────────

const mockGetTopRatedByDestination = vi.fn();
const mockResolveOwnerEntitlementsForOwnerIds = vi.fn();

const DEST_ID = 'dddddddd-0000-4000-8000-000000000006';
const OWNER_ID = 'eeeeeeee-0000-4000-8000-000000000006';

/**
 * Accommodation stub carrying BOTH premium rich-description fields.
 * The fix must strip both before they reach the HTTP response.
 */
const ACCOMMODATION_WITH_RICH = {
    id: 'b1b2b3b4-0000-4000-8000-000000000006',
    slug: 'premium-lodge-top-rated',
    name: 'Premium Lodge (top-rated)',
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
    averageRating: 4.9,
    reviewsCount: 42,
    media: null,
    price: null,
    location: null,
    seo: null,
    extraInfo: null,
    destinationId: DEST_ID,
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
        AccommodationService: vi.fn().mockImplementation(function () {
            return {
                getTopRatedByDestination: mockGetTopRatedByDestination
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
    resolveOwnerEntitlementsForOwnerIds: (...args: readonly string[][]) =>
        mockResolveOwnerEntitlementsForOwnerIds(...args)
}));

vi.mock('../../../../src/utils/actor', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../../src/utils/actor')>();
    return {
        ...actual,
        createGuestActor: vi.fn(() => ({
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

vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicRoute: (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (c: { req: { param: () => Record<string, string> } }) => Promise<unknown>;
    }) => {
        const app = new Hono<AppBindings>();
        const honoPath = options.path.replace(/\{([^}]+)\}/g, ':$1');
        app[options.method](honoPath, async (c) => {
            const result = await options.handler(c);
            return c.json({ success: true, data: result });
        });
        return app;
    }
}));

// ── helpers ───────────────────────────────────────────────────────────────────

async function buildApp() {
    vi.resetModules();
    const { getTopRatedByDestinationRoute } = await import(
        '../../../../src/routes/accommodation/public/getTopRatedByDestination'
    );
    const app = new Hono<AppBindings>();
    app.route('/', getTopRatedByDestinationRoute);
    return app;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('getTopRatedByDestinationRoute — both rich-description fields must be absent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockResolveOwnerEntitlementsForOwnerIds.mockResolvedValue(new Map());
    });

    it('excludes richDescription AND richDescriptionI18n from every item', async () => {
        mockGetTopRatedByDestination.mockResolvedValue({
            data: { accommodations: [ACCOMMODATION_WITH_RICH] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/destination/${DEST_ID}/top-rated`);
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = (body.data as { data: unknown[] }).data;
        expect(Array.isArray(items)).toBe(true);
        expect(items.length).toBeGreaterThan(0);

        for (const item of items) {
            expect(item).not.toHaveProperty('richDescription');
            expect(item).not.toHaveProperty('richDescriptionI18n');
        }
    });

    it('still returns the public card fields after stripping', async () => {
        mockGetTopRatedByDestination.mockResolvedValue({
            data: { accommodations: [ACCOMMODATION_WITH_RICH] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/destination/${DEST_ID}/top-rated`);
        const body = await res.json();
        const item = (body.data as { data: unknown[] }).data[0] as Record<string, unknown>;

        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('slug');
        expect(item).toHaveProperty('name');
        expect(item).toHaveProperty('description', 'Plain description text');
        expect(item).not.toHaveProperty('richDescription');
        expect(item).not.toHaveProperty('richDescriptionI18n');
    });

    it('returns an empty page when the destination has no rated accommodations', async () => {
        mockGetTopRatedByDestination.mockResolvedValue({
            data: { accommodations: [] },
            error: null
        });

        const app = await buildApp();
        const res = await app.request(`/destination/${DEST_ID}/top-rated`);
        const body = await res.json();
        const envelope = body.data as { data: unknown[]; pagination: { total: number } };

        expect(envelope.data).toHaveLength(0);
        expect(envelope.pagination.total).toBe(0);
    });
});
