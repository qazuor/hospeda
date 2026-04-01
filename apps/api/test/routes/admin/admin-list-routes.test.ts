/**
 * Integration tests for all 16 admin list routes that use adminList()
 *
 * Tests the common behavior shared by all admin list endpoints,
 * using a table-driven approach to avoid duplication.
 *
 * AccommodationReview and DestinationReview routes are nested under parent
 * entity routers (/accommodations/reviews, /destinations/reviews).
 * The /reviews subrouter is registered BEFORE the /{id} parametric routes
 * in both parent routers to prevent routing conflicts.
 *
 * @module test/routes/admin/admin-list-routes
 */

import {
    AccommodationAdminSchema,
    AccommodationReviewAdminSchema,
    AmenityAdminSchema,
    AttractionAdminSchema,
    DestinationAdminSchema,
    DestinationReviewAdminSchema,
    EventAdminSchema,
    EventLocationAdminSchema,
    EventOrganizerAdminSchema,
    FeatureAdminSchema,
    OwnerPromotionAdminSchema,
    PermissionEnum,
    PostAdminSchema,
    PostSponsorAdminSchema,
    RoleEnum,
    SponsorshipAdminSchema,
    TagAdminSchema,
    UserAdminSchema
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ZodSchema } from 'zod';
import { initApp } from '../../../src/app';
import { createAuthenticatedRequest } from '../../helpers/auth';

/**
 * Route table entry describing one admin list endpoint
 */
interface AdminListRouteEntry {
    readonly entity: string;
    readonly path: string;
    readonly permission: PermissionEnum;
}

/**
 * Admin access permissions required by adminAuthMiddleware.
 * These gate access to any admin route before entity-specific permissions.
 */
const ADMIN_ACCESS_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_ADMIN
] as const;

/**
 * All entity-specific permissions needed across the admin list routes
 */
const ALL_ENTITY_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.ACCOMMODATION_VIEW_ALL,
    PermissionEnum.USER_READ_ALL,
    PermissionEnum.DESTINATION_VIEW_ALL,
    PermissionEnum.EVENT_VIEW_ALL,
    PermissionEnum.POST_VIEW_ALL,
    PermissionEnum.AMENITY_VIEW,
    PermissionEnum.FEATURE_VIEW,
    PermissionEnum.ATTRACTION_VIEW,
    PermissionEnum.TAG_VIEW,
    PermissionEnum.EVENT_LOCATION_VIEW,
    PermissionEnum.EVENT_ORGANIZER_VIEW,
    PermissionEnum.POST_SPONSOR_VIEW,
    PermissionEnum.OWNER_PROMOTION_VIEW,
    PermissionEnum.SPONSORSHIP_VIEW,
    PermissionEnum.ACCOMMODATION_REVIEW_VIEW,
    PermissionEnum.DESTINATION_REVIEW_VIEW
] as const;

/**
 * Creates a fully-authorized admin actor with admin access + all entity permissions
 */
function createFullAdminActor(extraPermissions: readonly PermissionEnum[] = []): Actor {
    return {
        id: crypto.randomUUID(),
        role: RoleEnum.ADMIN,
        permissions: [...ADMIN_ACCESS_PERMISSIONS, ...ALL_ENTITY_PERMISSIONS, ...extraPermissions]
    };
}

/**
 * All 16 admin list routes.
 *
 * AccommodationReview and DestinationReview are nested under parent entity
 * routers. Their /reviews subrouters are registered BEFORE the /{id}
 * parametric routes so Hono resolves /reviews as a static path, not a param.
 */
const ADMIN_LIST_ROUTES: readonly AdminListRouteEntry[] = [
    {
        entity: 'Accommodation',
        path: '/api/v1/admin/accommodations',
        permission: PermissionEnum.ACCOMMODATION_VIEW_ALL
    },
    {
        entity: 'User',
        path: '/api/v1/admin/users',
        permission: PermissionEnum.USER_READ_ALL
    },
    {
        entity: 'Destination',
        path: '/api/v1/admin/destinations',
        permission: PermissionEnum.DESTINATION_VIEW_ALL
    },
    {
        entity: 'Event',
        path: '/api/v1/admin/events',
        permission: PermissionEnum.EVENT_VIEW_ALL
    },
    {
        entity: 'Post',
        path: '/api/v1/admin/posts',
        permission: PermissionEnum.POST_VIEW_ALL
    },
    {
        entity: 'Amenity',
        path: '/api/v1/admin/amenities',
        permission: PermissionEnum.AMENITY_VIEW
    },
    {
        entity: 'Feature',
        path: '/api/v1/admin/features',
        permission: PermissionEnum.FEATURE_VIEW
    },
    {
        entity: 'Attraction',
        path: '/api/v1/admin/attractions',
        permission: PermissionEnum.ATTRACTION_VIEW
    },
    {
        entity: 'Tag',
        path: '/api/v1/admin/tags',
        permission: PermissionEnum.TAG_VIEW
    },
    {
        entity: 'EventLocation',
        path: '/api/v1/admin/event-locations',
        permission: PermissionEnum.EVENT_LOCATION_VIEW
    },
    {
        entity: 'EventOrganizer',
        path: '/api/v1/admin/event-organizers',
        permission: PermissionEnum.EVENT_ORGANIZER_VIEW
    },
    {
        entity: 'PostSponsor',
        path: '/api/v1/admin/post-sponsors',
        permission: PermissionEnum.POST_SPONSOR_VIEW
    },
    {
        entity: 'OwnerPromotion',
        path: '/api/v1/admin/owner-promotions',
        permission: PermissionEnum.OWNER_PROMOTION_VIEW
    },
    {
        entity: 'Sponsorship',
        path: '/api/v1/admin/sponsorships',
        permission: PermissionEnum.SPONSORSHIP_VIEW
    },
    {
        entity: 'AccommodationReview',
        path: '/api/v1/admin/accommodations/reviews',
        permission: PermissionEnum.ACCOMMODATION_REVIEW_VIEW
    },
    {
        entity: 'DestinationReview',
        path: '/api/v1/admin/destinations/reviews',
        permission: PermissionEnum.DESTINATION_REVIEW_VIEW
    }
] as const;

describe('Admin List Routes (adminList)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        app = initApp();
    });

    // =========================================================================
    // Table-driven: verify every route returns 200 with paginated structure
    // =========================================================================
    describe('returns paginated list for all 16 admin list routes', () => {
        for (const route of ADMIN_LIST_ROUTES) {
            it(`${route.entity}: GET ${route.path} returns paginated response`, async () => {
                // Arrange
                const actor = createFullAdminActor();
                const reqOpts = createAuthenticatedRequest(actor);

                // Act
                const res = await app.request(route.path, reqOpts);

                // Assert
                expect(res.status).toBe(200);
                const body = await res.json();
                expect(body).toHaveProperty('success', true);
                expect(body).toHaveProperty('data');
                expect(body.data).toHaveProperty('items');
                expect(body.data).toHaveProperty('pagination');
                expect(Array.isArray(body.data.items)).toBe(true);
                expect(body.data.pagination).toHaveProperty('page');
                expect(body.data.pagination).toHaveProperty('pageSize');
                expect(body.data.pagination).toHaveProperty('total');
                expect(body.data.pagination).toHaveProperty('totalPages');
            });
        }
    });

    // =========================================================================
    // Common behavior tests (use first route as representative)
    // =========================================================================
    describe('common behavior', () => {
        // Use accommodations as the representative route for common behavior tests
        const representativeRoute = {
            entity: 'Accommodation',
            path: '/api/v1/admin/accommodations',
            permission: PermissionEnum.ACCOMMODATION_VIEW_ALL
        } as const;

        /**
         * Helper to make an authenticated admin request to the representative route
         */
        async function makeRequest(queryString = ''): Promise<Response> {
            const actor = createFullAdminActor();
            const reqOpts = createAuthenticatedRequest(actor);
            const url = queryString
                ? `${representativeRoute.path}?${queryString}`
                : representativeRoute.path;
            return app.request(url, reqOpts);
        }

        it('uses default pagination when no page/pageSize provided', async () => {
            // Act
            const res = await makeRequest();

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.pagination.page).toBe(1);
            expect(body.data.pagination.pageSize).toBe(20);
        });

        it('respects custom page and pageSize', async () => {
            // Act
            const res = await makeRequest('page=2&pageSize=5');

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.pagination.page).toBe(2);
            expect(body.data.pagination.pageSize).toBe(5);
        });

        it('accepts search filter', async () => {
            // Act
            const res = await makeRequest('search=test');

            // Assert
            expect(res.status).toBe(200);
        });

        it('accepts valid sort parameter', async () => {
            // Act
            const res = await makeRequest('sort=name:asc');

            // Assert
            expect(res.status).toBe(200);
        });

        it('rejects invalid sort format', async () => {
            // Act
            const res = await makeRequest('sort=invalid');

            // Assert
            expect(res.status).toBe(400);
        });

        it('accepts status filter', async () => {
            // Act
            const res = await makeRequest('status=ACTIVE');

            // Assert
            expect(res.status).toBe(200);
        });

        it('accepts includeDeleted filter', async () => {
            // Act
            const res = await makeRequest('includeDeleted=true');

            // Assert
            expect(res.status).toBe(200);
        });

        it('accepts date range filters', async () => {
            // Act
            const res = await makeRequest(
                'createdAfter=2026-01-01T00:00:00.000Z&createdBefore=2026-03-01T00:00:00.000Z'
            );

            // Assert
            expect(res.status).toBe(200);
        });

        it('accepts pageSize at maximum of 100', async () => {
            // Act
            const res = await makeRequest('pageSize=100');

            // Assert
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.data.pagination.pageSize).toBe(100);
        });

        it('rejects pageSize exceeding 100', async () => {
            // Act
            const res = await makeRequest('pageSize=101');

            // Assert
            expect(res.status).toBe(400);
        });

        it('rejects unknown query parameters', async () => {
            // Act
            const res = await makeRequest('unknownParam=value');

            // Assert
            expect(res.status).toBe(400);
        });

        it('rejects unauthenticated request', async () => {
            // Act - request without auth headers
            const res = await app.request(representativeRoute.path, {
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json'
                }
            });

            // Assert - should be rejected (401 or 403)
            expect([401, 403]).toContain(res.status);
        });

        it('rejects user without admin access permissions', async () => {
            // Arrange - user with entity permission but no admin access
            const actor: Actor = {
                id: crypto.randomUUID(),
                role: RoleEnum.USER,
                permissions: [representativeRoute.permission]
            };
            const reqOpts = createAuthenticatedRequest(actor);

            // Act
            const res = await app.request(representativeRoute.path, reqOpts);

            // Assert
            expect(res.status).toBe(403);
        });

        it('rejects admin without required entity permission', async () => {
            // Arrange - admin with panel access but no entity permission
            const actor: Actor = {
                id: crypto.randomUUID(),
                role: RoleEnum.ADMIN,
                permissions: [...ADMIN_ACCESS_PERMISSIONS]
            };
            const reqOpts = createAuthenticatedRequest(actor);

            // Act
            const res = await app.request(representativeRoute.path, reqOpts);

            // Assert
            expect(res.status).toBe(403);
        });
    });

    // =========================================================================
    // AdminSchema shape validation: verify response items conform to AdminSchema
    // =========================================================================
    describe('AdminSchema shape validation', () => {
        /**
         * Maps each route path segment (entity key) to its corresponding AdminSchema.
         * Used to validate that response items match the expected admin-level field shape,
         * including audit fields (createdById, updatedById, deletedAt, deletedById).
         */
        const adminSchemaMap: Record<string, ZodSchema> = {
            Accommodation: AccommodationAdminSchema,
            User: UserAdminSchema,
            Destination: DestinationAdminSchema,
            Event: EventAdminSchema,
            Post: PostAdminSchema,
            Amenity: AmenityAdminSchema,
            Feature: FeatureAdminSchema,
            Attraction: AttractionAdminSchema,
            Tag: TagAdminSchema,
            EventLocation: EventLocationAdminSchema,
            EventOrganizer: EventOrganizerAdminSchema,
            PostSponsor: PostSponsorAdminSchema,
            OwnerPromotion: OwnerPromotionAdminSchema,
            Sponsorship: SponsorshipAdminSchema,
            AccommodationReview: AccommodationReviewAdminSchema,
            DestinationReview: DestinationReviewAdminSchema
        } as const;

        for (const route of ADMIN_LIST_ROUTES) {
            it(`${route.entity}: response items conform to ${route.entity}AdminSchema`, async () => {
                // Arrange
                const schema = adminSchemaMap[route.entity];
                const actor = createFullAdminActor();
                const reqOpts = createAuthenticatedRequest(actor);

                // Act
                const res = await app.request(route.path, reqOpts);
                expect(res.status).toBe(200);

                const body = await res.json();
                const items: unknown[] = body.data.items;

                // Skip schema validation if no seed data returned — the route itself
                // already passed the 200 + paginated structure assertion above.
                if (items.length === 0) {
                    return;
                }

                // Assert — every item must parse cleanly against its AdminSchema
                for (const item of items) {
                    const result = schema.safeParse(item);
                    expect(
                        result.success,
                        `Item failed ${route.entity}AdminSchema validation: ${
                            result.success
                                ? ''
                                : JSON.stringify(
                                      (result as { error: { issues: unknown[] } }).error.issues,
                                      null,
                                      2
                                  )
                        }`
                    ).toBe(true);
                }
            });
        }
    });
});
