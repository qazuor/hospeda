import {
    AccommodationModel,
    accommodations,
    destinations,
    getDb,
    sql,
    users,
    verticalDeadlineVersions
} from '@repo/db';
import type { Accommodation, VerticalDeadlineValues } from '@repo/schemas';
import { PermissionEnum, PublicationStatusEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import {
    changeVerticalDeadline,
    getCurrentVerticalDeadlines,
    getVerticalDeadlinesVersion,
    previewVerticalDeadlineChange
} from '@repo/service-core';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app';
import { validateApiEnv } from '../../../src/utils/env';
import { testDb } from '../../e2e/setup/test-database';

const actor = {
    id: '11111111-1111-4111-8111-111111111111',
    roles: [RoleEnum.SUPER_ADMIN],
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, PermissionEnum.MAINTENANCE_MODE_WRITE]
};
const ownerId = '14790000-0000-4000-8000-000000000001';
const destinationId = '14790000-0000-4000-8000-000000000002';
const archivedId = '14790000-0000-4000-8000-000000000003';
const freshId = '14790000-0000-4000-8000-000000000004';
const version1Values = {
    '1': { days: 90 },
    '2': { days: 180 },
    '3': { months: 3 },
    '4': { beforeArchiveDays: 15, beforeDeletionDays: 15 },
    '5': { daysBefore: [10, 5, 2, 0] },
    '6': { daysAfter: [1, 5, 15, 30, 60] },
    '7': { days: 90 },
    '8': { days: 7 },
    '9': { days: 30 }
} satisfies VerticalDeadlineValues;

function headers(role: RoleEnum, permissions: PermissionEnum[]) {
    return {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-admin-token',
        'User-Agent': 'vitest',
        'x-mock-actor-id': actor.id,
        'x-mock-actor-role': role,
        'x-mock-actor-permissions': JSON.stringify(permissions)
    };
}

/** Seed only the foreign keys needed by the archived and newly born accommodations. */
async function seedListingReferences() {
    await getDb().insert(users).values({
        id: ownerId,
        email: 'hos-1479-vertical-deadlines@example.com',
        emailVerified: true
    });
    await getDb()
        .insert(destinations)
        .values({
            id: destinationId,
            slug: 'hos-1479-vertical-deadlines',
            name: 'Vertical deadlines destination',
            summary: 'Vertical deadlines test',
            description: 'Vertical deadlines integration test destination',
            destinationType: 'CITY',
            path: '/hos-1479-vertical-deadlines',
            location: { coordinates: { lat: '-32.48', long: '-58.23' } }
        });
}

/** Insert the already archived listing with its announced deletion date. */
async function seedArchivedListing() {
    const inactiveSince = new Date('2026-01-01T12:00:00.000Z');
    const deletionAnnouncedAt = new Date(inactiveSince.getTime() + 180 * 86_400_000);
    await getDb().insert(accommodations).values({
        id: archivedId,
        slug: 'hos-1479-archived',
        name: 'Archived accommodation',
        summary: 'Archived listing',
        description: 'Archived listing used by TEST:V6:28',
        type: 'CABIN',
        ownerId,
        destinationId,
        publicationStatus: PublicationStatusEnum.ARCHIVED,
        inactiveSince,
        deadlinesVersion: 1,
        deletionAnnouncedAt
    });
    return { inactiveSince, deletionAnnouncedAt };
}

/** Remove only this test's listing references before the version table is reset. */
async function cleanListingReferences() {
    await getDb().delete(accommodations).where(eq(accommodations.id, archivedId));
    await getDb().delete(accommodations).where(eq(accommodations.id, freshId));
    await getDb().delete(destinations).where(eq(destinations.id, destinationId));
    await getDb().delete(users).where(eq(users.id, ownerId));
}

describe('TEST:V6:28 action 22 on vertical deadlines', () => {
    beforeAll(async () => {
        await testDb.setup();
        validateApiEnv();
    });

    beforeEach(async () => {
        await getDb().execute(sql`TRUNCATE TABLE vertical_deadline_version CASCADE`);
        await getDb()
            .insert(verticalDeadlineVersions)
            .values({ version: 1, values: version1Values });
    });

    afterEach(async () => {
        await cleanListingReferences();
        await getDb().execute(sql`TRUNCATE TABLE vertical_deadline_version CASCADE`);
        await getDb()
            .insert(verticalDeadlineVersions)
            .values({ version: 1, values: version1Values });
    });

    afterAll(async () => testDb.teardown());

    it('previews 180 to 120 with both values and no date advancement, without publishing', async () => {
        const preview = await previewVerticalDeadlineChange({
            actor,
            key: 2,
            value: { days: 120 }
        });
        expect(preview).toMatchObject({
            currentVersion: 1,
            currentValue: { days: 180 },
            newValue: { days: 120 }
        });
        expect(preview.message).toContain('180');
        expect(preview.message).toContain('120');
        expect(preview.message).toContain('las fechas ya anunciadas no se adelantan');
        expect(await getDb().select().from(verticalDeadlineVersions)).toHaveLength(1);
    });

    it('keeps the announced date and version of an archived listing after publishing 120', async () => {
        await seedListingReferences();
        const announced = await seedArchivedListing();
        const published = await changeVerticalDeadline({
            actor,
            key: 2,
            value: { days: 120 },
            expectedVersion: 1,
            confirmed: true
        });
        expect(published).toMatchObject({
            version: 2,
            changedKey: 2,
            changedBy: actor.id,
            previousValue: { days: 180 },
            newValue: { days: 120 }
        });
        expect(published.createdAt).toBeInstanceOf(Date);
        const [archived] = await getDb()
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, archivedId));
        expect(archived?.deadlinesVersion).toBe(1);
        expect(archived?.inactiveSince).toEqual(announced.inactiveSince);
        expect(archived?.deletionAnnouncedAt).toEqual(announced.deletionAnnouncedAt);
        expect((await getVerticalDeadlinesVersion({ version: 1 })).values['2'].days).toBe(180);
    });

    it('starts a new accommodation clock on version 2 and 120 days', async () => {
        await changeVerticalDeadline({
            actor,
            key: 2,
            value: { days: 120 },
            expectedVersion: 1,
            confirmed: true
        });
        await seedListingReferences();
        await new AccommodationModel().create({
            id: freshId,
            slug: 'hos-1479-fresh',
            name: 'Fresh accommodation',
            summary: 'Fresh listing',
            description: 'Fresh listing used by TEST:V6:28',
            type: 'CABIN',
            ownerId,
            destinationId
        } as Partial<Accommodation>);
        const [fresh] = await getDb()
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, freshId));
        expect(fresh?.deadlinesVersion).toBe(2);
        expect((await getVerticalDeadlinesVersion({ version: 2 })).values['2'].days).toBe(120);
    });

    it('rejects contradictory archive, PB5 month and advance notice changes over HTTP', async () => {
        const app = initApp();
        const url = '/api/v1/admin/vertical-deadlines';
        for (const [key, value] of [
            [1, { days: 200 }],
            [3, { months: 6 }],
            [4, { beforeArchiveDays: 95, beforeDeletionDays: 15 }]
        ] as const) {
            const response = await app.request(url, {
                method: 'POST',
                headers: headers(RoleEnum.SUPER_ADMIN, actor.permissions),
                body: JSON.stringify({ key, value, expectedVersion: 1, confirmed: true })
            });
            expect(response.status).toBe(400);
            expect((await response.json()).error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        }
        expect((await getCurrentVerticalDeadlines()).version).toBe(1);
    });

    it('requires the permission and rejects stale versions and unchanged values', async () => {
        const app = initApp();
        const url = '/api/v1/admin/vertical-deadlines';
        const request = (expectedVersion: number, value: unknown) =>
            JSON.stringify({ key: 2, value, expectedVersion, confirmed: true });
        const denied = await app.request(url, {
            method: 'POST',
            headers: headers(RoleEnum.ADMIN, [PermissionEnum.ACCESS_PANEL_ADMIN]),
            body: request(1, { days: 120 })
        });
        expect(denied.status).toBe(403);
        expect((await denied.json()).error.code).toBe(ServiceErrorCode.FORBIDDEN);
        for (const body of [request(2, { days: 120 }), request(1, { days: 180 })]) {
            const response = await app.request(url, {
                method: 'POST',
                headers: headers(RoleEnum.SUPER_ADMIN, actor.permissions),
                body
            });
            expect(response.status).toBe(400);
            expect((await response.json()).error.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        }
        expect((await getCurrentVerticalDeadlines()).version).toBe(1);
    });

    it('reads the current and an earlier immutable version over HTTP', async () => {
        await changeVerticalDeadline({
            actor,
            key: 2,
            value: { days: 120 },
            expectedVersion: 1,
            confirmed: true
        });
        const app = initApp();
        const url = '/api/v1/admin/vertical-deadlines';
        const admin = headers(RoleEnum.SUPER_ADMIN, actor.permissions);
        const current = await app.request(url, { headers: admin });
        const earlier = await app.request(`${url}/1`, { headers: admin });
        expect(current.status).toBe(200);
        expect(earlier.status).toBe(200);
        expect((await current.json()).data).toMatchObject({
            version: 2,
            values: { '2': { days: 120 } }
        });
        expect((await earlier.json()).data).toMatchObject({
            version: 1,
            values: { '2': { days: 180 } }
        });
    });
});
