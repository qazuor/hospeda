// The mock-actor headers are only honoured when CI is unset (integration-test convention).
delete process.env.CI;

/**
 * Sponsor User E2E Flow
 *
 * A sponsor's journey through the protected sponsorship API, against the real
 * services and the integration database. Every actor is backed by a real user
 * row; the sponsorships and the level they hang from are seeded rows, so a
 * route that answers an empty 200 for everything cannot pass.
 *
 * The flow used to target `/api/v1/sponsorships`, a path that does not exist
 * (the routes live under `/api/v1/protected/sponsorships`), and every "denied"
 * case accepted 403/404/503. Foreign rows answer 404, never 403
 * (apps/api/docs/error-contract.md).
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { clearCache } from '../../src/middlewares/cache';
import { validateApiEnv } from '../../src/utils/env';
import { testDb } from '../e2e/setup/test-database';
import { buildMockActorHeaders, createMockActorUser } from './helpers/mock-actor';
import { seedPublicAccommodation } from './helpers/seed-public-accommodation';
import {
    type SeededSponsorship,
    type SeededSponsorshipLevel,
    seedSponsorship,
    seedSponsorshipLevel
} from './helpers/seed-sponsorship';

const BASE = '/api/v1/protected/sponsorships';
const NON_EXISTENT_ID = '99999999-9999-4999-8999-999999999999';

const SPONSOR_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.ACCESS_API_PUBLIC,
    PermissionEnum.ACCESS_API_PRIVATE,
    PermissionEnum.SPONSORSHIP_VIEW,
    PermissionEnum.SPONSORSHIP_CREATE,
    PermissionEnum.SPONSORSHIP_UPDATE,
    PermissionEnum.SPONSORSHIP_DELETE,
    // The ownership-scoped grants the service checks after the route gates
    PermissionEnum.SPONSORSHIP_VIEW_OWN,
    PermissionEnum.SPONSORSHIP_UPDATE_OWN,
    PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN
];

describe('Sponsor User E2E Flow', () => {
    let app: ReturnType<typeof initApp>;
    let sponsorId: string;
    let otherSponsorId: string;
    let level: SeededSponsorshipLevel;
    let mine: SeededSponsorship;
    let theirs: SeededSponsorship;

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

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        sponsorId = (await createMockActorUser({ label: 'sponsor-flow' })).id;
        otherSponsorId = (await createMockActorUser({ label: 'sponsor-flow-other' })).id;
        level = await seedSponsorshipLevel({ targetType: 'event' });
        mine = await seedSponsorship({ sponsorUserId: sponsorId, levelId: level.id });
        theirs = await seedSponsorship({ sponsorUserId: otherSponsorId, levelId: level.id });
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    describe('1. Sponsor Authentication and Access', () => {
        it('should allow sponsor to access the sponsorships list', async () => {
            const res = await app.request(BASE, { headers: sponsorHeaders() });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data.items.map((item: { id: string }) => item.id)).toContain(mine.id);
        });

        // HOS-TODO-sponsorship-list-unscoped: SponsorshipService._executeSearch only forces lifecycleState, so a sponsor holding SPONSORSHIP_VIEW_OWN lists every sponsor's sponsorships.
        it.fails('should list only the sponsorships the sponsor owns', async () => {
            const res = await app.request(BASE, { headers: sponsorHeaders() });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data.items.map((item: { id: string }) => item.id)).toEqual([mine.id]);
        });

        it('currently lists the sponsorships of every sponsor (HOS-TODO-sponsorship-list-unscoped)', async () => {
            const res = await app.request(BASE, { headers: sponsorHeaders() });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data.items.map((item: { id: string }) => item.id).sort()).toEqual(
                [mine.id, theirs.id].sort()
            );
        });

        it('should allow sponsor to view their own sponsorship by UUID', async () => {
            const res = await app.request(`${BASE}/${mine.id}`, { headers: sponsorHeaders() });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data).toMatchObject({ id: mine.id, sponsorUserId: sponsorId });
        });

        // HOS-1905: a sponsorship with no package makes the response schema reject the
        // relation loader's `package: null`, so the read answers 500.
        it.fails('should view a sponsorship that has no package (HOS-1905)', async () => {
            const unpackaged = await seedSponsorship({
                sponsorUserId: sponsorId,
                levelId: level.id,
                withPackage: false
            });

            const res = await app.request(`${BASE}/${unpackaged.id}`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
        });

        it('currently answers 500 for a sponsorship that has no package (HOS-1905)', async () => {
            const unpackaged = await seedSponsorship({
                sponsorUserId: sponsorId,
                levelId: level.id,
                withPackage: false
            });

            const res = await app.request(`${BASE}/${unpackaged.id}`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(500);
        });

        it('should answer 404 for the retired billing invoices endpoint', async () => {
            const res = await app.request('/api/v1/protected/billing/invoices', {
                headers: headersFor({
                    actorId: sponsorId,
                    permissions: [...SPONSOR_PERMISSIONS, PermissionEnum.INVOICE_VIEW]
                })
            });

            expect(res.status).toBe(404);
        });
    });

    describe('2. Sponsorship Management', () => {
        it('should create a sponsorship with valid data', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: sponsorHeaders(),
                body: JSON.stringify({
                    sponsorUserId: sponsorId,
                    targetType: 'event',
                    targetId: NON_EXISTENT_ID,
                    levelId: level.id,
                    startsAt: new Date().toISOString(),
                    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    logoUrl: 'https://example.com/logo.png',
                    linkUrl: 'https://example.com'
                })
            });

            expect(res.status).toBe(201);
            const data = await res.json();
            expect(data.data).toMatchObject({
                sponsorUserId: sponsorId,
                levelId: level.id,
                targetType: 'event'
            });
        });

        it('should update the sponsorship the sponsor owns', async () => {
            const res = await app.request(`${BASE}/${mine.id}`, {
                method: 'PUT',
                headers: sponsorHeaders(),
                body: JSON.stringify({ linkUrl: 'https://updated.example.com' })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data).toMatchObject({
                id: mine.id,
                linkUrl: 'https://updated.example.com'
            });
        });
    });

    describe('3. Access Control - Sponsor Restrictions', () => {
        it.each([
            { method: 'POST', path: '/api/v1/protected/billing/plans' },
            {
                method: 'PUT',
                path: '/api/v1/protected/billing/promo-codes/00000000-0000-0000-0000-000000000001'
            },
            { method: 'PUT', path: '/api/v1/protected/billing/settings' }
        ])('should answer 404 to $method $path (retired billing surface)', async ({
            method,
            path
        }) => {
            const res = await app.request(path, {
                method,
                headers: sponsorHeaders(),
                body: JSON.stringify({ name: 'x' })
            });

            expect(res.status).toBe(404);
        });

        it('should not let a sponsor create accommodations through the public tier', async () => {
            const res = await app.request('/api/v1/public/accommodations', {
                method: 'POST',
                headers: sponsorHeaders(),
                body: JSON.stringify({ name: 'Test', description: 'Test', address: '123 Test' })
            });

            expect(res.status).toBe(404);
        });

        it('should allow sponsor to view public accommodations', async () => {
            const accommodation = await seedPublicAccommodation();

            const res = await app.request('/api/v1/public/accommodations', {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data.items.map((item: { id: string }) => item.id)).toEqual([
                accommodation.id
            ]);
        });

        // HOS-TODO-sponsorship-foreign-403: the service's checkCanView/checkCanSoftDelete throw FORBIDDEN for a row owned by someone else, so the route answers 403 and confirms the id exists (error-contract.md wants 404).
        it.fails('should answer 404 when a sponsor deletes a sponsorship they do not own', async () => {
            const res = await app.request(`${BASE}/${theirs.id}`, {
                method: 'DELETE',
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(404);
        });

        it('currently answers 403 when a sponsor deletes a foreign sponsorship (HOS-TODO-sponsorship-foreign-403)', async () => {
            const res = await app.request(`${BASE}/${theirs.id}`, {
                method: 'DELETE',
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(403);
        });

        // HOS-TODO-sponsorship-foreign-403: same cause as the delete above, on the read path.
        it.fails('should answer 404 when a sponsor reads a sponsorship they do not own', async () => {
            const res = await app.request(`${BASE}/${theirs.id}`, { headers: sponsorHeaders() });

            expect(res.status).toBe(404);
        });

        it('currently answers 403 when a sponsor reads a foreign sponsorship (HOS-TODO-sponsorship-foreign-403)', async () => {
            const res = await app.request(`${BASE}/${theirs.id}`, { headers: sponsorHeaders() });

            expect(res.status).toBe(403);
        });
    });

    describe('4. Dashboard Data', () => {
        it('should return the paginated sponsorships list structure', async () => {
            const res = await app.request(`${BASE}?page=1&pageSize=10`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data.pagination).toMatchObject({ page: 1, pageSize: 10 });
        });

        it('should answer an empty page when there are no sponsorships at all', async () => {
            await testDb.clean();
            const lonelyId = (await createMockActorUser({ label: 'sponsor-flow-lonely' })).id;

            const res = await app.request(BASE, {
                headers: headersFor({ actorId: lonelyId, permissions: SPONSOR_PERMISSIONS })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data.items).toEqual([]);
            expect(data.data.pagination).toMatchObject({ total: 0 });
        });

        it('should return the analytics of a sponsorship the sponsor owns', async () => {
            const res = await app.request(`${BASE}/${mine.id}/analytics`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data).toBeDefined();
        });
    });

    describe('5. Edge Cases', () => {
        it('should answer 403 to a user without sponsorship permissions', async () => {
            const touristId = (await createMockActorUser({ label: 'sponsor-flow-tourist' })).id;

            const res = await app.request(BASE, {
                headers: headersFor({
                    actorId: touristId,
                    permissions: [
                        PermissionEnum.ACCESS_API_PUBLIC,
                        PermissionEnum.USER_VIEW_PROFILE
                    ],
                    role: RoleEnum.USER
                })
            });

            expect(res.status).toBe(403);
        });

        it('should answer 401 to an unauthenticated request', async () => {
            const res = await app.request(BASE, { headers: { 'user-agent': 'vitest' } });

            expect(res.status).toBe(401);
        });

        it('should answer 400 to an invalid sponsorship id', async () => {
            const res = await app.request(`${BASE}/not-a-uuid`, { headers: sponsorHeaders() });

            expect(res.status).toBe(400);
        });

        it('should answer 404 to a non-existent sponsorship UUID', async () => {
            const res = await app.request(`${BASE}/${NON_EXISTENT_ID}`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(404);
        });

        it('should answer 403 to a sponsor whose permissions were all revoked', async () => {
            const res = await app.request(BASE, {
                headers: headersFor({ actorId: sponsorId, permissions: [] })
            });

            expect(res.status).toBe(403);
        });

        it('should answer 403 to a host, who holds no sponsorship permissions', async () => {
            const hostId = (await createMockActorUser({ label: 'sponsor-flow-host' })).id;

            const res = await app.request(BASE, {
                headers: headersFor({
                    actorId: hostId,
                    role: RoleEnum.HOST,
                    permissions: [
                        PermissionEnum.ACCESS_API_PUBLIC,
                        PermissionEnum.ACCOMMODATION_CREATE,
                        PermissionEnum.USER_VIEW_PROFILE
                    ]
                })
            });

            expect(res.status).toBe(403);
        });

        it('should validate the sponsorship creation payload', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: sponsorHeaders(),
                body: JSON.stringify({ status: 'active' }) // Missing required fields
            });

            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
        });

        it('should handle malformed JSON gracefully', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: sponsorHeaders(),
                body: 'invalid json {'
            });

            expect(res.status).toBe(400);
        });

        it('should require content-type for POST requests', async () => {
            const { 'content-type': _contentType, ...withoutContentType } = sponsorHeaders();

            const res = await app.request(BASE, {
                method: 'POST',
                headers: withoutContentType,
                body: JSON.stringify({ packageId: 'pkg-001' })
            });

            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('INVALID_CONTENT_TYPE');
        });
    });
});
