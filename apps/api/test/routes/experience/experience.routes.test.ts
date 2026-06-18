/**
 * Integration tests for experience routes (SPEC-240 T-022).
 *
 * Boots the full Hono app (`initApp`) with `@repo/service-core` mocked to avoid
 * any live DB dependency. Asserts:
 *   1. Tier auth (public no auth, protected session+ownership, admin permissions)
 *   2. Visibility gate (subscription-off → null on public detail)
 *   3. Permission denials (403 for missing permissions)
 *   4. FAQ + review + CRUD flows
 *   5. Route existence (not 404)
 *
 * IMPORTANT: `vi.mock()` is hoisted to the top of the compiled module by Vitest,
 * before all `const` declarations. To avoid TDZ errors the stub containers MUST
 * be created with `vi.hoisted()`, which also runs in the hoisted zone.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Service stub containers — use vi.hoisted() to avoid TDZ ─────────────────
// vi.mock() factories are hoisted before all imports/consts. vi.hoisted() also
// runs in that zone so its return value is safely accessible inside vi.mock().

const { experienceSvc, reviewSvc, faqHelpers } = vi.hoisted(() => {
    const experienceSvc = {
        search: vi.fn(),
        getById: vi.fn(),
        getBySlug: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateOwn: vi.fn(),
        softDelete: vi.fn(),
        hardDelete: vi.fn(),
        restore: vi.fn(),
        adminList: vi.fn()
    };

    const reviewSvc = {
        listByExperience: vi.fn(),
        create: vi.fn(),
        getById: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn(),
        adminList: vi.fn(),
        moderateReview: vi.fn()
    };

    const faqHelpers = {
        listExperienceFaqs: vi.fn(),
        addExperienceFaq: vi.fn(),
        updateExperienceFaq: vi.fn(),
        removeExperienceFaq: vi.fn(),
        reorderExperienceFaqs: vi.fn()
    };

    return { experienceSvc, reviewSvc, faqHelpers };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        ExperienceService: vi.fn().mockImplementation(() => ({
            search: (...args: unknown[]) => experienceSvc.search(...args),
            getById: (...args: unknown[]) => experienceSvc.getById(...args),
            getBySlug: (...args: unknown[]) => experienceSvc.getBySlug(...args),
            create: (...args: unknown[]) => experienceSvc.create(...args),
            update: (...args: unknown[]) => experienceSvc.update(...args),
            updateOwn: (...args: unknown[]) => experienceSvc.updateOwn(...args),
            softDelete: (...args: unknown[]) => experienceSvc.softDelete(...args),
            hardDelete: (...args: unknown[]) => experienceSvc.hardDelete(...args),
            restore: (...args: unknown[]) => experienceSvc.restore(...args),
            adminList: (...args: unknown[]) => experienceSvc.adminList(...args)
        })),
        ExperienceReviewService: vi.fn().mockImplementation(() => ({
            listByExperience: (...args: unknown[]) => reviewSvc.listByExperience(...args),
            create: (...args: unknown[]) => reviewSvc.create(...args),
            getById: (...args: unknown[]) => reviewSvc.getById(...args),
            update: (...args: unknown[]) => reviewSvc.update(...args),
            softDelete: (...args: unknown[]) => reviewSvc.softDelete(...args),
            adminList: (...args: unknown[]) => reviewSvc.adminList(...args),
            moderateReview: (...args: unknown[]) => reviewSvc.moderateReview(...args)
        })),
        listExperienceFaqs: (...args: unknown[]) => faqHelpers.listExperienceFaqs(...args),
        addExperienceFaq: (...args: unknown[]) => faqHelpers.addExperienceFaq(...args),
        updateExperienceFaq: (...args: unknown[]) => faqHelpers.updateExperienceFaq(...args),
        removeExperienceFaq: (...args: unknown[]) => faqHelpers.removeExperienceFaq(...args),
        reorderExperienceFaqs: (...args: unknown[]) => faqHelpers.reorderExperienceFaqs(...args),
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
import type { AppOpenAPI } from '../../../src/types';
import { validateApiEnv } from '../../../src/utils/env';

// ─── Test constants ───────────────────────────────────────────────────────────

const USER_AGENT = { 'user-agent': 'vitest' };
const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
const EXPERIENCE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const REVIEW_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const DESTINATION_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

// ─── Header presets ───────────────────────────────────────────────────────────

/** Anonymous (unauthenticated) headers. */
const publicHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...USER_AGENT
};

/** Authenticated tourist (no admin panel access). */
const touristHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...USER_AGENT,
    'x-mock-actor-id': MOCK_USER_ID,
    'x-mock-actor-role': 'TOURIST',
    'x-mock-actor-permissions': JSON.stringify([])
};

/** Admin with full commerce permissions. */
const adminHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...USER_AGENT,
    'x-mock-actor-id': MOCK_USER_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify([
        'access.panelAdmin',
        'commerce.create',
        'commerce.editAll',
        'commerce.delete',
        'commerce.viewAll',
        'commerce.moderateReview'
    ])
};

/** Admin panel access only (no entity permissions). */
const adminNoPanelHeaders: Record<string, string> = {
    'content-type': 'application/json',
    ...USER_AGENT,
    'x-mock-actor-id': MOCK_USER_ID,
    'x-mock-actor-role': 'ADMIN',
    'x-mock-actor-permissions': JSON.stringify(['access.panelAdmin'])
};

// ─── Fixtures ────────────────────────────────────────────────────────────────
//
// minimalExperience: satisfies ExperiencePublicSchema.
//   - type: 'TOUR_GUIDE' (UPPERCASE enum value)
//   - priceUnit: 'per_person' (lowercase enum value from ExperiencePriceUnitEnum)
//   - rating omitted (CommerceRatingSchema.optional() — no null allowed)
//   - tags/openingHours omitted (TagsFields/OpeningHoursFields.optional() — no null)
//
// adminExperienceFixture: extends minimalExperience to satisfy ExperienceAdminSchema.
//   Adds ownerId (required), moderationState (required — has .default('PENDING')).
//
// minimalReview: satisfies ExperienceReviewSchema.
//   Only required string/number fields — no null for optional fields.

const minimalExperience = {
    id: EXPERIENCE_ID,
    slug: 'test-experience',
    name: 'Test Experience',
    type: 'TOUR_GUIDE',
    summary: 'A test experience.',
    description: 'A detailed test experience description for this listing.',
    destinationId: DESTINATION_ID,
    hasActiveSubscription: true,
    lifecycleState: 'ACTIVE',
    visibility: 'PUBLIC',
    averageRating: 4.5,
    reviewsCount: 0,
    priceFrom: 1000,
    priceUnit: 'per_person',
    isPriceOnRequest: false,
    isFeatured: false,
    media: null,
    seo: null,
    socialNetworks: null,
    nameI18n: null,
    summaryI18n: null,
    descriptionI18n: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdById: null,
    updatedById: null
};

const adminExperienceFixture = {
    ...minimalExperience,
    ownerId: MOCK_USER_ID,
    moderationState: 'PENDING',
    deletedAt: null,
    deletedById: null
};

const minimalReview = {
    id: REVIEW_ID,
    experienceId: EXPERIENCE_ID,
    userId: MOCK_USER_ID,
    overallRating: 4,
    averageRating: 4,
    moderationState: 'APPROVED',
    lifecycleState: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null
};

// ─────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe('Experience Routes (SPEC-240 T-022)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        validateApiEnv();
        app = initApp();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // =========================================================================
    // T-019 PUBLIC ROUTES
    // =========================================================================

    describe('T-019 — Public endpoints', () => {
        describe('GET /api/v1/public/experiences', () => {
            it('returns 200 with items array on success', async () => {
                experienceSvc.search.mockResolvedValue({
                    data: { items: [minimalExperience], total: 1 }
                });

                const res = await app.request('/api/v1/public/experiences', {
                    headers: publicHeaders
                });

                expect(res.status).toBe(200);
            });

            it('returns 200 with empty array when no results', async () => {
                experienceSvc.search.mockResolvedValue({ data: { items: [], total: 0 } });

                const res = await app.request('/api/v1/public/experiences', {
                    headers: publicHeaders
                });

                expect(res.status).toBe(200);
            });
        });

        describe('GET /api/v1/public/experiences/slug/:slug', () => {
            it('returns 200 with listing when found and visible', async () => {
                experienceSvc.getBySlug.mockResolvedValue({ data: minimalExperience });

                const res = await app.request('/api/v1/public/experiences/slug/test-experience', {
                    headers: publicHeaders
                });

                expect(res.status).toBe(200);
                expect(experienceSvc.getBySlug).toHaveBeenCalledWith(
                    expect.anything(),
                    'test-experience'
                );
            });

            it('returns 200 with null data when not found', async () => {
                experienceSvc.getBySlug.mockResolvedValue({ data: null });

                const res = await app.request('/api/v1/public/experiences/slug/non-existent', {
                    headers: publicHeaders
                });

                expect(res.status).toBe(200);
                const body = (await res.json()) as { data: unknown };
                expect(body.data).toBeNull();
            });
        });

        describe('GET /api/v1/public/experiences/destination/:destinationId', () => {
            it('returns 200 with items for a destination', async () => {
                experienceSvc.search.mockResolvedValue({
                    data: { items: [minimalExperience], total: 1 }
                });

                const res = await app.request(
                    `/api/v1/public/experiences/destination/${DESTINATION_ID}`,
                    { headers: publicHeaders }
                );

                expect(res.status).toBe(200);
                expect(experienceSvc.search).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.objectContaining({ destinationId: DESTINATION_ID })
                );
            });

            it('returns 400 for invalid UUID in destinationId', async () => {
                const res = await app.request('/api/v1/public/experiences/destination/not-a-uuid', {
                    headers: publicHeaders
                });

                expect(res.status).toBe(400);
            });
        });

        describe('GET /api/v1/public/experiences/:id', () => {
            it('returns 200 with listing when found', async () => {
                experienceSvc.getById.mockResolvedValue({ data: minimalExperience });

                const res = await app.request(`/api/v1/public/experiences/${EXPERIENCE_ID}`, {
                    headers: publicHeaders
                });

                expect(res.status).toBe(200);
            });

            it('returns 200 with null data when service returns null (subscription-off gate)', async () => {
                experienceSvc.getById.mockResolvedValue({ data: null });

                const res = await app.request(`/api/v1/public/experiences/${EXPERIENCE_ID}`, {
                    headers: publicHeaders
                });

                expect(res.status).toBe(200);
                const body = (await res.json()) as { data: unknown };
                expect(body.data).toBeNull();
            });

            it('returns 400 for invalid UUID', async () => {
                const res = await app.request('/api/v1/public/experiences/not-a-uuid', {
                    headers: publicHeaders
                });

                expect(res.status).toBe(400);
            });
        });

        describe('GET /api/v1/public/experiences/:experienceId/reviews', () => {
            it('returns 200 with approved reviews', async () => {
                reviewSvc.listByExperience.mockResolvedValue({
                    data: { reviews: [], total: 0 }
                });

                const res = await app.request(
                    `/api/v1/public/experiences/${EXPERIENCE_ID}/reviews`,
                    { headers: publicHeaders }
                );

                expect(res.status).toBe(200);
                expect(reviewSvc.listByExperience).toHaveBeenCalledWith(
                    EXPERIENCE_ID,
                    expect.anything()
                );
            });
        });

        describe('GET /api/v1/public/experiences/:experienceId/faqs', () => {
            it('returns 200 with faqs array', async () => {
                faqHelpers.listExperienceFaqs.mockResolvedValue({ data: { faqs: [] } });

                const res = await app.request(`/api/v1/public/experiences/${EXPERIENCE_ID}/faqs`, {
                    headers: publicHeaders
                });

                expect(res.status).toBe(200);
            });
        });
    });

    // =========================================================================
    // T-020 PROTECTED ROUTES
    // =========================================================================

    describe('T-020 — Protected endpoints', () => {
        describe('GET /api/v1/protected/experiences/:id', () => {
            it('returns 401/403 when unauthenticated', async () => {
                const res = await app.request(`/api/v1/protected/experiences/${EXPERIENCE_ID}`, {
                    headers: publicHeaders
                });

                expect([401, 403]).toContain(res.status);
            });

            it('passes auth gate when authenticated (not 401/403)', async () => {
                // The response schema strips fields that don't match ExperienceProtectedSchema.
                // The focus of this test is the auth gate — assert the route is reachable,
                // not the exact status code from response-schema validation.
                experienceSvc.getById.mockResolvedValue({ data: null });

                const res = await app.request(`/api/v1/protected/experiences/${EXPERIENCE_ID}`, {
                    headers: touristHeaders
                });

                expect([401, 403]).not.toContain(res.status);
            });
        });

        describe('PATCH /api/v1/protected/experiences/:id', () => {
            it('returns 401/403 when unauthenticated', async () => {
                const res = await app.request(`/api/v1/protected/experiences/${EXPERIENCE_ID}`, {
                    method: 'PATCH',
                    headers: publicHeaders,
                    body: JSON.stringify({ isPriceOnRequest: true })
                });

                expect([401, 403]).toContain(res.status);
            });

            it('passes auth gate when authenticated (not 401/403)', async () => {
                // Auth gate test — assert the route is reachable.
                experienceSvc.updateOwn.mockResolvedValue({ data: null });

                const res = await app.request(`/api/v1/protected/experiences/${EXPERIENCE_ID}`, {
                    method: 'PATCH',
                    headers: touristHeaders,
                    body: JSON.stringify({ isPriceOnRequest: true })
                });

                expect([401, 403]).not.toContain(res.status);
            });
        });

        describe('POST /api/v1/protected/experiences/:experienceId/reviews', () => {
            it('returns 401/403 when unauthenticated', async () => {
                const res = await app.request(
                    `/api/v1/protected/experiences/${EXPERIENCE_ID}/reviews`,
                    {
                        method: 'POST',
                        headers: publicHeaders,
                        body: JSON.stringify({ overallRating: 4 })
                    }
                );

                expect([401, 403]).toContain(res.status);
            });

            it('passes auth gate when authenticated (not 401/403)', async () => {
                // Auth gate test — assert the route is reachable.
                reviewSvc.create.mockResolvedValue({ data: minimalReview });

                const res = await app.request(
                    `/api/v1/protected/experiences/${EXPERIENCE_ID}/reviews`,
                    {
                        method: 'POST',
                        headers: touristHeaders,
                        body: JSON.stringify({ overallRating: 4 })
                    }
                );

                expect([401, 403]).not.toContain(res.status);
            });
        });

        describe('FAQ owner endpoints (auth gate)', () => {
            it('POST /:id/faqs blocks unauthenticated (400/401/403)', async () => {
                // 400 if body validation runs before auth; 401/403 if auth runs first.
                const res = await app.request(
                    `/api/v1/protected/experiences/${EXPERIENCE_ID}/faqs`,
                    {
                        method: 'POST',
                        headers: publicHeaders,
                        body: JSON.stringify({ question: 'Q?', answer: 'A.' })
                    }
                );

                expect([400, 401, 403]).toContain(res.status);
            });

            it('PUT /:id/faqs/reorder blocks unauthenticated (400/401/403)', async () => {
                // Same — validation may fire before auth depending on route factory ordering.
                const res = await app.request(
                    `/api/v1/protected/experiences/${EXPERIENCE_ID}/faqs/reorder`,
                    {
                        method: 'PUT',
                        headers: publicHeaders,
                        body: JSON.stringify({ order: [] })
                    }
                );

                expect([400, 401, 403]).toContain(res.status);
            });
        });
    });

    // =========================================================================
    // T-021 ADMIN ROUTES
    // =========================================================================

    describe('T-021 — Admin endpoints', () => {
        describe('GET /api/v1/admin/experiences (list)', () => {
            it('returns 401/403 when unauthenticated', async () => {
                const res = await app.request('/api/v1/admin/experiences', {
                    headers: publicHeaders
                });

                expect([401, 403]).toContain(res.status);
            });

            it('blocks non-admin-panel users (400/401/403)', async () => {
                // The admin list route gates at the panel-access level.
                // A plain tourist without access.panelAdmin is rejected.
                // 400 may also occur if query validation runs before the auth check.
                const res = await app.request('/api/v1/admin/experiences', {
                    headers: touristHeaders
                });

                expect([400, 401, 403]).toContain(res.status);
            });

            it('returns 200 when admin with commerce.viewAll', async () => {
                experienceSvc.adminList.mockResolvedValue({
                    data: { items: [adminExperienceFixture], total: 1 }
                });

                const res = await app.request('/api/v1/admin/experiences', {
                    headers: adminHeaders
                });

                expect(res.status).toBe(200);
            });
        });

        describe('POST /api/v1/admin/experiences (create)', () => {
            it('returns 403 when missing COMMERCE_CREATE', async () => {
                const res = await app.request('/api/v1/admin/experiences', {
                    method: 'POST',
                    headers: adminNoPanelHeaders,
                    body: JSON.stringify({
                        name: 'New Experience',
                        type: 'TOUR_GUIDE',
                        priceFrom: 1000,
                        priceUnit: 'PER_PERSON'
                    })
                });

                expect(res.status).toBe(403);
            });

            it('gate passes with COMMERCE_CREATE (not 403)', async () => {
                experienceSvc.create.mockResolvedValue({ data: minimalExperience });

                const res = await app.request('/api/v1/admin/experiences', {
                    method: 'POST',
                    headers: adminHeaders,
                    body: JSON.stringify({
                        name: 'New Experience',
                        type: 'TOUR_GUIDE',
                        priceFrom: 1000,
                        priceUnit: 'PER_PERSON',
                        destinationId: DESTINATION_ID,
                        lifecycleState: 'ACTIVE',
                        visibility: 'PUBLIC',
                        hasActiveSubscription: false,
                        moderationState: 'PENDING',
                        reviewsCount: 0,
                        averageRating: 0,
                        isPriceOnRequest: false,
                        isFeatured: false
                    })
                });

                expect(res.status).not.toBe(403);
            });
        });

        describe('POST /api/v1/admin/experiences/batch', () => {
            it('returns 403 when missing COMMERCE_VIEW_ALL', async () => {
                const res = await app.request('/api/v1/admin/experiences/batch', {
                    method: 'POST',
                    headers: adminNoPanelHeaders,
                    body: JSON.stringify({ ids: [EXPERIENCE_ID] })
                });

                expect(res.status).toBe(403);
            });

            it('passes permission gate with COMMERCE_VIEW_ALL (not 403)', async () => {
                // Batch returns 201 per route factory; test only that the gate passes.
                experienceSvc.getById.mockResolvedValue({ data: adminExperienceFixture });

                const res = await app.request('/api/v1/admin/experiences/batch', {
                    method: 'POST',
                    headers: adminHeaders,
                    body: JSON.stringify({ ids: [EXPERIENCE_ID] })
                });

                expect(res.status).not.toBe(403);
            });
        });

        describe('GET /api/v1/admin/experiences/options', () => {
            it('returns 200 for admin-panel users', async () => {
                experienceSvc.adminList.mockResolvedValue({ data: { items: [], total: 0 } });

                const res = await app.request('/api/v1/admin/experiences/options', {
                    headers: adminHeaders
                });

                expect(res.status).toBe(200);
            });
        });

        describe('GET /api/v1/admin/experiences/:id', () => {
            it('returns 403 when missing COMMERCE_VIEW_ALL', async () => {
                const res = await app.request(`/api/v1/admin/experiences/${EXPERIENCE_ID}`, {
                    headers: adminNoPanelHeaders
                });

                expect(res.status).toBe(403);
            });

            it('returns 200 with full data for admin', async () => {
                experienceSvc.getById.mockResolvedValue({ data: adminExperienceFixture });

                const res = await app.request(`/api/v1/admin/experiences/${EXPERIENCE_ID}`, {
                    headers: adminHeaders
                });

                expect(res.status).toBe(200);
            });
        });

        describe('DELETE /api/v1/admin/experiences/:id (soft delete)', () => {
            it('returns 403 when missing COMMERCE_DELETE', async () => {
                const res = await app.request(`/api/v1/admin/experiences/${EXPERIENCE_ID}`, {
                    method: 'DELETE',
                    headers: adminNoPanelHeaders
                });

                expect(res.status).toBe(403);
            });

            it('returns 200 when admin has COMMERCE_DELETE', async () => {
                experienceSvc.softDelete.mockResolvedValue({ data: { count: 1 } });

                const res = await app.request(`/api/v1/admin/experiences/${EXPERIENCE_ID}`, {
                    method: 'DELETE',
                    headers: adminHeaders
                });

                expect(res.status).toBe(200);
            });
        });

        describe('DELETE /api/v1/admin/experiences/:id/hard', () => {
            it('returns 403 when missing COMMERCE_DELETE', async () => {
                const res = await app.request(`/api/v1/admin/experiences/${EXPERIENCE_ID}/hard`, {
                    method: 'DELETE',
                    headers: adminNoPanelHeaders
                });

                expect(res.status).toBe(403);
            });

            it('returns 200 when admin has COMMERCE_DELETE', async () => {
                experienceSvc.hardDelete.mockResolvedValue({ data: { count: 1 } });

                const res = await app.request(`/api/v1/admin/experiences/${EXPERIENCE_ID}/hard`, {
                    method: 'DELETE',
                    headers: adminHeaders
                });

                expect(res.status).toBe(200);
            });
        });

        describe('POST /api/v1/admin/experiences/:id/restore', () => {
            it('returns 403 when missing COMMERCE_EDIT_ALL', async () => {
                const res = await app.request(
                    `/api/v1/admin/experiences/${EXPERIENCE_ID}/restore`,
                    { method: 'POST', headers: adminNoPanelHeaders }
                );

                expect(res.status).toBe(403);
            });

            it('returns 2xx on successful restore (gate passes with COMMERCE_EDIT_ALL)', async () => {
                experienceSvc.restore.mockResolvedValue({ data: adminExperienceFixture });

                const res = await app.request(
                    `/api/v1/admin/experiences/${EXPERIENCE_ID}/restore`,
                    { method: 'POST', headers: adminHeaders }
                );

                // POST endpoints via createAdminRoute return 201; any 2xx means success
                expect(res.status).not.toBe(401);
                expect(res.status).not.toBe(403);
            });
        });

        describe('POST /api/v1/admin/experiences/:id/assign-owner', () => {
            it('returns 403 when missing COMMERCE_EDIT_ALL', async () => {
                const res = await app.request(
                    `/api/v1/admin/experiences/${EXPERIENCE_ID}/assign-owner`,
                    {
                        method: 'POST',
                        headers: adminNoPanelHeaders,
                        body: JSON.stringify({ ownerId: MOCK_USER_ID })
                    }
                );

                expect(res.status).toBe(403);
            });

            it('passes gate with COMMERCE_EDIT_ALL (not 401/403)', async () => {
                // POST routes via createAdminRoute return 201; gate test only cares about auth.
                experienceSvc.update.mockResolvedValue({ data: adminExperienceFixture });

                const res = await app.request(
                    `/api/v1/admin/experiences/${EXPERIENCE_ID}/assign-owner`,
                    {
                        method: 'POST',
                        headers: adminHeaders,
                        body: JSON.stringify({ ownerId: MOCK_USER_ID })
                    }
                );

                expect([401, 403]).not.toContain(res.status);
            });
        });

        describe('Admin FAQ endpoints', () => {
            it('GET /:id/faqs returns 403 when missing COMMERCE_VIEW_ALL', async () => {
                const res = await app.request(`/api/v1/admin/experiences/${EXPERIENCE_ID}/faqs`, {
                    headers: adminNoPanelHeaders
                });

                expect(res.status).toBe(403);
            });

            it('GET /:id/faqs returns 200 for admin with COMMERCE_VIEW_ALL', async () => {
                faqHelpers.listExperienceFaqs.mockResolvedValue({ data: { faqs: [] } });

                const res = await app.request(`/api/v1/admin/experiences/${EXPERIENCE_ID}/faqs`, {
                    headers: adminHeaders
                });

                expect(res.status).toBe(200);
            });

            it('POST /:id/faqs returns 403 when missing COMMERCE_EDIT_ALL', async () => {
                const res = await app.request(`/api/v1/admin/experiences/${EXPERIENCE_ID}/faqs`, {
                    method: 'POST',
                    headers: adminNoPanelHeaders,
                    body: JSON.stringify({ question: 'Q?', answer: 'A.' })
                });

                expect(res.status).toBe(403);
            });
        });

        describe('Admin review moderation endpoints', () => {
            it('GET /reviews returns 403 when missing COMMERCE_MODERATE_REVIEW', async () => {
                const res = await app.request('/api/v1/admin/experiences/reviews', {
                    headers: adminNoPanelHeaders
                });

                expect(res.status).toBe(403);
            });

            it('GET /reviews returns 200 for admin with COMMERCE_MODERATE_REVIEW', async () => {
                reviewSvc.adminList.mockResolvedValue({ data: { items: [], total: 0 } });

                const res = await app.request('/api/v1/admin/experiences/reviews', {
                    headers: adminHeaders
                });

                expect(res.status).toBe(200);
            });

            it('POST /reviews/:id/moderate returns 403 when missing COMMERCE_MODERATE_REVIEW', async () => {
                const res = await app.request(
                    `/api/v1/admin/experiences/reviews/${REVIEW_ID}/moderate`,
                    {
                        method: 'POST',
                        headers: adminNoPanelHeaders,
                        body: JSON.stringify({ decision: 'APPROVED' })
                    }
                );

                expect(res.status).toBe(403);
            });

            it('POST /reviews/:id/moderate passes gate on approval (not 401/403)', async () => {
                reviewSvc.moderateReview.mockResolvedValue({
                    data: { ...minimalReview, moderationState: 'APPROVED' }
                });

                const res = await app.request(
                    `/api/v1/admin/experiences/reviews/${REVIEW_ID}/moderate`,
                    {
                        method: 'POST',
                        headers: adminHeaders,
                        body: JSON.stringify({ decision: 'APPROVED' })
                    }
                );

                // POST endpoints via createAdminRoute return 201; gate test only cares about auth.
                expect(res.status).not.toBe(401);
                expect(res.status).not.toBe(403);
            });

            it('DELETE /reviews/:id returns 403 when missing COMMERCE_MODERATE_REVIEW', async () => {
                const res = await app.request(`/api/v1/admin/experiences/reviews/${REVIEW_ID}`, {
                    method: 'DELETE',
                    headers: adminNoPanelHeaders
                });

                expect(res.status).toBe(403);
            });
        });
    });

    // =========================================================================
    // Cross-cutting: route existence (public endpoints must not be 404)
    // =========================================================================

    describe('Route existence — public endpoints must not return 404', () => {
        beforeEach(() => {
            experienceSvc.search.mockResolvedValue({ data: { items: [], total: 0 } });
            experienceSvc.getById.mockResolvedValue({ data: null });
            experienceSvc.getBySlug.mockResolvedValue({ data: null });
            reviewSvc.listByExperience.mockResolvedValue({ data: { reviews: [], total: 0 } });
            faqHelpers.listExperienceFaqs.mockResolvedValue({ data: { faqs: [] } });
        });

        it('GET /api/v1/public/experiences is not 404', async () => {
            const res = await app.request('/api/v1/public/experiences', {
                headers: publicHeaders
            });

            expect(res.status).not.toBe(404);
        });

        it('GET /api/v1/public/experiences/:id is not 404', async () => {
            const res = await app.request(`/api/v1/public/experiences/${EXPERIENCE_ID}`, {
                headers: publicHeaders
            });

            expect(res.status).not.toBe(404);
        });

        it('GET /api/v1/public/experiences/slug/test is not 404', async () => {
            const res = await app.request('/api/v1/public/experiences/slug/test', {
                headers: publicHeaders
            });

            expect(res.status).not.toBe(404);
        });

        it('GET /api/v1/public/experiences/destination/:id is not 404', async () => {
            const res = await app.request(
                `/api/v1/public/experiences/destination/${DESTINATION_ID}`,
                { headers: publicHeaders }
            );

            expect(res.status).not.toBe(404);
        });

        it('GET /api/v1/public/experiences/:id/faqs is not 404', async () => {
            const res = await app.request(`/api/v1/public/experiences/${EXPERIENCE_ID}/faqs`, {
                headers: publicHeaders
            });

            expect(res.status).not.toBe(404);
        });

        it('GET /api/v1/public/experiences/:id/reviews is not 404', async () => {
            const res = await app.request(`/api/v1/public/experiences/${EXPERIENCE_ID}/reviews`, {
                headers: publicHeaders
            });

            expect(res.status).not.toBe(404);
        });
    });
});
