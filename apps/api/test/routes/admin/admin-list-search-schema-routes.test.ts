/**
 * Route tests for the admin list endpoints that were missing `adminSearchSchema`
 * (HOS-1985). Before the fix each of them answered 500 `CONFIGURATION_ERROR`
 * ("adminSearchSchema is not configured for <entity>").
 *
 * Same harness as `admin-list-routes.test.ts` (real app, authenticated admin
 * actor). The real services run; only the model's row fetch is stubbed so no
 * database is needed, and the stub records the pagination it was given.
 *
 * @module test/routes/admin/admin-list-search-schema-routes
 */

import {
    ContentModerationTermModel,
    ContentModerationThresholdModel,
    experienceReviewModel
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app';
import { createAuthenticatedRequest } from '../../helpers/auth';

type ModelStub = InstanceType<typeof ContentModerationTermModel>;

interface RouteEntry {
    readonly entity: string;
    readonly path: string;
    readonly permission: PermissionEnum;
    readonly modelPrototype: object;
}

const ROUTES: readonly RouteEntry[] = [
    {
        entity: 'ContentModerationTerm',
        path: '/api/v1/admin/content-moderation/terms',
        permission: PermissionEnum.MODERATION_TERM_VIEW,
        modelPrototype: ContentModerationTermModel.prototype
    },
    {
        entity: 'ContentModerationThreshold',
        path: '/api/v1/admin/content-moderation/thresholds',
        permission: PermissionEnum.MODERATION_THRESHOLD_VIEW,
        modelPrototype: ContentModerationThresholdModel.prototype
    },
    {
        entity: 'ExperienceReview',
        path: '/api/v1/admin/experiences/reviews',
        permission: PermissionEnum.EXPERIENCE_MODERATE_REVIEW,
        modelPrototype: experienceReviewModel
    }
] as const;

function adminActor(permission: PermissionEnum): Actor {
    return {
        id: crypto.randomUUID(),
        roles: [RoleEnum.ADMIN],
        permissions: [
            PermissionEnum.ACCESS_PANEL_ADMIN,
            PermissionEnum.ACCESS_API_ADMIN,
            permission
        ]
    };
}

describe('admin list routes configure adminSearchSchema (HOS-1985)', () => {
    let app: ReturnType<typeof initApp>;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    for (const route of ROUTES) {
        describe(route.entity, () => {
            /** Stubs both list entry points the base `adminList` may use and returns the spies. */
            function stubModel() {
                const result = { items: [], total: 42 };
                return [
                    vi
                        .spyOn(route.modelPrototype as ModelStub, 'findAll')
                        .mockResolvedValue(result),
                    vi
                        .spyOn(route.modelPrototype as ModelStub, 'findAllWithRelations')
                        .mockResolvedValue(result)
                ] as const;
            }

            const request = (query = ''): Promise<Response> =>
                Promise.resolve(
                    app.request(
                        query ? `${route.path}?${query}` : route.path,
                        createAuthenticatedRequest(adminActor(route.permission))
                    )
                );

            it('answers 200 with the paginated envelope, not 500 CONFIGURATION_ERROR', async () => {
                stubModel();

                const res = await request();
                const body = await res.json();

                expect(res.status, JSON.stringify(body)).toBe(200);
                expect(body.success).toBe(true);
                expect(Array.isArray(body.data.items)).toBe(true);
                expect(body.data.pagination).toMatchObject({ page: 1, total: 42 });
            });

            it('honours page and pageSize all the way to the model', async () => {
                const spies = stubModel();

                const res = await request('page=2&pageSize=5');
                const body = await res.json();

                expect(res.status, JSON.stringify(body)).toBe(200);
                expect(body.data.pagination).toMatchObject({ page: 2, pageSize: 5, total: 42 });
                const forwarded = spies.flatMap((spy) =>
                    spy.mock.calls.map((call) => (call as unknown[])[call.length > 4 ? 2 : 1])
                );
                expect(forwarded).toContainEqual(expect.objectContaining({ page: 2, pageSize: 5 }));
            });
        });
    }
    describe('ExperienceReview moderation panel (usePendingReviewsQuery)', () => {
        const panel = ROUTES.find((r) => r.entity === 'ExperienceReview') as RouteEntry;

        it('accepts the panel query status=PENDING and filters by moderationState', async () => {
            const result = { items: [], total: 3 };
            const withRelations = vi
                .spyOn(panel.modelPrototype as ModelStub, 'findAllWithRelations')
                .mockResolvedValue(result);
            const plain = vi
                .spyOn(panel.modelPrototype as ModelStub, 'findAll')
                .mockResolvedValue(result);

            // Exactly what createListingEntityHooks.usePendingReviewsQuery sends.
            const res = await app.request(
                `${panel.path}?status=PENDING&page=1&pageSize=20`,
                createAuthenticatedRequest(adminActor(panel.permission))
            );
            const body = await res.json();

            expect(res.status, JSON.stringify(body)).toBe(200);
            expect(body.data.pagination).toMatchObject({ page: 1, pageSize: 20, total: 3 });
            const wheres = [...withRelations.mock.calls, ...plain.mock.calls].map((call) =>
                JSON.stringify(call[call.length > 4 ? 1 : 0])
            );
            expect(wheres.some((w) => w.includes('"moderationState":"PENDING"'))).toBe(true);
        });

        it('still rejects a status that is not a moderation state', async () => {
            const res = await app.request(
                `${panel.path}?status=NOPE`,
                createAuthenticatedRequest(adminActor(panel.permission))
            );
            expect(res.status).toBe(400);
        });
    });
});
