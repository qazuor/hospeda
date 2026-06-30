/**
 * F1 regression — public accommodation list surfaces `hasAiChat` per item.
 *
 * "Chat IA" is an OWNER-level billing feature (EntitlementKey.AI_CHAT), not a
 * stored per-accommodation flag. The public list endpoint resolves the owning
 * host's entitlements (deduped by ownerId, cached) and attaches `hasAiChat` so
 * the listing card can show a "Chat IA" badge.
 *
 * This test mocks the service to return accommodations with known owners and
 * mocks the owner-entitlement resolver, asserting `hasAiChat` reflects the
 * owner's AI_CHAT entitlement, that each distinct owner is resolved once, and
 * that resolution failures fail closed (no badge).
 */

import { EntitlementKey } from '@repo/billing';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../../../src/types';

// ── Mock handles ──────────────────────────────────────────────────────────────

const mockSearch = vi.fn();
const mockResolveOwnerEntitlements = vi.fn();

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
        visibility: 'PUBLIC',
        lifecycleState: 'ACTIVE',
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

vi.mock('../../../../src/middlewares/owner-entitlement', () => ({
    resolveOwnerEntitlementsForOwnerId: mockResolveOwnerEntitlements
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

describe('publicListAccommodationsRoute — F1 hasAiChat badge', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('marks hasAiChat true only for accommodations whose owner has AI_CHAT', async () => {
        mockResolveOwnerEntitlements.mockImplementation(async (ownerId: string) =>
            ownerId === OWNER_WITH_AI ? [EntitlementKey.AI_CHAT] : []
        );
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    accommodation({ id: 'acc-1', slug: 'with-ai', ownerId: OWNER_WITH_AI }),
                    accommodation({ id: 'acc-2', slug: 'no-ai', ownerId: OWNER_WITHOUT_AI })
                ],
                total: 2
            },
            error: null
        });

        const app = await buildApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.items as Array<Record<string, unknown>>;
        expect(items.find((i) => i.id === 'acc-1')?.hasAiChat).toBe(true);
        expect(items.find((i) => i.id === 'acc-2')?.hasAiChat).toBe(false);
    });

    it('resolves each distinct owner only once (dedup by ownerId)', async () => {
        mockResolveOwnerEntitlements.mockResolvedValue([EntitlementKey.AI_CHAT]);
        mockSearch.mockResolvedValue({
            data: {
                items: [
                    accommodation({ id: 'acc-1', slug: 'a', ownerId: OWNER_WITH_AI }),
                    accommodation({ id: 'acc-2', slug: 'b', ownerId: OWNER_WITH_AI })
                ],
                total: 2
            },
            error: null
        });

        const app = await buildApp();
        const res = await app.request('/');
        const body = await res.json();
        const items = body.items as Array<Record<string, unknown>>;

        // Both items share an owner → only one entitlement resolution.
        expect(mockResolveOwnerEntitlements).toHaveBeenCalledTimes(1);
        expect(mockResolveOwnerEntitlements).toHaveBeenCalledWith(OWNER_WITH_AI);
        expect(items.every((i) => i.hasAiChat === true)).toBe(true);
    });

    it('fails closed (hasAiChat false) when entitlement resolution throws', async () => {
        mockResolveOwnerEntitlements.mockRejectedValue(new Error('billing unavailable'));
        mockSearch.mockResolvedValue({
            data: { items: [accommodation({ id: 'acc-1', ownerId: OWNER_WITH_AI })], total: 1 },
            error: null
        });

        const app = await buildApp();
        const res = await app.request('/');
        expect(res.status).toBe(200);

        const body = await res.json();
        const items = body.items as Array<Record<string, unknown>>;
        expect(items[0]?.hasAiChat).toBe(false);
    });
});

/**
 * Schema-contract guard. The route-factory mock above bypasses the real
 * `stripWithSchema` step, so it can't prove `hasAiChat` survives Zod parsing.
 * This asserts the field is declared on `AccommodationPublicSchema` — if it is
 * ever removed, `.strip()` would silently drop `hasAiChat` from every list
 * response and this test fails.
 */
describe('AccommodationPublicSchema — F1 hasAiChat contract', () => {
    it('declares an optional boolean hasAiChat so it survives serialization', async () => {
        const { AccommodationPublicSchema } = await import('@repo/schemas');
        expect(AccommodationPublicSchema.shape).toHaveProperty('hasAiChat');
        // Accepts a boolean and is optional (undefined is valid).
        expect(AccommodationPublicSchema.shape.hasAiChat.safeParse(true).success).toBe(true);
        expect(AccommodationPublicSchema.shape.hasAiChat.safeParse(undefined).success).toBe(true);
    });
});
