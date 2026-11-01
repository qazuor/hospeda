/**
 * Sponsor User E2E Flow
 *
 * A sponsor's journey through the protected sponsorship API, against the real
 * services and the integration database. Every actor is backed by a real user
 * row, and the sponsorships and the level they hang from are seeded rows, so a
 * route that answers an empty 200 for everything cannot pass.
 *
 * Actors take their permissions from the production seed's role table
 * (`helpers/seeded-role-permissions.ts`), never from a hand-written list: a
 * hand-built "sponsor" with SPONSORSHIP_VIEW/CREATE/UPDATE/DELETE certified a
 * user the seed never creates (the seeded SPONSOR only holds the `_OWN` grants).
 * The SUPER_ADMIN actor is capability coverage for the routes: its real seeded
 * permissions plus the four route-gate permissions that no seeded role holds. It
 * shows what the routes do once the gates are open, not what any account can do
 * today.
 *
 * Foreign rows should answer 404, never 403 (apps/api/docs/error-contract.md).
 *
 * Known gaps pinned below (each `it.fails` states the intended behaviour, and a
 * "currently ..." sibling pins today's so a crash or a fix both turn red):
 * - HOS-1913: a foreign sponsorship answers 403.
 * - HOS-1916: the seeded SPONSOR cannot create, update, delete or read analytics
 *   of its own sponsorships, and the list ignores the page.
 */

import { PermissionEnum, RoleEnum, SponsorshipTargetTypeEnum } from '@repo/schemas';
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
import { seededPermissionsFor } from './helpers/seeded-role-permissions';

const BASE = '/api/v1/protected/sponsorships';
const NON_EXISTENT_ID = '99999999-9999-4999-8999-999999999999';

type RowIds = readonly string[];

describe('Sponsor User E2E Flow', () => {
    let app: ReturnType<typeof initApp>;
    let sponsorId: string;
    let otherSponsorId: string;
    let level: SeededSponsorshipLevel;
    let mine: SeededSponsorship;
    let theirs: SeededSponsorship;

    const headersFor = ({ actorId, role }: { readonly actorId: string; readonly role: RoleEnum }) =>
        buildMockActorHeaders({ actorId, permissions: seededPermissionsFor({ role }), role });

    /** The seeded SPONSOR. */
    const sponsorHeaders = () => headersFor({ actorId: sponsorId, role: RoleEnum.SPONSOR });
    /**
     * Capability coverage: the seeded SUPER_ADMIN's real permissions PLUS the four
     * route-gate permissions (HOS-1916: no seeded role holds them, SUPER_ADMIN
     * included), so the routes can be exercised with the gates open.
     */
    const superAdminHeaders = (actorId: string) =>
        buildMockActorHeaders({
            actorId,
            role: RoleEnum.SUPER_ADMIN,
            permissions: [
                ...seededPermissionsFor({ role: RoleEnum.SUPER_ADMIN }),
                PermissionEnum.SPONSORSHIP_VIEW,
                PermissionEnum.SPONSORSHIP_CREATE,
                PermissionEnum.SPONSORSHIP_UPDATE,
                PermissionEnum.SPONSORSHIP_DELETE
            ]
        });

    const idsOf = ({ body }: { readonly body: { data: { items: { id: string }[] } } }): RowIds =>
        body.data.items.map((item) => item.id);

    const createBody = () => ({
        sponsorUserId: sponsorId,
        targetType: SponsorshipTargetTypeEnum.EVENT,
        targetId: NON_EXISTENT_ID,
        levelId: level.id,
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        logoUrl: 'https://example.com/logo.png',
        linkUrl: 'https://example.com'
    });

    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        app = initApp();
    });

    beforeEach(async () => {
        sponsorId = (await createMockActorUser({ label: 'sponsor-flow' })).id;
        otherSponsorId = (await createMockActorUser({ label: 'sponsor-flow-other' })).id;
        level = await seedSponsorshipLevel();
        mine = await seedSponsorship({ sponsorUserId: sponsorId, level });
        theirs = await seedSponsorship({ sponsorUserId: otherSponsorId, level });
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    describe('1. The seeded sponsor reads', () => {
        it('should list sponsorships to a sponsor', async () => {
            const res = await app.request(BASE, { headers: sponsorHeaders() });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(idsOf({ body: data })).toContain(mine.id);
        });

        it('should let the sponsor view their own sponsorship by UUID', async () => {
            const res = await app.request(`${BASE}/${mine.id}`, { headers: sponsorHeaders() });

            expect(res.status).toBe(200);
            expect((await res.json()).data).toMatchObject({
                id: mine.id,
                sponsorUserId: sponsorId
            });
        });

        // HOS-1905: package_id is nullable, so the relation loader's `package: null` must pass
        // response stripping.
        it('should view a sponsorship that has no package (HOS-1905)', async () => {
            const unpackaged = await seedSponsorship({
                sponsorUserId: sponsorId,
                level,
                withPackage: false
            });

            const res = await app.request(`${BASE}/${unpackaged.id}`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
        });

        it('should answer 404 for the retired billing invoices endpoint', async () => {
            const res = await app.request('/api/v1/protected/billing/invoices', {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(404);
        });
    });

    describe('2. The seeded sponsor writes', () => {
        // HOS-1916: the seed grants SPONSOR only the `_OWN` sponsorship permissions, but the
        // create/update/delete/analytics routes gate on SPONSORSHIP_CREATE/UPDATE/DELETE/VIEW,
        // which no sponsor holds. The seed comment says SPONSOR should "manage own sponsorships".
        const writes: ReadonlyArray<{
            readonly name: string;
            readonly request: () => Response | Promise<Response>;
            readonly intendedStatus: number;
        }> = [
            {
                name: 'create a sponsorship',
                intendedStatus: 201,
                request: () =>
                    app.request(BASE, {
                        method: 'POST',
                        headers: sponsorHeaders(),
                        body: JSON.stringify(createBody())
                    })
            },
            {
                name: 'update their own sponsorship',
                intendedStatus: 200,
                request: () =>
                    app.request(`${BASE}/${mine.id}`, {
                        method: 'PUT',
                        headers: sponsorHeaders(),
                        body: JSON.stringify({ linkUrl: 'https://updated.example.com' })
                    })
            },
            {
                name: 'delete their own sponsorship',
                intendedStatus: 200,
                request: () =>
                    app.request(`${BASE}/${mine.id}`, {
                        method: 'DELETE',
                        headers: sponsorHeaders()
                    })
            },
            {
                name: 'read the analytics of their own sponsorship',
                intendedStatus: 200,
                request: () =>
                    app.request(`${BASE}/${mine.id}/analytics`, { headers: sponsorHeaders() })
            }
        ];

        for (const { name, request, intendedStatus } of writes) {
            it.fails(`should let the sponsor ${name} (HOS-1916)`, async () => {
                const res = await request();

                expect(res.status).toBe(intendedStatus);
            });

            it(`currently answers 403 when the sponsor tries to ${name} (HOS-1916)`, async () => {
                const res = await request();

                expect(res.status).toBe(403);
            });
        }
    });

    describe('3. Capability coverage with every gate open (SUPER_ADMIN)', () => {
        let adminId: string;

        beforeEach(async () => {
            adminId = (await createMockActorUser({ label: 'sponsor-flow-super-admin' })).id;
        });

        it('currently answers 403 to the seeded SUPER_ADMIN without the gate permissions (HOS-1916)', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: headersFor({ actorId: adminId, role: RoleEnum.SUPER_ADMIN }),
                body: JSON.stringify(createBody())
            });

            expect(res.status).toBe(403);
        });

        it('should create a sponsorship with valid data', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: superAdminHeaders(adminId),
                body: JSON.stringify(createBody())
            });

            expect(res.status).toBe(201);
            expect((await res.json()).data).toMatchObject({
                sponsorUserId: sponsorId,
                levelId: level.id,
                targetType: 'event'
            });
        });

        it('should update a sponsorship', async () => {
            const res = await app.request(`${BASE}/${mine.id}`, {
                method: 'PUT',
                headers: superAdminHeaders(adminId),
                body: JSON.stringify({ linkUrl: 'https://updated.example.com' })
            });

            expect(res.status).toBe(200);
            expect((await res.json()).data).toMatchObject({
                id: mine.id,
                linkUrl: 'https://updated.example.com'
            });
        });

        it('should return the analytics of a sponsorship', async () => {
            const res = await app.request(`${BASE}/${mine.id}/analytics`, {
                headers: superAdminHeaders(adminId)
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.success).toBe(true);
            expect(data.data).toEqual({ impressions: 0, clicks: 0, couponsUsed: 0 });
        });

        it('should soft-delete a sponsorship', async () => {
            const res = await app.request(`${BASE}/${theirs.id}`, {
                method: 'DELETE',
                headers: superAdminHeaders(adminId)
            });

            expect(res.status).toBe(200);
        });

        it('should validate the sponsorship creation payload', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: superAdminHeaders(adminId),
                body: JSON.stringify({ status: 'active' }) // Missing required fields
            });

            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
        });

        it('should handle malformed JSON gracefully', async () => {
            const res = await app.request(BASE, {
                method: 'POST',
                headers: superAdminHeaders(adminId),
                body: 'invalid json {'
            });

            expect(res.status).toBe(400);
        });

        it('should require content-type for POST requests', async () => {
            const { 'content-type': _contentType, ...withoutContentType } =
                superAdminHeaders(adminId);

            const res = await app.request(BASE, {
                method: 'POST',
                headers: withoutContentType,
                body: JSON.stringify({ packageId: 'pkg-001' })
            });

            expect(res.status).toBe(400);
            expect((await res.json()).error.code).toBe('INVALID_CONTENT_TYPE');
        });
    });

    describe('4. Access control', () => {
        // HOS-1913: checkCanView throws FORBIDDEN for a row owned by someone else, so the route
        // answers 403 and confirms the id exists (error-contract.md wants 404).
        it.fails('should answer 404 when a sponsor reads a sponsorship they do not own', async () => {
            const res = await app.request(`${BASE}/${theirs.id}`, { headers: sponsorHeaders() });

            expect(res.status).toBe(404);
        });

        it('currently answers 403 when a sponsor reads a foreign sponsorship (HOS-1913)', async () => {
            const res = await app.request(`${BASE}/${theirs.id}`, { headers: sponsorHeaders() });

            expect(res.status).toBe(403);
        });

        // Regression for HOS-1912: the list is scoped to the caller without SPONSORSHIP_VIEW_ANY.
        it('should list nothing but their own sponsorships to a sponsor', async () => {
            const res = await app.request(BASE, { headers: sponsorHeaders() });

            expect(res.status).toBe(200);
            expect(idsOf({ body: await res.json() })).toEqual([mine.id]);
        });

        describe('a seeded HOST (holds SPONSORSHIP_VIEW_OWN, owns no sponsorship)', () => {
            let hostHeaders: Record<string, string>;

            beforeEach(async () => {
                const hostId = (await createMockActorUser({ label: 'sponsor-flow-host' })).id;
                hostHeaders = headersFor({ actorId: hostId, role: RoleEnum.HOST });
            });

            it('holds the permission that opens the list', () => {
                expect(seededPermissionsFor({ role: RoleEnum.HOST })).toContain(
                    PermissionEnum.SPONSORSHIP_VIEW_OWN
                );
            });

            it('should list none of the sponsorships to a host', async () => {
                const res = await app.request(BASE, { headers: hostHeaders });

                expect(res.status).toBe(200);
                expect(idsOf({ body: await res.json() })).toEqual([]);
            });

            it('should ignore a foreign ?sponsorUserId for a host', async () => {
                const res = await app.request(`${BASE}?sponsorUserId=${otherSponsorId}`, {
                    headers: hostHeaders
                });

                expect(res.status).toBe(200);
                expect(idsOf({ body: await res.json() })).toEqual([]);
            });
        });

        it('should answer 403 to a user without sponsorship permissions', async () => {
            const touristId = (await createMockActorUser({ label: 'sponsor-flow-tourist' })).id;

            const res = await app.request(BASE, {
                headers: headersFor({ actorId: touristId, role: RoleEnum.USER })
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
            expect(idsOf({ body: await res.json() })).toEqual([accommodation.id]);
        });
    });

    describe('5. Dashboard data', () => {
        it('should echo the requested page and size', async () => {
            const res = await app.request(`${BASE}?page=1&pageSize=10`, {
                headers: sponsorHeaders()
            });

            expect(res.status).toBe(200);
            expect((await res.json()).data.pagination).toMatchObject({ page: 1, pageSize: 10 });
        });

        describe('second page', () => {
            beforeEach(async () => {
                // The sponsor owns 3 rows (its seeded one plus these two); the list is scoped to the caller (HOS-1912).
                await seedSponsorship({ sponsorUserId: sponsorId, level });
                await seedSponsorship({ sponsorUserId: sponsorId, level });
            });

            // HOS-1916: the list ignores page/pageSize when it reads the model, so page 2
            // repeats page 1 and the page size is not applied.
            it.fails('should serve a second page of one row', async () => {
                const first = await app.request(`${BASE}?page=1&pageSize=1`, {
                    headers: sponsorHeaders()
                });
                const second = await app.request(`${BASE}?page=2&pageSize=1`, {
                    headers: sponsorHeaders()
                });

                const firstIds = idsOf({ body: await first.json() });
                const secondBody = await second.json();
                const secondIds = idsOf({ body: secondBody });
                expect(firstIds).toHaveLength(1);
                expect(secondIds).toHaveLength(1);
                expect(secondIds[0]).not.toBe(firstIds[0]);
                expect(secondBody.data.pagination).toMatchObject({
                    page: 2,
                    pageSize: 1,
                    total: 3
                });
            });

            it('currently does not apply the page (HOS-1916)', async () => {
                const second = await app.request(`${BASE}?page=2&pageSize=1`, {
                    headers: sponsorHeaders()
                });

                expect(second.status).toBe(200);
                const body = await second.json();
                expect(body.data.pagination).toMatchObject({ page: 2, pageSize: 1 });
                expect(body.data.items).toHaveLength(3);
            });
        });

        it('should answer an empty page when there are no sponsorships at all', async () => {
            await testDb.clean();
            const lonelyId = (await createMockActorUser({ label: 'sponsor-flow-lonely' })).id;

            const res = await app.request(BASE, {
                headers: headersFor({ actorId: lonelyId, role: RoleEnum.SPONSOR })
            });

            expect(res.status).toBe(200);
            const data = await res.json();
            expect(data.data.items).toEqual([]);
            expect(data.data.pagination).toMatchObject({ total: 0 });
        });
    });
});
