import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { trials } from '@repo/db';
import { PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { listingPublicationModel } from '../../../db/src/models/listing/listing-publication.model';
import { recalculateCoverage } from '../../src/publication/coverage-recalculation';
import { publishListing } from '../../src/publication/publish-listing';
import { unpublishListing } from '../../src/publication/unpublish-listing';
import {
    publicationPseudonym,
    seedPublicationListing,
    seedPublicationOwner
} from './support/publication-fixtures';
import { createPublicationTestAdapter } from './support/publication-unit-of-work';

const pool = new Pool({ connectionString: process.env.HOSPEDA_TEST_DATABASE_URL, max: 8 });
const db = drizzle({ client: pool }) as unknown as DrizzleClient;
afterAll(async () => pool.end());
const vertical = VerticalEnum.ACCOMMODATION;
const at = new Date('2026-10-10T13:00:00.000Z');
const clock = { now: () => new Date(at) };
const afterCommit = {
    emitCoverageChanged: async () => {},
    invalidateUser: async () => {},
    revalidate: async () => {}
};

describe('TEST:V6:1 and TEST:V6:4 - PB2, PB3 and PB6 with DB', () => {
    it('lowers only the published listing, stamps the three facts, restores only the system-lowered one and keeps trial unchanged', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const published = await seedPublicationListing({ db, vertical, userId, destinationId });
        const draft = await seedPublicationListing({ db, vertical, userId, destinationId });
        const alreadyDown = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        });
        const covered = { value: false };
        const limit = { value: 2 };
        const adapter = createPublicationTestAdapter({ db, covered, limit });
        const first = await publishListing({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            listingId: published.id,
            event: 'listing_published',
            emailPseudonym: publicationPseudonym(),
            correlationId: randomUUID()
        });
        expect(first).toMatchObject({ published: true, trialStarted: true });
        covered.value = true;
        const second = await publishListing({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            listingId: draft.id,
            event: 'listing_published',
            emailPseudonym: publicationPseudonym(),
            correlationId: randomUUID()
        });
        expect(second).toMatchObject({ published: true });
        const trialBefore = await db.select().from(trials).where(eq(trials.userId, userId));
        expect(trialBefore).toHaveLength(1);
        expect(
            await unpublishListing({
                unitOfWork: adapter.unitOfWork,
                afterCommit,
                clock,
                userId,
                vertical,
                listingId: draft.id,
                correlationId: randomUUID()
            })
        ).toMatchObject({ unpublished: true });
        expect(await db.select().from(trials).where(eq(trials.userId, userId))).toEqual(
            trialBefore
        );

        covered.value = false;
        const loss = await recalculateCoverage({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        expect(loss.lowered).toEqual([published.id]);
        expect(loss.stamped).toEqual(
            expect.arrayContaining([published.id, draft.id, alreadyDown.id])
        );
        for (const id of [published.id, draft.id, alreadyDown.id]) {
            expect(
                (await listingPublicationModel.readListing({ tx: db, vertical, listingId: id }))
                    ?.inactiveSince
            ).toEqual(at);
        }
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: draft.id }))
                ?.publicationStatus
        ).toBe(PublicationStatusEnum.DRAFT);
        expect(
            (
                await listingPublicationModel.readListing({
                    tx: db,
                    vertical,
                    listingId: published.id
                })
            )?.publicationStatus
        ).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);

        covered.value = true;
        limit.value = 1;
        const regain = await recalculateCoverage({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        expect(regain.restored).toContain(published.id);
        expect(regain.restored).not.toContain(alreadyDown.id);
        expect(
            (await listingPublicationModel.readListing({ tx: db, vertical, listingId: draft.id }))
                ?.publicationStatus
        ).toBe(PublicationStatusEnum.DRAFT);
        expect(await db.select().from(trials).where(eq(trials.userId, userId))).toEqual(
            trialBefore
        );
    });

    it('with coverage true does not run PB2 or write its loss fact', async () => {
        const { userId, destinationId } = await seedPublicationOwner({ db });
        const published = await seedPublicationListing({
            db,
            vertical,
            userId,
            destinationId,
            status: PublicationStatusEnum.PUBLISHED
        });
        const adapter = createPublicationTestAdapter({
            db,
            covered: { value: true },
            limit: { value: 1 }
        });
        const result = await recalculateCoverage({
            ...adapter,
            afterCommit,
            clock,
            userId,
            vertical,
            correlationId: randomUUID()
        });
        expect(result.lowered).toEqual([]);
        expect(
            (
                await listingPublicationModel.readListing({
                    tx: db,
                    vertical,
                    listingId: published.id
                })
            )?.publicationStatus
        ).toBe(PublicationStatusEnum.PUBLISHED);
        const audit = await db.execute(
            sql`SELECT count(*)::int AS count FROM domain_event WHERE entity_id = ${published.id} AND event_type = 'listing.status_changed'`
        );
        expect(audit.rows[0]?.count).toBe(0);
    });
});
