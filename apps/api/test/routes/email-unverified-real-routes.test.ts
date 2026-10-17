/** TEST:V5:3 real-router coverage for the closed step-2 list. */
import { PermissionEnum, RoleEnum, ServiceErrorCode, UserSchema } from '@repo/schemas';
import {
    AccommodationService,
    ExperienceService,
    GastronomyService,
    UserService
} from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { protectedAccommodationRoutes } from '../../src/routes/accommodation/protected/index';
import { protectedBillingSubscriptionRoutes } from '../../src/routes/billing-subscription/index';
import { protectedExperienceRoutes } from '../../src/routes/experience/protected/index';
import { protectedGastronomyRoutes } from '../../src/routes/gastronomy/protected/index';
import { protectedUserRoutes } from '../../src/routes/user/protected/index';
import type { AppBindings } from '../../src/types';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const app = (options: {
    readonly emailVerified: boolean;
    readonly permissions?: PermissionEnum[];
}) => {
    const { emailVerified, permissions = [] } = options;
    const result = new Hono<AppBindings>();
    result.onError((error, c) => {
        if (error instanceof HTTPException)
            return c.json(
                {
                    error: {
                        code: error.status === 403 ? ServiceErrorCode.FORBIDDEN : 'HTTP_ERROR'
                    }
                },
                error.status
            );
        return c.json({ error: { code: 'INTERNAL_ERROR' } }, 500);
    });
    result.use('*', (c, next) => {
        c.set('actor', { id: OWNER_ID, roles: [RoleEnum.USER], permissions, emailVerified });
        return next();
    });
    result.route('/api/v1/protected/accommodations', protectedAccommodationRoutes);
    result.route('/api/v1/protected/gastronomies', protectedGastronomyRoutes);
    result.route('/api/v1/protected/experiences', protectedExperienceRoutes);
    result.route('/api/v1/protected/users', protectedUserRoutes);
    result.route('/api/v1/protected/billing/subscriptions', protectedBillingSubscriptionRoutes);
    return result;
};
async function probe(options: { readonly target: Hono<AppBindings>; readonly path: string }) {
    const { target, path } = options;
    const response = await target.request(path, {
        method:
            path.includes('/reactivate') ||
            path.includes('/purge') ||
            path.endsWith('/publish') ||
            path.includes('/subscriptions')
                ? 'POST'
                : 'GET'
    });
    const body = (await response.json().catch(() => ({}))) as { error?: { code?: string } };
    return { status: response.status, error: { code: body.error?.code } };
}

describe('TEST:V5:3 TEST:1692:1 the closed list passes step 2 on the real routers', () => {
    afterEach(() => vi.restoreAllMocks());
    it('allows Mi Cuenta and the three own-list routes', async () => {
        const profile = UserSchema.parse({
            id: OWNER_ID,
            slug: 'owner',
            firstName: 'Owner',
            email: 'owner@example.test',
            createdAt: new Date(),
            updatedAt: new Date(),
            createdById: null,
            updatedById: null
        });
        const userSpy = vi
            .spyOn(UserService.prototype, 'getById')
            .mockResolvedValue({ data: profile });
        const gastronomySpy = vi
            .spyOn(GastronomyService.prototype, 'listOwn')
            .mockResolvedValue({ data: { listings: [] } } as never);
        const experienceSpy = vi
            .spyOn(ExperienceService.prototype, 'listOwn')
            .mockResolvedValue({ data: { listings: [] } } as never);
        const accommodationSpy = vi
            .spyOn(AccommodationService.prototype, 'list')
            .mockResolvedValue({ data: { items: [], total: 0 } } as never);
        for (const [path, spy] of [
            [`/api/v1/protected/users/${OWNER_ID}`, userSpy],
            ['/api/v1/protected/gastronomies/mine', gastronomySpy],
            ['/api/v1/protected/experiences/mine', experienceSpy],
            ['/api/v1/protected/accommodations', accommodationSpy]
        ] as const) {
            expect((await probe({ target: app({ emailVerified: false }), path })).status).toBe(200);
            expect(spy).toHaveBeenCalled();
        }
    });
    const covered = [
        ...(['accommodations', 'gastronomies', 'experiences'] as const).map((v) => ({
            op: 'REACTIVATE_LISTING',
            path: `/api/v1/protected/${v}/${LISTING_ID}/reactivate`
        })),
        ...(['accommodations', 'gastronomies', 'experiences'] as const).map((v) => ({
            op: 'DELETE_LISTING',
            path: `/api/v1/protected/${v}/${LISTING_ID}/purge`
        })),
        ...(['accommodations', 'gastronomies', 'experiences'] as const).flatMap((v) => [
            { op: 'READ_OWN', path: `/api/v1/protected/${v}/${LISTING_ID}/purge-preview` },
            { op: 'READ_OWN', path: `/api/v1/protected/${v}/${LISTING_ID}/support-edits` }
        ])
    ];
    it.each(covered)('$op passes step 2 on $path', async ({ path }) => {
        const unverified = await probe({ target: app({ emailVerified: false }), path });
        const verified = await probe({ target: app({ emailVerified: true }), path });
        expect(unverified).toEqual(verified);
        expect(unverified.error.code).not.toBe(ServiceErrorCode.EMAIL_NOT_VERIFIED);
    });
});

describe('TEST:V5:3 TEST:1692:2 outside the closed list step 2 answers the same with and without permission', () => {
    it.each([
        '/api/v1/protected/accommodations/22222222-2222-4222-8222-222222222222/publish',
        '/api/v1/protected/billing/subscriptions'
    ])('%s refuses before permissions', async (path) => {
        const without = await probe({ target: app({ emailVerified: false }), path });
        const withAll = await probe({
            target: app({ emailVerified: false, permissions: Object.values(PermissionEnum) }),
            path
        });
        expect(without).toEqual(withAll);
        expect(without.status).toBe(403);
        expect(without.error.code).toBe(ServiceErrorCode.EMAIL_NOT_VERIFIED);
    });
    it('keeps the verified publish request beyond step 2', async () => {
        expect(
            (
                await probe({
                    target: app({ emailVerified: true }),
                    path: '/api/v1/protected/accommodations/22222222-2222-4222-8222-222222222222/publish'
                })
            ).error.code
        ).not.toBe(ServiceErrorCode.EMAIL_NOT_VERIFIED);
    });
});
