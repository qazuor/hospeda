// The mock-actor headers are only honoured when CI is unset (integration-test convention).
delete process.env.CI;

/**
 * E2E Integration Tests for Sponsorship Purchase and Analytics Tracking
 *
 * Runs against the real services and the integration database. The levels and
 * sponsorships are seeded rows and every actor is backed by a real user row, so
 * the purchase rules (level exists, level matches the target) and the analytics
 * counters are read from data the test put there.
 *
 * The flow used to target `/api/v1/sponsorships` (the routes live under
 * `/api/v1/protected/sponsorships`) and to accept any of several statuses per
 * case. The billing checkout and the public level/package catalog it also
 * touched no longer exist as routes: they are pinned as 404 below.
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { clearCache } from '../../src/middlewares/cache';
import { validateApiEnv } from '../../src/utils/env';
import { testDb } from '../e2e/setup/test-database';
import { buildMockActorHeaders, createMockActorUser } from './helpers/mock-actor';
import {
    type SeededSponsorship,
    type SeededSponsorshipLevel,
    seedSponsorship,
    seedSponsorshipLevel
} from './helpers/seed-sponsorship';

const BASE = '/api/v1/protected/sponsorships';
const NON_EXISTENT_ID = '99999999-9999-4999-8999-999999999999';
const DAY_MS = 24 * 60 * 60 * 1000;

const SPONSOR_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.ACCESS_API_PUBLIC,
    PermissionEnum.ACCESS_API_PRIVATE,
    PermissionEnum.SPONSORSHIP_VIEW,
    PermissionEnum.SPONSORSHIP_CREATE,
    PermissionEnum.SPONSORSHIP_UPDATE,
    PermissionEnum.SPONSORSHIP_VIEW_OWN,
    PermissionEnum.SPONSORSHIP_UPDATE_OWN
];

/** What an admin needs on top: the service-level "any" grants. */
const ADMIN_SPONSORSHIP_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.ACCESS_API_PUBLIC,
    PermissionEnum.ACCESS_API_PRIVATE,
    PermissionEnum.SPONSORSHIP_VIEW,
    PermissionEnum.SPONSORSHIP_VIEW_ANY
];

describe('Sponsorship Purchase and Analytics E2E Flow', () => {
    let app: ReturnType<typeof initApp>;
    let sponsorId: string;
    let otherSponsorId: string;
    let eventLevel: SeededSponsorshipLevel;
    let postLevel: SeededSponsorshipLevel;
    let own: SeededSponsorship;

    const headersFor = ({
        actorId,
        permissions,
        role = RoleEnum.SPONSOR
    }: {
        readonly actorId: string;
        readonly permissions: readonly PermissionEnum[];
        readonly role?: RoleEnum;
    }) => buildMockActorHeaders({ actorId, permissions, role });

    const sponsorHeaders = () =>
        headersFor({ actorId: sponsorId, permissions: SPONSOR_PERMISSIONS });

    /** A valid purchase body for the given level, overridable per case. */
    const purchase = ({
        level,
        overrides = {}
    }: {
        readonly level: SeededSponsorshipLevel;
        readonly overrides?: Record<string, unknown>;
    }) => ({
        sponsorUserId: sponsorId,
        targetType: level.targetType,
        targetId: crypto.randomUUID(),
        levelId: level.id,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
        logoUrl: 'https://example.com/logo.png',
        linkUrl: 'https://example.com',
        ...overrides
    });

    const post = ({ body }: { readonly body: unknown }) =>
        app.request(BASE, {
            method: 'POST',
            headers: sponsorHeaders(),
            body: JSON.stringify(body)
        });

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        sponsorId = (await createMockActorUser({ label: 'purchase-sponsor' })).id;
        otherSponsorId = (await createMockActorUser({ label: 'purchase-other' })).id;
        eventLevel = await seedSponsorshipLevel({ targetType: 'event', tier: 'gold' });
        postLevel = await seedSponsorshipLevel({ targetType: 'post', tier: 'standard' });
        own = await seedSponsorship({
            sponsorUserId: sponsorId,
            levelId: eventLevel.id,
            analytics: { impressions: 200, clicks: 10, couponsUsed: 3 }
        });
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    describe('1. Sponsorship Purchase Flow - Different Levels', () => {
        it('should allow sponsor to purchase a Gold event sponsorship with a coupon', async () => {
            const body = purchase({
                level: eventLevel,
                overrides: { couponCode: 'GOLD20', couponDiscountPercent: 20 }
            });

            const res = await post({ body });

            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data).toMatchObject({
                sponsorUserId: sponsorId,
                levelId: eventLevel.id,
                targetType: 'event',
                targetId: body.targetId,
                couponCode: 'GOLD20',
                couponDiscountPercent: 20
            });
        });

        it('should allow sponsor to purchase a Standard post sponsorship', async () => {
            const body = purchase({ level: postLevel });

            const res = await post({ body });

            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.data).toMatchObject({
                levelId: postLevel.id,
                targetType: 'post',
                targetId: body.targetId
            });
        });

        it('should validate required fields for sponsorship creation', async () => {
            const res = await post({ body: { targetType: 'event' } });

            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject sponsorship with invalid target type', async () => {
            const res = await post({
                body: purchase({ level: eventLevel, overrides: { targetType: 'invalid-type' } })
            });

            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject sponsorship with invalid UUID for targetId', async () => {
            const res = await post({
                body: purchase({ level: eventLevel, overrides: { targetId: 'not-a-uuid' } })
            });

            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('2. Sponsorship Dashboard and Listing', () => {
        it('should show the purchased sponsorship in the sponsor dashboard list', async () => {
            const bought = await post({ body: purchase({ level: postLevel }) });
            expect(bought.status).toBe(201);
            const boughtId = (await bought.json()).data.id;

            const res = await app.request(BASE, { headers: sponsorHeaders() });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data.items.map((item: { id: string }) => item.id)).toEqual(
                expect.arrayContaining([own.id, boughtId])
            );
        });

        it('should support pagination for the sponsorships list', async () => {
            const res = await app.request(`${BASE}?page=1&pageSize=5`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data.pagination).toMatchObject({ page: 1, pageSize: 5, total: 1 });
        });

        it('should filter sponsorships by target type', async () => {
            await seedSponsorship({
                sponsorUserId: sponsorId,
                levelId: postLevel.id,
                targetType: 'post'
            });

            const res = await app.request(`${BASE}?targetType=post`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(
                data.data.items.every((item: { targetType: string }) => item.targetType === 'post')
            ).toBe(true);
            expect(data.data.items).toHaveLength(1);
        });

        it('should retrieve a specific sponsorship by ID', async () => {
            const res = await app.request(`${BASE}/${own.id}`, { headers: sponsorHeaders() });

            expect(res.status).toBe(200);
            expect((await res.json()).data).toMatchObject({ id: own.id, levelId: eventLevel.id });
        });

        it('should return 404 for a non-existent sponsorship', async () => {
            const res = await app.request(`${BASE}/${NON_EXISTENT_ID}`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(404);
        });
    });

    describe('3. Analytics Tracking - Impressions and Clicks', () => {
        it('should retrieve the analytics counters of a sponsorship', async () => {
            const res = await app.request(`${BASE}/${own.id}/analytics`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual({ impressions: 200, clicks: 10, couponsUsed: 3 });
        });

        it('should derive a CTR between 0 and 100 from the analytics data', async () => {
            const res = await app.request(`${BASE}/${own.id}/analytics`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
            const { impressions, clicks } = (await res.json()).data;
            expect((clicks / impressions) * 100).toBe(5);
        });

        it('should return zeroed analytics for a freshly purchased sponsorship', async () => {
            const bought = await post({ body: purchase({ level: postLevel }) });
            expect(bought.status).toBe(201);
            const boughtId = (await bought.json()).data.id;

            const res = await app.request(`${BASE}/${boughtId}/analytics`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
            expect((await res.json()).data).toEqual({ impressions: 0, clicks: 0, couponsUsed: 0 });
        });
    });

    describe('4. Access Control - Analytics Viewing', () => {
        // HOS-TODO-sponsorship-foreign-403: checkCanView throws FORBIDDEN for a row owned by someone else, so the route answers 403 and confirms the id exists (error-contract.md wants 404).
        it.fails("should answer 404 to another sponsor's analytics request", async () => {
            const res = await app.request(`${BASE}/${own.id}/analytics`, {
                headers: headersFor({
                    actorId: otherSponsorId,
                    permissions: SPONSOR_PERMISSIONS
                })
            });

            expect(res.status).toBe(404);
        });

        it("currently answers 403 to another sponsor's analytics request (HOS-TODO-sponsorship-foreign-403)", async () => {
            const res = await app.request(`${BASE}/${own.id}/analytics`, {
                headers: headersFor({
                    actorId: otherSponsorId,
                    permissions: SPONSOR_PERMISSIONS
                })
            });

            expect(res.status).toBe(403);
        });

        it('should answer 403 to a user without sponsorship permissions', async () => {
            const touristId = (await createMockActorUser({ label: 'purchase-tourist' })).id;

            const res = await app.request(`${BASE}/${own.id}/analytics`, {
                headers: headersFor({
                    actorId: touristId,
                    role: RoleEnum.USER,
                    permissions: [
                        PermissionEnum.ACCESS_API_PUBLIC,
                        PermissionEnum.USER_VIEW_PROFILE
                    ]
                })
            });

            expect(res.status).toBe(403);
        });

        it('should allow an actor holding SPONSORSHIP_VIEW_ANY to view any sponsorship analytics', async () => {
            const adminId = (await createMockActorUser({ label: 'purchase-admin' })).id;

            const res = await app.request(`${BASE}/${own.id}/analytics`, {
                headers: headersFor({
                    actorId: adminId,
                    role: RoleEnum.ADMIN,
                    permissions: ADMIN_SPONSORSHIP_PERMISSIONS
                })
            });

            expect(res.status).toBe(200);
            expect((await res.json()).data).toEqual({
                impressions: 200,
                clicks: 10,
                couponsUsed: 3
            });
        });
    });

    describe('5. Error Handling and Edge Cases', () => {
        it('should reject the purchase of a level that does not exist', async () => {
            const res = await post({
                body: purchase({ level: eventLevel, overrides: { levelId: NON_EXISTENT_ID } })
            });

            expect(res.status).toBe(400);
            expect((await res.json()).error.message).toContain('does not exist');
        });

        it('should reject a level that applies to a different target type', async () => {
            const res = await post({
                body: purchase({ level: eventLevel, overrides: { targetType: 'post' } })
            });

            expect(res.status).toBe(400);
            expect((await res.json()).error.message).toContain('applies to event, not post');
        });

        it('should reject invalid coupon discount percentages above 100', async () => {
            const res = await post({
                body: purchase({ level: eventLevel, overrides: { couponDiscountPercent: 150 } })
            });

            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
        });

        it('should reject negative coupon discount percentages', async () => {
            const res = await post({
                body: purchase({ level: eventLevel, overrides: { couponDiscountPercent: -10 } })
            });

            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
        });

        // HOS-TODO-sponsorship-end-before-start: neither the create schema nor the service checks that endsAt follows startsAt, so the sponsorship is persisted with an inverted range.
        it.fails('should reject an end date before the start date', async () => {
            const res = await post({
                body: purchase({
                    level: eventLevel,
                    overrides: {
                        startsAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
                        endsAt: new Date().toISOString()
                    }
                })
            });

            expect(res.status).toBe(400);
        });

        it('currently accepts an end date before the start date (HOS-TODO-sponsorship-end-before-start)', async () => {
            const res = await post({
                body: purchase({
                    level: eventLevel,
                    overrides: {
                        startsAt: new Date(Date.now() + 30 * DAY_MS).toISOString(),
                        endsAt: new Date().toISOString()
                    }
                })
            });

            expect(res.status).toBe(201);
        });

        // HOS-TODO-sponsorship-duplicate-target: nothing stops the same sponsor buying the same target twice; both purchases are persisted as separate rows.
        it.fails('should reject a duplicate sponsorship for the same event', async () => {
            const body = purchase({ level: eventLevel });

            const first = await post({ body });
            const second = await post({ body });

            expect(first.status).toBe(201);
            expect(second.status).toBe(409);
        });

        it('currently accepts a duplicate sponsorship for the same event (HOS-TODO-sponsorship-duplicate-target)', async () => {
            const body = purchase({ level: eventLevel });

            const first = await post({ body });
            const second = await post({ body });

            expect(first.status).toBe(201);
            expect(second.status).toBe(201);
        });

        it('should reject malformed JSON in sponsorship creation', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: sponsorHeaders(),
                body: 'invalid json {'
            });

            expect(res.status).toBe(400);
        });

        it('should answer 400 to an analytics request with an invalid sponsorship id', async () => {
            const res = await app.request(`${BASE}/not-a-uuid/analytics`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(400);
        });

        it('should answer 404 to an analytics request for a sponsorship that does not exist', async () => {
            const res = await app.request(`${BASE}/${NON_EXISTENT_ID}/analytics`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(404);
        });
    });

    describe('6. Retired public catalog and billing checkout', () => {
        it.each([
            '/api/v1/public/sponsorship-levels',
            '/api/v1/public/sponsorship-levels?targetType=event',
            `/api/v1/public/sponsorship-levels/${NON_EXISTENT_ID}`,
            '/api/v1/public/sponsorship-packages',
            `/api/v1/public/sponsorship-packages/${NON_EXISTENT_ID}`,
            '/api/v1/protected/billing/plans'
        ])('should answer 404 to GET %s (route not mounted)', async (path) => {
            const res = await app.request(path, { headers: sponsorHeaders() });

            expect(res.status).toBe(404);
        });

        it('should answer 404 to the billing checkout session creation', async () => {
            const res = await app.request('/api/v1/protected/billing/checkout/sessions', {
                method: 'POST',
                headers: sponsorHeaders(),
                body: JSON.stringify({ sponsorshipId: own.id })
            });

            expect(res.status).toBe(404);
        });
    });

    describe('7. Unauthenticated Access', () => {
        it('should deny unauthenticated access to sponsorship creation', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: { 'content-type': 'application/json', 'user-agent': 'vitest' },
                body: JSON.stringify(purchase({ level: eventLevel }))
            });

            expect(res.status).toBe(401);
        });

        it('should deny unauthenticated access to analytics', async () => {
            const res = await app.request(`${BASE}/${own.id}/analytics`, {
                headers: { 'user-agent': 'vitest' }
            });

            expect(res.status).toBe(401);
        });
    });
});
