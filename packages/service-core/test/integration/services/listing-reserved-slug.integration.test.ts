/**
 * listing-reserved-slug.integration.test.ts
 *
 * HOS-1862 — real-DB proof of AC:6:6: a venue whose slug is `rubro` cannot be
 * created, and a venue named "Rubro" is stored under `rubro-<n>` instead.
 *
 * The unit suite covers the hook in isolation; this one proves the rule holds
 * through the admin create service against PostgreSQL, including that no row
 * lands in `venues`.
 */

import { PermissionEnum, RoleEnum, ServiceErrorCode, VenueTypeEnum } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { VenueService } from '../../../src/services/venue/venue.service';
import type { Actor, ServiceContext } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    getServiceTestDb,
    isServiceTestDbAvailable,
    seedVenue,
    withServiceTestTransaction
} from './helpers';

const dbAvailable = isServiceTestDbAvailable();

describe('AC:6:6 a venue with slug "rubro" cannot be created', () => {
    let venueService: VenueService;
    let adminActor: Actor;
    let seededAdminId: string;

    beforeAll(async () => {
        if (!dbAvailable) return;
        const db = getServiceTestDb();
        venueService = new VenueService({ logger: createLoggerMock() });

        seededAdminId = crypto.randomUUID();
        const { users } = await import('@repo/db');
        await db.insert(users).values({
            id: seededAdminId,
            slug: `test-admin-${seededAdminId.slice(0, 8)}`,
            email: `reserved-slug-admin-${seededAdminId.slice(0, 8)}@test.local`,
            displayName: 'Reserved Slug Test Admin',
            emailVerified: true,
            lifecycleState: 'ACTIVE',
            role: RoleEnum.SUPER_ADMIN
        } as typeof users.$inferInsert);

        adminActor = {
            id: seededAdminId,
            roles: [RoleEnum.SUPER_ADMIN],
            permissions: Object.values(PermissionEnum)
        };
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        if (seededAdminId) {
            const db = getServiceTestDb();
            const { users, eq } = await import('@repo/db');
            await db.delete(users).where(eq(users.id, seededAdminId));
        }
        await closeServiceTestPool();
    });

    it.skipIf(!dbAvailable)('rejects an explicit "rubro" slug and writes no row', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { ownerId, destinationId } = await seedVenue(tx);
            const ctx: ServiceContext = { tx };

            // Inside the caller's transaction the base runner rethrows the
            // ServiceError instead of returning `{ error }` (base.service.ts
            // catch branch: `if (ctx?.tx) throw error`).
            await expect(
                venueService.create(
                    adminActor,
                    {
                        name: 'Local Rubro',
                        slug: 'rubro',
                        summary: 'A venue that tries to squat the rubro collection',
                        description: 'A venue that tries to squat the rubro collection segment.',
                        type: VenueTypeEnum.PARRILLA,
                        ownerId: ownerId as `${string}-${string}-${string}-${string}-${string}`,
                        destinationId:
                            destinationId as `${string}-${string}-${string}-${string}-${string}`,
                        averageRating: 0,
                        reviewsCount: 0
                    },
                    ctx
                )
            ).rejects.toMatchObject({
                code: ServiceErrorCode.VALIDATION_ERROR,
                details: { field: 'slug', reason: 'RESERVED' }
            });

            const { eq, venues } = await import('@repo/db');
            const rows = await tx.select().from(venues).where(eq(venues.slug, 'rubro'));
            expect(rows).toHaveLength(0);
        });
    });

    it.skipIf(!dbAvailable)('gives a venue named "Rubro" a suffixed generated slug', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { ownerId, destinationId } = await seedVenue(tx);
            const ctx: ServiceContext = { tx };

            const result = await venueService.create(
                adminActor,
                {
                    name: 'Rubro',
                    summary: 'A venue whose name collides with the collection segment',
                    description: 'A venue whose name collides with the rubro collection segment.',
                    type: VenueTypeEnum.PARRILLA,
                    ownerId: ownerId as `${string}-${string}-${string}-${string}-${string}`,
                    destinationId:
                        destinationId as `${string}-${string}-${string}-${string}-${string}`,
                    averageRating: 0,
                    reviewsCount: 0
                },
                ctx
            );

            expect(result.error).toBeUndefined();
            expect(result.data?.slug).toMatch(/^rubro-\d+$/);
        });
    });
});
