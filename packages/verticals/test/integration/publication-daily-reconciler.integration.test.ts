import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { partners } from '@repo/db';
import { PartnerTypeEnum, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { listingPublicationModel } from '../../../db/src/models/listing/listing-publication.model';
import { runDailyCoverageReconciler } from '../../src/publication/coverage-reconciler';
import { seedPublicationListing, seedPublicationOwner } from './support/publication-fixtures';
import { createReconcilerTestPorts } from './support/reconciler-test-ports';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());

/** TEST:V6:7 exercises both missed notice directions and Partner cache reconciliation. */
describe('TEST:V6:7 daily coverage reconciler with DB', () => {
    it('restores missed coverage, lowers lost coverage, preserves MODERATED and reconciles Partner presence', async () => {
        const restoredOwner = await seedPublicationOwner({ db });
        const downOwner = await seedPublicationOwner({ db });
        const moderatedOwner = await seedPublicationOwner({ db });
        const restored = await seedPublicationListing({
            db,
            vertical: VerticalEnum.ACCOMMODATION,
            ...restoredOwner,
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        });
        const lowered = await seedPublicationListing({
            db,
            vertical: VerticalEnum.ACCOMMODATION,
            ...downOwner,
            status: PublicationStatusEnum.PUBLISHED
        });
        const moderated = await seedPublicationListing({
            db,
            vertical: VerticalEnum.ACCOMMODATION,
            ...moderatedOwner,
            status: PublicationStatusEnum.MODERATED
        });
        const partnerOwner = await seedPublicationOwner({ db });
        await db.insert(partners).values({
            slug: `daily-reconciler-${randomUUID()}`,
            name: 'Daily reconciler',
            type: PartnerTypeEnum.NGO,
            ownerUserId: partnerOwner.userId
        });
        const invalidated: string[] = [];
        const monitorCalls: string[] = [];
        const ports = createReconcilerTestPorts({
            db,
            coveredByUser: new Map([
                [restoredOwner.userId, true],
                [downOwner.userId, false]
            ]),
            limitByUser: new Map([
                [restoredOwner.userId, 3],
                [downOwner.userId, 3]
            ]),
            invalidated,
            monitorCalls,
            cachedPresenceByUser: new Map([[partnerOwner.userId, []]]),
            livePresenceByUser: new Map([[partnerOwner.userId, ['partner_public_page']]])
        });
        const result = await runDailyCoverageReconciler({ ports });
        expect(result.complete).toBe(true);
        expect(result.pinged).toBe(true);
        expect(monitorCalls).toHaveLength(1);
        expect(monitorCalls[0]).toBe('listing-coverage-reconciler');
        expect(invalidated).toContain(restoredOwner.userId);
        expect(invalidated).toContain(partnerOwner.userId);
        expect(
            (
                await listingPublicationModel.readListing({
                    tx: db,
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId: restored.id
                })
            )?.publicationStatus
        ).toBe(PublicationStatusEnum.PUBLISHED);
        expect(
            (
                await listingPublicationModel.readListing({
                    tx: db,
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId: lowered.id
                })
            )?.publicationStatus
        ).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
        expect(
            (
                await listingPublicationModel.readListing({
                    tx: db,
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId: moderated.id
                })
            )?.publicationStatus
        ).toBe(PublicationStatusEnum.MODERATED);
    });
});
