import type { Accommodation, Experience, Venue } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import type { ListingVertical } from '../../src/models/listing/listing-publication.model.ts';
import { listingPublicationModel } from '../../src/models/listing/listing-publication.model.ts';
import { listingRetentionModel } from '../../src/models/listing/listing-retention.model.ts';
import { GastronomyModel } from '../../src/models/venue/venue.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function createListing(
    tx: DrizzleClient,
    vertical: ListingVertical,
    ownerId: string,
    destinationId: string
) {
    const base = {
        name: 'Retention test',
        slug: `retention-${crypto.randomUUID()}`,
        summary: 'Summary',
        description: 'Description',
        ownerId,
        destinationId,
        publicationStatus: PublicationStatusEnum.DRAFT
    };
    if (vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            tx
        );
    if (vertical === 'gastronomy')
        return new GastronomyModel().create({ ...base, type: 'RESTAURANT' } as Partial<Venue>, tx);
    return new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx);
}

describe.each([
    'accommodation',
    'gastronomy',
    'experience'
] as const)('TEST:V6:8 retention model %s', (vertical) => {
    it('TEST:V6:8 reads the listing clock and its own deadline snapshot and rejects a missing version', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, vertical, owner.id, destination.id);
            const table = {
                accommodation: 'accommodations',
                gastronomy: 'gastronomies',
                experience: 'experiences'
            }[vertical];
            const stored = await listingRetentionModel.readRetentionListing({
                tx,
                vertical,
                listingId: listing.id
            });
            expect(stored).toMatchObject({
                id: listing.id,
                ownerId: owner.id,
                deadlinesVersion: 1,
                deadlines: { archiveAfterDays: 90, deletionAfterDays: 180, draftArchiveMonths: 3 }
            });
            await tx.execute(
                sql`UPDATE ${sql.identifier(table)} SET deadlines_version = 987654 WHERE id = ${listing.id}`
            );
            const candidates = await listingRetentionModel.listRetentionCandidates({
                tx,
                now: new Date('2030-01-01T00:00:00Z'),
                after: null,
                limit: 10
            });
            expect(candidates.items.some((item) => item.listingId === listing.id)).toBe(true);
            await expect(
                listingRetentionModel.readRetentionListing({ tx, vertical, listingId: listing.id })
            ).rejects.toThrow(listing.id);
        });
    });

    it('TEST:V6:8/9/10 pages eligible rows and returns the latest archive origin only', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            const published = await createListing(tx, vertical, owner.id, destination.id);
            const unpublished = await createListing(tx, vertical, owner.id, destination.id);
            const draft = await createListing(tx, vertical, owner.id, destination.id);
            const archived = await createListing(tx, vertical, owner.id, destination.id);
            const notDue = await createListing(tx, vertical, owner.id, destination.id);
            const moderated = await createListing(tx, vertical, owner.id, destination.id);
            const purged = await createListing(tx, vertical, owner.id, destination.id);
            const deleted = await createListing(tx, vertical, owner.id, destination.id);
            const now = new Date('2026-10-11T12:00:00Z');
            const table = {
                accommodation: 'accommodations',
                gastronomy: 'gastronomies',
                experience: 'experiences'
            }[vertical];
            await tx.execute(
                sql`UPDATE ${sql.identifier(table)} SET inactive_since = '2026-01-01T00:00:00Z', publication_status = 'PUBLISHED' WHERE id = ${published.id}`
            );
            await tx.execute(
                sql`UPDATE ${sql.identifier(table)} SET inactive_since = '2026-01-01T00:00:00Z', publication_status = 'UNPUBLISHED_BY_BILLING' WHERE id = ${unpublished.id}`
            );
            await tx.execute(
                sql`UPDATE ${sql.identifier(table)} SET inactive_since = '2026-01-01T00:00:00Z', publication_status = 'DRAFT' WHERE id = ${draft.id}`
            );
            await tx.execute(
                sql`UPDATE ${sql.identifier(table)} SET inactive_since = '2026-01-01T00:00:00Z', publication_status = 'ARCHIVED' WHERE id = ${archived.id}`
            );
            await tx.execute(
                sql`UPDATE ${sql.identifier(table)} SET inactive_since = '2026-10-01T00:00:00Z', publication_status = 'PUBLISHED' WHERE id = ${notDue.id}`
            );
            await tx.execute(
                sql`UPDATE ${sql.identifier(table)} SET inactive_since = '2026-01-01T00:00:00Z', publication_status = 'MODERATED' WHERE id = ${moderated.id}`
            );
            await tx.execute(
                sql`UPDATE ${sql.identifier(table)} SET inactive_since = '2026-01-01T00:00:00Z', publication_status = 'PURGED' WHERE id = ${purged.id}`
            );
            await tx.execute(
                sql`UPDATE ${sql.identifier(table)} SET inactive_since = '2026-01-01T00:00:00Z', publication_status = 'PUBLISHED', deleted_at = now() WHERE id = ${deleted.id}`
            );
            const pages: string[] = [];
            let after: { vertical: ListingVertical; listingId: string } | null = null;
            do {
                const page = await listingRetentionModel.listRetentionCandidates({
                    tx,
                    now,
                    after,
                    limit: 1
                });
                pages.push(...page.items.map((item) => item.listingId));
                after = page.next;
            } while (after);
            expect(pages.sort()).toEqual([published.id, unpublished.id, draft.id].sort());
            const old = new Date('2026-02-01T00:00:00Z');
            const latest = new Date('2026-03-01T00:00:00Z');
            await listingPublicationModel.insertStatusChangedEvent({
                tx,
                vertical,
                listingId: archived.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.ARCHIVED,
                actorType: 'job',
                correlationId: crypto.randomUUID(),
                occurredAt: old
            });
            await listingPublicationModel.insertStatusChangedEvent({
                tx,
                vertical,
                listingId: archived.id,
                from: PublicationStatusEnum.PUBLISHED,
                to: PublicationStatusEnum.ARCHIVED,
                actorType: 'job',
                correlationId: crypto.randomUUID(),
                occurredAt: latest
            });
            expect(
                await listingRetentionModel.readArchiveOrigins({
                    tx,
                    vertical,
                    listingIds: [archived.id]
                })
            ).toEqual(new Map([[archived.id, PublicationStatusEnum.PUBLISHED]]));
            expect(
                await listingRetentionModel.readArchiveOrigins({ tx, vertical, listingIds: [] })
            ).toEqual(new Map());
        });
    });

    it('TEST:V6:9 uses Postgres month clamping for a January 31 draft deadline', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            await tx.execute(
                sql`INSERT INTO vertical_deadline_version (version, values, changed_key, previous_value, new_value, changed_by) SELECT max(version) + 1, jsonb_set((SELECT values FROM vertical_deadline_version ORDER BY version DESC LIMIT 1), '{3,months}', '1'::jsonb), NULL, NULL, NULL, NULL FROM vertical_deadline_version`
            );
            const versionResult = await tx.execute(
                sql<{
                    version: number;
                }>`SELECT max(version) AS version FROM vertical_deadline_version`
            );
            const listing = await createListing(tx, vertical, owner.id, destination.id);
            const table = {
                accommodation: 'accommodations',
                gastronomy: 'gastronomies',
                experience: 'experiences'
            }[vertical];
            await tx.execute(
                sql`UPDATE ${sql.identifier(table)} SET publication_status = 'DRAFT', inactive_since = '2026-01-31T00:00:00Z', deadlines_version = ${versionResult.rows[0]?.version} WHERE id = ${listing.id}`
            );
            const result = await listingRetentionModel.listRetentionCandidates({
                tx,
                now: new Date('2026-02-28T00:00:00Z'),
                after: null,
                limit: 10
            });
            expect(result.items.map((item) => item.listingId)).toContain(listing.id);
        });
    });
});
