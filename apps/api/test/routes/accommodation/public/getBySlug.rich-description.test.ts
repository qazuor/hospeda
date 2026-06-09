/**
 * SPEC-187 P2-T6 — public accommodation slug route richDescription gate.
 *
 * This test is intentionally isolated from the rest of `initApp()`: we mount
 * only the `publicGetAccommodationBySlugRoute` and mock the service/DB edges so
 * the assertions stay focused on the route contract introduced by P2-T6:
 * the route must resolve OWNER entitlements and feed them into
 * `filterAccommodationByEntitlements`, which then omits or preserves
 * `richDescription`.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

const mockGetBySlug = vi.fn();
const mockResolveOwnerEntitlementsForOwnerId = vi.fn();
const mockSelect = vi.fn();

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        AccommodationService: vi.fn().mockImplementation(() => ({
            getBySlug: mockGetBySlug
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

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        getDb: vi.fn(() => ({
            select: mockSelect
        })),
        accommodationFaqs: {
            id: 'faq.id',
            question: 'faq.question',
            answer: 'faq.answer',
            category: 'faq.category',
            accommodationId: 'faq.accommodationId',
            lifecycleState: 'faq.lifecycleState',
            deletedAt: 'faq.deletedAt'
        },
        amenities: { id: 'amenities.id', name: 'amenities.name', icon: 'amenities.icon' },
        features: { id: 'features.id', name: 'features.name', icon: 'features.icon' },
        rAccommodationAmenity: {
            amenityId: 'raa.amenityId',
            isOptional: 'raa.isOptional',
            additionalCost: 'raa.additionalCost',
            accommodationId: 'raa.accommodationId'
        },
        rAccommodationFeature: {
            featureId: 'raf.featureId',
            hostReWriteName: 'raf.hostReWriteName',
            comments: 'raf.comments',
            accommodationId: 'raf.accommodationId'
        },
        users: {
            id: 'users.id',
            displayName: 'users.displayName',
            firstName: 'users.firstName',
            lastName: 'users.lastName',
            image: 'users.image',
            profile: 'users.profile',
            createdAt: 'users.createdAt'
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

vi.mock('../../../../src/middlewares/owner-entitlement', () => ({
    ownerEntitlementMiddleware: vi.fn(),
    resolveOwnerEntitlementsForOwnerId: mockResolveOwnerEntitlementsForOwnerId
}));

vi.mock('../../../../src/utils/route-factory', () => ({
    createPublicRoute: (options: {
        method: 'get' | 'post' | 'put' | 'delete' | 'patch';
        path: string;
        handler: (
            c: { req: { param: () => Record<string, string> } } & {
                json: (data: unknown) => Response;
            },
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

function queueSelectResults(...rowsByCall: unknown[][]) {
    mockSelect.mockImplementation(() => {
        const rows = rowsByCall.shift() ?? [];
        const result = [...rows] as unknown[] & { limit?: (n: number) => Promise<unknown[]> };
        result.limit = vi.fn().mockResolvedValue(rows);
        const chain = {
            from: vi.fn().mockReturnThis(),
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnValue(result)
        };
        return chain;
    });
}

async function buildApp() {
    vi.resetModules();
    const { publicGetAccommodationBySlugRoute } = await import(
        '../../../../src/routes/accommodation/public/getBySlug'
    );
    const app = new Hono<AppBindings>();
    app.route('/', publicGetAccommodationBySlugRoute);
    return app;
}

describe('publicGetAccommodationBySlugRoute — richDescription gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // owner, amenities, features, faqs = empty
        queueSelectResults([], [], [], []);
    });

    it('includes richDescription when the owning host is entitled', async () => {
        mockGetBySlug.mockResolvedValue({
            data: {
                id: 'acc-001',
                slug: 'casa-premium',
                ownerId: 'owner-001',
                description: 'Plain description',
                richDescription: '## Premium\n\n**luxury**',
                createdAt: new Date('2026-01-01T00:00:00.000Z')
            }
        });
        mockResolveOwnerEntitlementsForOwnerId.mockResolvedValue(['can_use_rich_description']);

        const app = await buildApp();
        const res = await app.request('/slug/casa-premium');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.richDescription).toBe('## Premium\n\n**luxury**');
    });

    it('omits richDescription when the owning host is not entitled', async () => {
        mockGetBySlug.mockResolvedValue({
            data: {
                id: 'acc-001',
                slug: 'casa-free',
                ownerId: 'owner-001',
                description: 'Plain description',
                richDescription: '## Premium\n\n**luxury**',
                createdAt: new Date('2026-01-01T00:00:00.000Z')
            }
        });
        mockResolveOwnerEntitlementsForOwnerId.mockResolvedValue([]);

        const app = await buildApp();
        const res = await app.request('/slug/casa-free');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.richDescription).toBeUndefined();
        expect(body.data.description).toBe('Plain description');
    });
});
