/**
 * Integration tests: write-path permission boundaries for review admin routes.
 *
 * SPEC-063-gaps T-029 (GAP-044): verifies that the route-layer permission
 * declarations on PUT /admin/{accommodations,destinations}/reviews/:id reject
 * actors that lack the required permissions BEFORE the request reaches the
 * service. This complements the read-path boundary tests (T-028) and locks in
 * the alignment performed by T-026 (routes now require both _UPDATE AND
 * _MODERATE).
 *
 * Coverage per entity:
 *  1. Actor with *_REVIEW_UPDATE but NOT *_REVIEW_MODERATE → 403 at route layer.
 *  2. Anonymous actor (no auth headers) → 401/403 uniformly.
 *
 * The third case from the spec ("author user calling protected update with
 * lifecycleState in body") is covered at the schema layer via T-017 (`.strict()`
 * rejects unknown keys) plus T-018 PATCH integration tests.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Mock } from 'vitest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const accomMockRef: { update: Mock } = {
    update: vi.fn()
};
const destMockRef: { update: Mock } = {
    update: vi.fn()
};

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AccommodationReviewService: vi.fn().mockImplementation(function () {
            return {
                update: (...args: unknown[]) => accomMockRef.update(...args)
            };
        }),
        DestinationReviewService: vi.fn().mockImplementation(function () {
            return {
                update: (...args: unknown[]) => destMockRef.update(...args)
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

function makeHeaders(
    actor: { id: string; roles: readonly string[]; permissions: string[] },
    extra: Record<string, string> = {}
): Record<string, string> {
    return {
        'content-type': 'application/json',
        'user-agent': 'vitest',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': actor.roles.join(','),
        'x-mock-actor-permissions': JSON.stringify(actor.permissions),
        ...extra
    };
}

type Case = {
    label: string;
    path: string;
    updatePerm: PermissionEnum;
    moderatePerm: PermissionEnum;
    viewPerm: PermissionEnum;
    serviceMock: { update: Mock };
};

const cases: ReadonlyArray<Case> = [
    {
        label: 'AccommodationReview',
        path: '/api/v1/admin/accommodations/reviews',
        updatePerm: PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
        moderatePerm: PermissionEnum.ACCOMMODATION_REVIEW_MODERATE,
        viewPerm: PermissionEnum.ACCOMMODATION_REVIEW_VIEW,
        serviceMock: accomMockRef
    },
    {
        label: 'DestinationReview',
        path: '/api/v1/admin/destinations/reviews',
        updatePerm: PermissionEnum.DESTINATION_REVIEW_UPDATE,
        moderatePerm: PermissionEnum.DESTINATION_REVIEW_MODERATE,
        viewPerm: PermissionEnum.DESTINATION_REVIEW_VIEW,
        serviceMock: destMockRef
    }
];

describe('T-029: review admin update — write-path permission boundaries', () => {
    let app: ReturnType<typeof initApp>;
    const reviewId = '00000000-0000-4000-8000-000000000001';

    beforeAll(() => {
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(() => {
        accomMockRef.update = vi.fn().mockResolvedValue({ data: { id: reviewId } });
        destMockRef.update = vi.fn().mockResolvedValue({ data: { id: reviewId } });
    });

    describe.each(cases)('$label', ({ path, updatePerm, moderatePerm, viewPerm, serviceMock }) => {
        it('returns 403 when actor has *_REVIEW_UPDATE but lacks *_REVIEW_MODERATE (T-026 alignment)', async () => {
            const actor = {
                id: crypto.randomUUID(),
                roles: [RoleEnum.ADMIN],
                permissions: [
                    PermissionEnum.ACCESS_API_PUBLIC,
                    // Admin tier base gate (authorization.ts): without these two the
                    // 403 would come from the tier, not from the *_MODERATE check.
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    // GET /:id sibling gate leaks onto PUT (HOS-1908): VIEW is held so the
                    // 403 below can only come from the missing *_REVIEW_MODERATE.
                    viewPerm,
                    updatePerm
                    // intentionally omitting `moderatePerm`
                ]
            };

            const res = await app.request(`${path}/${reviewId}`, {
                method: 'PUT',
                headers: makeHeaders(actor),
                body: JSON.stringify({ title: 'updated' })
            });

            expect(res.status).toBe(403);
            // Route-layer rejection means the service must NOT have been called
            expect(serviceMock.update).not.toHaveBeenCalled();
        });

        it('returns 200/2xx when actor has BOTH *_REVIEW_UPDATE and *_REVIEW_MODERATE', async () => {
            const actor = {
                id: crypto.randomUUID(),
                roles: [RoleEnum.ADMIN],
                permissions: [
                    PermissionEnum.ACCESS_API_PUBLIC,
                    // Admin tier base gate (authorization.ts): without these two the
                    // 403 would come from the tier, not from the *_MODERATE check.
                    PermissionEnum.ACCESS_API_ADMIN,
                    PermissionEnum.ACCESS_PANEL_ADMIN,
                    viewPerm,
                    updatePerm,
                    moderatePerm
                ]
            };

            const res = await app.request(`${path}/${reviewId}`, {
                method: 'PUT',
                headers: makeHeaders(actor),
                body: JSON.stringify({ title: 'updated' })
            });

            // We don't assert exact status — schema/service may still 4xx for body issues —
            // we only need to confirm the auth gate let the request through.
            expect(res.status).not.toBe(403);
            expect(res.status).not.toBe(401);
        });

        // HOS-1908: the GET /:id gate (*_REVIEW_VIEW) leaks onto PUT, so the
        // route's own UPDATE+MODERATE pair is not enough on its own.
        const updateWithoutView = async (headers: Record<string, string>, path: string) =>
            app.request(`${path}/${reviewId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ title: 'updated' })
            });
        const actorWithoutView = (updatePerm: PermissionEnum, moderatePerm: PermissionEnum) => ({
            id: crypto.randomUUID(),
            roles: [RoleEnum.ADMIN],
            permissions: [
                PermissionEnum.ACCESS_API_PUBLIC,
                PermissionEnum.ACCESS_API_ADMIN,
                PermissionEnum.ACCESS_PANEL_ADMIN,
                updatePerm,
                moderatePerm
            ]
        });

        it('currently answers 403 to UPDATE+MODERATE without VIEW (HOS-1908)', async () => {
            const res = await updateWithoutView(
                makeHeaders(actorWithoutView(updatePerm, moderatePerm)),
                path
            );

            expect(res.status).toBe(403);
        });

        // Drop `.fails` (and the test above) once HOS-1908 is fixed.
        it.fails('lets UPDATE+MODERATE through without VIEW (HOS-1908)', async () => {
            const res = await updateWithoutView(
                makeHeaders(actorWithoutView(updatePerm, moderatePerm)),
                path
            );

            expect(res.status).not.toBe(403);
        });

        it('returns 401/403 when no auth headers are provided (anonymous)', async () => {
            const res = await app.request(`${path}/${reviewId}`, {
                method: 'PUT',
                // user-agent is required by the global validation middleware (400 otherwise,
                // before the auth gate runs).
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify({ title: 'updated' })
            });

            expect([401, 403]).toContain(res.status);
            expect(serviceMock.update).not.toHaveBeenCalled();
        });
    });
});
