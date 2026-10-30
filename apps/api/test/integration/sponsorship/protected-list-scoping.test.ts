import { randomUUID } from 'node:crypto';
import { getDb, sponsorshipLevels, sponsorshipPackages, sponsorships } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ROLE_PERMISSIONS } from '../../../../../packages/seed/src/required/rolePermissions.seed';
import { initApp } from '../../../src/app';
import { clearCache } from '../../../src/middlewares/cache';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';
import { buildMockActorHeaders, createMockActorUser } from '../helpers/mock-actor';

// The mock-actor headers are only honoured when CI is unset.
delete process.env.CI;

/**
 * Regression for HOS-1912: `GET /api/v1/protected/sponsorships` must list only the
 * caller's own sponsorships unless they hold SPONSORSHIP_VIEW_ANY. The actor's
 * permissions come from the REAL seeded HOST role, not a hand-written list.
 */
describe('Protected sponsorship list scoping (HOS-1912)', () => {
    let app: ReturnType<typeof initApp>;
    const base = '/api/v1/protected/sponsorships';
    const hostPermissions = ROLE_PERMISSIONS[RoleEnum.HOST];
    let hostId: string;
    let otherSponsorId: string;
    let ownIds: string[];
    let foreignIds: string[];

    beforeAll(async () => {
        await testDb.setup();
        await testDb.clean();
        clearCache();
        validateApiEnv();
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        app = initApp();
    });

    beforeEach(async () => {
        hostId = (await createMockActorUser({ label: 'sponsorship-scope-host' })).id;
        otherSponsorId = (await createMockActorUser({ label: 'sponsorship-scope-other' })).id;
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
        if (!level || !pkg) throw new Error('sponsorship scoping: level/package insert failed');

        const insertFor = async (sponsorUserId: string, count: number, tag: string) =>
            (
                await db
                    .insert(sponsorships)
                    .values(
                        Array.from({ length: count }, (_, index) => ({
                            slug: `sponsorship-${tag}-${index}-${suffix}`,
                            sponsorUserId,
                            targetType: 'event' as const,
                            targetId: randomUUID(),
                            levelId: level.id,
                            packageId: pkg.id,
                            startsAt: new Date()
                        }))
                    )
                    .returning({ id: sponsorships.id })
            ).map((row) => row.id);

        ownIds = await insertFor(hostId, 2, 'own');
        foreignIds = await insertFor(otherSponsorId, 3, 'foreign');
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
        permissions
    }: {
        readonly query?: string;
        readonly permissions: readonly PermissionEnum[];
    }) =>
        app.request(`${base}${query}`, {
            headers: buildMockActorHeaders({ actorId: hostId, permissions, role: RoleEnum.HOST })
        });

    const idsOf = async (res: Response): Promise<string[]> => {
        const body = await res.json();
        return (body.data.items as { id: string }[]).map((item) => item.id).sort();
    };

    it('uses real seeded HOST permissions that include VIEW_OWN and not VIEW_ANY', () => {
        expect(hostPermissions).toContain(PermissionEnum.SPONSORSHIP_VIEW_OWN);
        expect(hostPermissions).not.toContain(PermissionEnum.SPONSORSHIP_VIEW_ANY);
    });

    it('returns only the caller own sponsorships', async () => {
        const res = await list({ permissions: hostPermissions });
        expect(res.status).toBe(200);
        expect(await idsOf(res)).toEqual([...ownIds].sort());
    });

    it('ignores ?sponsorUserId= pointing at another sponsor', async () => {
        const res = await list({
            query: `?sponsorUserId=${otherSponsorId}`,
            permissions: hostPermissions
        });
        expect(res.status).toBe(200);
        const ids = await idsOf(res);
        expect(ids).toEqual([...ownIds].sort());
        for (const id of foreignIds) expect(ids).not.toContain(id);
    });

    it('still lets a SPONSORSHIP_VIEW_ANY holder see every sponsor', async () => {
        const res = await list({
            permissions: [...hostPermissions, PermissionEnum.SPONSORSHIP_VIEW_ANY]
        });
        expect(res.status).toBe(200);
        expect(await idsOf(res)).toEqual([...ownIds, ...foreignIds].sort());
    });
});
