/**
 * Integration tests for SPEC-063-gaps T-018 (GAP-017).
 *
 * Verifies that PATCH admin routes for the three SPEC-063 entities reject
 * legacy / unknown keys with a 400 VALIDATION_ERROR at the route boundary,
 * rather than silently dropping them at the Hono zValidator middleware.
 *
 * This is the runtime-level enforcement of AC-002-02 and AC-003-03 that
 * complements the schema-level `.strict()` added in T-017. Schema unit tests
 * alone do not prove the route wiring; this test drives the full pipeline:
 * HTTP → zValidator → service (mocked).
 *
 * Endpoints under test:
 *   PATCH /api/v1/admin/owner-promotions/:id    → reject {isActive: false}
 *   PATCH /api/v1/admin/sponsorships/:id        → reject {status: 'active'}
 *   PATCH /api/v1/admin/accommodations/reviews/:id  → reject unknown keys
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mutable refs for mocks — same pattern as
 * `test/integration/accommodation-reviews/admin-search-filters.test.ts`.
 * `vi.mock()` hoists the factory above outer const declarations, so we read
 * them through these refs instead of closing over `const` names directly.
 */
const ownerPromotionRef: { update: ReturnType<typeof vi.fn> } = {
    update: vi.fn()
};
const sponsorshipRef: { update: ReturnType<typeof vi.fn> } = {
    update: vi.fn()
};
const accommodationReviewRef: { update: ReturnType<typeof vi.fn> } = {
    update: vi.fn()
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        OwnerPromotionService: vi.fn().mockImplementation(() => ({
            update: (...args: unknown[]) => ownerPromotionRef.update(...args)
        })),
        SponsorshipService: vi.fn().mockImplementation(() => ({
            update: (...args: unknown[]) => sponsorshipRef.update(...args)
        })),
        AccommodationReviewService: vi.fn().mockImplementation(() => ({
            update: (...args: unknown[]) => accommodationReviewRef.update(...args)
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

const validUuid = '00000000-0000-0000-0000-000000000001';

const adminActor = {
    id: crypto.randomUUID(),
    role: RoleEnum.ADMIN,
    permissions: [
        PermissionEnum.ACCESS_API_PUBLIC,
        PermissionEnum.ACCESS_API_PRIVATE,
        PermissionEnum.ACCESS_PANEL_ADMIN,
        PermissionEnum.OWNER_PROMOTION_UPDATE,
        PermissionEnum.SPONSORSHIP_UPDATE,
        PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        PermissionEnum.ACCOMMODATION_REVIEW_MODERATE,
        PermissionEnum.MANAGE_CONTENT
    ]
};

function makeHeaders(
    actor: { id: string; role: string; permissions: string[] },
    extra: Record<string, string> = {}
): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.role,
        'x-mock-actor-permissions': JSON.stringify(actor.permissions),
        ...extra
    };
}

describe('PATCH admin routes — strict validation rejects legacy keys (T-018)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    beforeEach(() => {
        ownerPromotionRef.update = vi.fn();
        sponsorshipRef.update = vi.fn();
        accommodationReviewRef.update = vi.fn();
    });

    // ------------------------------------------------------------------------
    // AC-002-02 — OwnerPromotion: reject legacy `isActive` key
    // ------------------------------------------------------------------------
    it('AC-002-02: PATCH /admin/owner-promotions/:id with {isActive: false} → 400', async () => {
        // Arrange
        const res = await app.request(`/api/v1/admin/owner-promotions/${validUuid}`, {
            method: 'PATCH',
            headers: makeHeaders(adminActor),
            body: JSON.stringify({ isActive: false })
        });

        // Assert
        expect(res.status).toBe(400);
        // The service mock must NOT have been called — rejection happens upstream.
        expect(ownerPromotionRef.update).not.toHaveBeenCalled();
    });

    // ------------------------------------------------------------------------
    // AC-003-03 — Sponsorship: reject legacy `status` key
    // ------------------------------------------------------------------------
    it('AC-003-03: PATCH /admin/sponsorships/:id with {status: "active"} → 400', async () => {
        // Arrange
        const res = await app.request(`/api/v1/admin/sponsorships/${validUuid}`, {
            method: 'PATCH',
            headers: makeHeaders(adminActor),
            body: JSON.stringify({ status: 'active' })
        });

        // Assert
        expect(res.status).toBe(400);
        expect(sponsorshipRef.update).not.toHaveBeenCalled();
    });

    // ------------------------------------------------------------------------
    // Defense-in-depth — AccommodationReview: reject any unknown key
    // ------------------------------------------------------------------------
    it('defense-in-depth: PATCH /admin/accommodations/reviews/:id with unknown key → 400', async () => {
        // Arrange
        const res = await app.request(`/api/v1/admin/accommodations/reviews/${validUuid}`, {
            method: 'PATCH',
            headers: makeHeaders(adminActor),
            body: JSON.stringify({ notAField: 'boom' })
        });

        // Assert
        expect(res.status).toBe(400);
        expect(accommodationReviewRef.update).not.toHaveBeenCalled();
    });
});
