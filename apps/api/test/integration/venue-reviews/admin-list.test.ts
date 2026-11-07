/**
 * Integration tests for the admin venue-review list endpoint —
 * moderation `status` filter.
 *
 * Regression (SPEC-259 Chrome smoke): the moderation UI calls
 *   GET /api/v1/admin/venues/reviews?status=PENDING&page=1&pageSize=20
 * but the route did not whitelist `status`, so the admin-list factory rejected
 * it as an unknown query param with HTTP 400 / INVALID_PAGINATION_PARAMS. The
 * admin "Reseñas" tab then silently showed "no pending reviews" even when a
 * PENDING review existed. The route now declares `status` in `requestQuery`
 * (whitelisted + validated + forwarded) and maps it to a `moderationState`
 * filter via the dedicated `listForModeration` service method — NOT the base
 * `adminList` `status` param, which means `lifecycleState`.
 *
 * Strategy: mock @repo/service-core so we can assert what the handler forwards
 * to the service after the route parses the query string.
 *
 * Tested endpoint: GET /api/v1/admin/venues/reviews
 */

import { LifecycleStatusEnum, ModerationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Mutable reference holding the captured mock for listForModeration.
 * Stored on an object to dodge the vi.mock() hoisting temporal-dead-zone.
 */
const mockRef: { listForModeration: Mock } = {
    listForModeration: vi.fn()
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        VenueReviewService: vi.fn().mockImplementation(function () {
            return {
                listForModeration: (...args: unknown[]) => mockRef.listForModeration(...args)
            };
        }),
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

describe('Admin VenueReview List — moderation status filter (SPEC-259 regression)', () => {
    let app: ReturnType<typeof initApp>;

    // Trailing slash: the admin venue router mounts reviews at `/reviews`
    // with an inner `path: '/'`, so the full path resolves as `/reviews/`.
    const base = '/api/v1/admin/venues/reviews/';

    // Grant the full venue and experience admin permission set so the route middleware
    // pipeline (sibling routes share the venue admin router) does not
    // block before the handler runs. The endpoint itself requires
    // VENUE_MODERATE_REVIEW.
    const adminActor = {
        id: crypto.randomUUID(),
        roles: [RoleEnum.ADMIN],
        permissions: [
            PermissionEnum.ACCESS_API_PUBLIC,
            PermissionEnum.ACCESS_API_PRIVATE,
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            PermissionEnum.MANAGE_CONTENT,
            PermissionEnum.VENUE_VIEW_ALL,
            PermissionEnum.VENUE_CREATE,
            PermissionEnum.VENUE_EDIT_ALL,
            PermissionEnum.VENUE_DELETE,
            PermissionEnum.VENUE_MODERATE_REVIEW
        ]
    };

    /**
     * Builds mock auth headers for a test actor.
     */
    function makeHeaders(actor: {
        id: string;
        roles: readonly string[];
        permissions: string[];
    }): Record<string, string> {
        return {
            'content-type': 'application/json',
            'user-agent': 'vitest',
            'x-mock-actor-id': actor.id,
            'x-mock-actor-role': actor.roles.join(','),
            'x-mock-actor-permissions': JSON.stringify(actor.permissions)
        };
    }

    /**
     * Builds a complete PENDING review the route's `VenueReviewSchema` accepts.
     * Overrides let each case set its own breakdown.
     */
    function pendingReview(overrides: Record<string, unknown> = {}): Record<string, unknown> {
        const now = new Date('2026-01-01T00:00:00.000Z');
        return {
            id: crypto.randomUUID(),
            venueId: crypto.randomUUID(),
            userId: null,
            title: 'A review title',
            content: 'A review content long enough to pass validation.',
            rating: { food: 4, service: 5 },
            averageRating: 4.5,
            overallRating: 4.5,
            reviewerName: 'Reviewer',
            moderatedById: null,
            moderatedAt: null,
            moderationReason: null,
            lifecycleState: LifecycleStatusEnum.ACTIVE,
            moderationState: ModerationStatusEnum.PENDING,
            createdAt: now,
            updatedAt: now,
            createdById: null,
            updatedById: null,
            deletedAt: null,
            deletedById: null,
            ...overrides
        };
    }

    beforeAll(() => {
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(() => {
        mockRef.listForModeration = vi.fn().mockResolvedValue({ data: { items: [], total: 0 } });
    });

    it('accepts status=PENDING (was 400) and forwards moderationState=PENDING', async () => {
        const res = await app.request(`${base}?status=PENDING&page=1&pageSize=20`, {
            headers: makeHeaders(adminActor)
        });

        // Regression: this used to be 400 INVALID_PAGINATION_PARAMS.
        expect(res.status).toBe(200);
        expect(mockRef.listForModeration).toHaveBeenCalledOnce();
        const [, params] = mockRef.listForModeration.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(params).toMatchObject({
            moderationState: ModerationStatusEnum.PENDING,
            page: 1,
            pageSize: 20
        });
    });

    it('accepts a request with no status filter (moderationState undefined)', async () => {
        const res = await app.request(base, {
            headers: makeHeaders(adminActor)
        });

        expect(res.status).toBe(200);
        expect(mockRef.listForModeration).toHaveBeenCalledOnce();
        const [, params] = mockRef.listForModeration.mock.calls[0] as [
            unknown,
            Record<string, unknown>
        ];
        expect(params.moderationState).toBeUndefined();
    });

    it('returns the review rating breakdown so the moderation panel can show it', async () => {
        mockRef.listForModeration = vi.fn().mockResolvedValue({
            data: {
                items: [pendingReview({ rating: { food: 4, service: 5 } })],
                total: 1
            }
        });

        const res = await app.request(`${base}?status=PENDING`, {
            headers: makeHeaders(adminActor)
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: { items: Array<{ rating?: unknown }> };
        };
        expect(body.data.items[0]?.rating).toEqual({ food: 4, service: 5 });
    });

    it('returns a review without a breakdown with no rating', async () => {
        mockRef.listForModeration = vi.fn().mockResolvedValue({
            data: {
                items: [pendingReview({ rating: null })],
                total: 1
            }
        });

        const res = await app.request(`${base}?status=PENDING`, {
            headers: makeHeaders(adminActor)
        });

        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: { items: Array<{ rating?: unknown }> };
        };
        expect(body.data.items[0]?.rating ?? null).toBeNull();
    });

    it('rejects an invalid status value before reaching the handler', async () => {
        const res = await app.request(`${base}?status=NOT_A_STATE`, {
            headers: makeHeaders(adminActor)
        });

        // The nativeEnum validation rejects unknown values (400 or 422 depending
        // on middleware ordering) and the handler never runs.
        expect([400, 422]).toContain(res.status);
        expect(mockRef.listForModeration).not.toHaveBeenCalled();
    });
});
