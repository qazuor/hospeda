import { randomUUID } from 'node:crypto';
import { getDb, sponsorshipLevels, sponsorshipPackages, sponsorships } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import {
    ADMIN_GATE_PERMISSIONS,
    buildMockActorHeaders,
    createMockActorUser
} from '../helpers/mock-actor';

// The mock-actor headers are only honoured when CI is unset.
delete process.env.CI;

/**
 * Integration tests for the admin sponsorship list route.
 *
 *   GET /api/v1/admin/sponsorships
 *
 * Two gates apply: the route asks for SPONSORSHIP_VIEW, and the service's
 * admin-list hook asks for the admin panel/API access plus SPONSORSHIP_VIEW_ANY.
 */
describe('Admin Sponsorship List Route', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/admin/sponsorships';
    const seededCount = 3;
    const lister = [
        ...ADMIN_GATE_PERMISSIONS,
        PermissionEnum.SPONSORSHIP_VIEW,
        PermissionEnum.SPONSORSHIP_VIEW_ANY
    ];
    let actorId: string;
    let packageId: string;
    let levelId: string;

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        actorId = (await createMockActorUser({ label: 'sponsorship-list' })).id;
        const suffix = randomUUID().slice(0, 8);
        const db = getDb();
        const [level] = await db
            .insert(sponsorshipLevels)
            .values({
                slug: `level-${suffix}`,
                name: `Level ${suffix}`,
                targetType: 'event',
                tier: 'bronze',
                priceAmount: 1000
            })
            .returning({ id: sponsorshipLevels.id });
        levelId = level?.id ?? '';
        if (!levelId) throw new Error('sponsorship list: level insert failed');
        const [pkg] = await db
            .insert(sponsorshipPackages)
            .values({
                slug: `package-${suffix}`,
                name: `Package ${suffix}`,
                priceAmount: 5000,
                includedPosts: 1,
                includedEvents: 1
            })
            .returning({ id: sponsorshipPackages.id });
        packageId = pkg?.id ?? '';
        if (!packageId) throw new Error('sponsorship list: package insert failed');
        await db.insert(sponsorships).values(
            Array.from({ length: seededCount }, (_, index) => ({
                slug: `sponsorship-${index}-${suffix}`,
                sponsorUserId: actorId,
                targetType: 'event' as const,
                targetId: randomUUID(),
                levelId,
                packageId,
                // One active row, the rest keep the column default (pending).
                ...(index === 0 ? { sponsorshipStatus: 'active' as const } : {}),
                startsAt: new Date()
            }))
        );
    });

    afterEach(async () => {
        await testDb.clean();
        clearCache();
    });

    afterAll(async () => {
        await testDb.teardown();
    });

    const list = ({
        query = '',
        permissions,
        withActor = true
    }: {
        readonly query?: string;
        readonly permissions: readonly PermissionEnum[];
        readonly withActor?: boolean;
    }) =>
        app.request(`${base}${query}`, {
            headers: withActor
                ? buildMockActorHeaders({ actorId, permissions, role: RoleEnum.ADMIN })
                : { 'user-agent': 'vitest' }
        });

    it('returns the seeded sponsorships with pagination for an admin actor', async () => {
        const res = await list({ query: '?page=1&pageSize=10', permissions: lister });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.data.items).toHaveLength(seededCount);
        expect(body.data.pagination).toMatchObject({ page: 1, total: seededCount });
    });

    it('answers 401 without an authenticated actor', async () => {
        const res = await list({ permissions: lister, withActor: false });
        expect(res.status).toBe(401);
    });

    it('answers 403 when the actor lacks SPONSORSHIP_VIEW', async () => {
        const res = await list({ permissions: ADMIN_GATE_PERMISSIONS });
        expect(res.status).toBe(403);
    });

    it('answers 403 when the actor has SPONSORSHIP_VIEW but not SPONSORSHIP_VIEW_ANY', async () => {
        const res = await list({
            permissions: [...ADMIN_GATE_PERMISSIONS, PermissionEnum.SPONSORSHIP_VIEW]
        });
        expect(res.status).toBe(403);
    });

    it('filters by sponsorshipStatus', async () => {
        const res = await list({ query: '?sponsorshipStatus=active', permissions: lister });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toHaveLength(1);
        expect(body.data.items[0].sponsorshipStatus).toBe('active');
    });

    const seedUnpackagedSponsorship = async (): Promise<void> => {
        await getDb()
            .insert(sponsorships)
            .values({
                slug: `no-package-${randomUUID().slice(0, 8)}`,
                sponsorUserId: actorId,
                targetType: 'event',
                targetId: randomUUID(),
                levelId,
                startsAt: new Date()
            });
    };

    // HOS-1905: SponsorshipAdminSchema declares
    // `package: SponsorshipPackageSchema.optional()` (sponsorship.access.schema.ts:122) but
    // sponsorships.package_id is nullable and the relation loader emits `package: null`
    // (sponsorship.service.ts:52), so response stripping throws and the list answers 500
    // (response-helpers.ts:201).
    it('currently answers 500 when a listed sponsorship has no package (HOS-1905)', async () => {
        await seedUnpackagedSponsorship();
        const res = await list({ query: '?page=1&pageSize=10', permissions: lister });
        expect(res.status).toBe(500);
    });

    // Drop `.fails` (and the test above) once HOS-1905 is fixed.
    it.fails('lists a sponsorship that has no package (HOS-1905)', async () => {
        await seedUnpackagedSponsorship();
        const res = await list({ query: '?page=1&pageSize=10', permissions: lister });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toHaveLength(seededCount + 1);
    });

    it('answers 400 for an unknown sponsorshipStatus', async () => {
        const res = await list({ query: '?sponsorshipStatus=bogus', permissions: lister });
        expect(res.status).toBe(400);
    });
});
