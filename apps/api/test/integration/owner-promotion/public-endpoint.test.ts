/**
 * Integration tests for public owner-promotion list endpoint — AC-005-01.
 *
 * Strategy: mock @repo/service-core at the file level so we can inspect what
 * arguments the service `search` method receives after the route parses the
 * query string, and control what shape the response items take.
 *
 * Route-level scope for AC-005-01:
 *   - Pipeline: HTTP query param -> OwnerPromotionSearchSchema parse -> service.search
 *   - Response schema strip: OwnerPromotionPublicSchema excludes `lifecycleState`
 *
 * The force-ACTIVE override itself (server ignores caller-supplied lifecycleState)
 * is covered by the service unit test in:
 *   packages/service-core/test/services/owner-promotion/ownerPromotion.service.test.ts
 *
 * Tested endpoint:
 *   GET /api/v1/public/owner-promotions
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mutable reference for the captured `search` mock. The `vi.mock()` factory is
 * hoisted above outer `const` declarations, so we store the mock on `mockRef`
 * and read it from tests (same pattern as admin-list.test.ts).
 */
const mockRef: { search: ReturnType<typeof vi.fn> } = {
    search: vi.fn()
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        OwnerPromotionService: vi.fn().mockImplementation(() => ({
            search: (...args: unknown[]) => mockRef.search(...args)
        })),
        ServiceError: class ServiceError extends Error {
            constructor(
                public readonly code: string,
                message: string
            ) {
                super(message);
            }
        }
    };
});

import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';

describe('Public OwnerPromotion list — AC-005-01', () => {
    let app: ReturnType<typeof initApp>;

    const base = '/api/v1/public/owner-promotions';

    const activePromotionMock = {
        id: crypto.randomUUID(),
        slug: 'test-promotion',
        accommodationId: crypto.randomUUID(),
        title: 'Test promotion',
        description: 'A test promotion for integration coverage',
        discountType: 'percentage',
        discountValue: 10,
        minNights: 2,
        validFrom: new Date('2026-01-01T00:00:00Z').toISOString(),
        validUntil: new Date('2026-12-31T23:59:59Z').toISOString(),
        // Admin-only field that MUST be stripped by OwnerPromotionPublicSchema
        lifecycleState: 'ACTIVE',
        ownerId: crypto.randomUUID(),
        currentRedemptions: 0,
        maxRedemptions: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: null,
        updatedById: null,
        deletedAt: null,
        deletedById: null
    };

    /**
     * Public endpoints still go through the request-validation middleware,
     * which requires minimal headers (content-type + user-agent). Without
     * them the middleware short-circuits with 400 MISSING_REQUIRED_HEADER.
     */
    const publicHeaders: Record<string, string> = {
        'content-type': 'application/json',
        'user-agent': 'vitest'
    };

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    beforeEach(() => {
        mockRef.search = vi.fn().mockResolvedValue({
            data: { items: [activePromotionMock], total: 1 }
        });
    });

    describe('pipeline (HTTP -> schema -> service.search)', () => {
        it('accepts request without lifecycleState and calls service.search', async () => {
            // Act
            const res = await app.request(base, { headers: publicHeaders });

            // Assert
            expect(res.status).toBe(200);
            expect(mockRef.search).toHaveBeenCalledOnce();
            // The schema does not require lifecycleState; service-level logic
            // force-overrides to ACTIVE (see ownerPromotion.service.test.ts).
        });

        it('accepts lifecycleState=ACTIVE query param and forwards it to service', async () => {
            // Act
            const res = await app.request(`${base}?lifecycleState=ACTIVE`, {
                headers: publicHeaders
            });

            // Assert
            expect(res.status).toBe(200);
            expect(mockRef.search).toHaveBeenCalledOnce();
            const [, query] = mockRef.search.mock.calls[0] as [unknown, Record<string, unknown>];
            expect(query).toHaveProperty('lifecycleState', 'ACTIVE');
        });

        it('rejects lifecycleState=INVALID_STATE with 400 validation error', async () => {
            // Act
            const res = await app.request(`${base}?lifecycleState=INVALID_STATE`, {
                headers: publicHeaders
            });

            // Assert — validation layer must reject before reaching handler.
            expect([400, 422]).toContain(res.status);
            expect(mockRef.search).not.toHaveBeenCalled();
        });

        it('accepts lifecycleState=DRAFT at the schema layer (service overrides)', async () => {
            // Act — attacker-shaped request. Schema is permissive; the security
            // override happens at the service layer (covered by service unit test).
            const res = await app.request(`${base}?lifecycleState=DRAFT`, {
                headers: publicHeaders
            });

            // Assert — schema accepts the value, hands it off to the service.
            expect(res.status).toBe(200);
            expect(mockRef.search).toHaveBeenCalledOnce();
            const [, query] = mockRef.search.mock.calls[0] as [unknown, Record<string, unknown>];
            expect(query).toHaveProperty('lifecycleState', 'DRAFT');
        });
    });

    describe('response shape', () => {
        it('strips lifecycleState from response items (admin-only field)', async () => {
            // Arrange — mock returns a record WITH lifecycleState to assert the
            // OwnerPromotionPublicSchema pick() drops it during serialization.

            // Act
            const res = await app.request(base, { headers: publicHeaders });
            expect(res.status).toBe(200);

            const body = (await res.json()) as {
                data?: { items: Array<Record<string, unknown>> };
                items?: Array<Record<string, unknown>>;
            };

            // Tolerate both envelope shapes (ResponseFactory vs flat):
            const items = body.data?.items ?? body.items ?? [];

            // Assert — each item must NOT contain the admin-only field.
            expect(items.length).toBeGreaterThan(0);
            for (const item of items) {
                expect(item).not.toHaveProperty('lifecycleState');
                expect(item).not.toHaveProperty('ownerId');
                expect(item).not.toHaveProperty('currentRedemptions');
            }
        });
    });
});
