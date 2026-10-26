import type { Accommodation, Experience, Venue } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { domainEventModel } from '../../src/models/domain-event/domain-event.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import {
    type ListingVertical,
    listingPublicationModel
} from '../../src/models/listing/listing-publication.model.ts';
import { GastronomyModel } from '../../src/models/venue/venue.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function makeListing(args: {
    tx: DrizzleClient;
    vertical: ListingVertical;
    ownerId: string;
    destinationId: string;
}) {
    const base = {
        name: 'Publication test',
        slug: `publication-${crypto.randomUUID()}`,
        summary: 'Summary',
        description: 'Description',
        ownerId: args.ownerId,
        destinationId: args.destinationId,
        publicationStatus: PublicationStatusEnum.DRAFT
    };
    if (args.vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            args.tx
        );
    if (args.vertical === 'gastronomy')
        return new GastronomyModel().create(
            { ...base, type: 'RESTAURANT' } as Partial<Venue>,
            args.tx
        );
    return new ExperienceModel().create(
        { ...base, type: 'EXCURSION' } as Partial<Experience>,
        args.tx
    );
}

describe.each([
    'accommodation',
    'gastronomy',
    'experience'
] as const)('listing publication model: %s', (vertical) => {
    it('locks, reads, counts, changes conditionally, stamps paired clock and audits', async () => {
        await withTestTransaction(async (tx) => {
            const user = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(user);
            await tx.insert(destinations).values(destination);
            const first = await makeListing({
                tx,
                vertical,
                ownerId: user.id,
                destinationId: destination.id
            });
            const second = await makeListing({
                tx,
                vertical,
                ownerId: user.id,
                destinationId: destination.id
            });
            await listingPublicationModel.lock({ tx, key: `model-test:${user.id}:${vertical}` });
            const before = await listingPublicationModel.readListing({
                tx,
                vertical,
                listingId: first.id
            });
            expect(before?.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
            expect(
                (await listingPublicationModel.listByOwner({ tx, vertical, ownerId: user.id })).map(
                    (row) => row.id
                )
            ).toEqual(expect.arrayContaining([first.id, second.id]));
            expect(
                await listingPublicationModel.countPublished({ tx, vertical, ownerId: user.id })
            ).toBe(0);

            const at = new Date('2026-10-10T12:00:00.000Z');
            expect(
                await listingPublicationModel.setPublicationStatus({
                    tx,
                    vertical,
                    listingId: first.id,
                    from: PublicationStatusEnum.DRAFT,
                    to: PublicationStatusEnum.PUBLISHED,
                    inactiveSince: at,
                    actorId: user.id
                })
            ).toBe(true);
            expect(
                await listingPublicationModel.setPublicationStatus({
                    tx,
                    vertical,
                    listingId: first.id,
                    from: PublicationStatusEnum.DRAFT,
                    to: PublicationStatusEnum.PUBLISHED
                })
            ).toBe(false);
            await listingPublicationModel.insertStatusChangedEvent({
                tx,
                vertical,
                listingId: first.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED,
                oldInactiveSince: before!.inactiveSince,
                inactiveSince: at,
                actorType: 'owner',
                actorId: user.id,
                correlationId: crypto.randomUUID()
            });
            expect(
                await listingPublicationModel.countPublished({ tx, vertical, ownerId: user.id })
            ).toBe(1);
            const after = await listingPublicationModel.readListing({
                tx,
                vertical,
                listingId: first.id
            });
            expect(after?.inactiveSince).toEqual(at);
            const stamped = new Date('2026-10-11T12:00:00.000Z');
            await listingPublicationModel.stampInactiveSince({
                tx,
                vertical,
                listingIds: [second.id],
                at: stamped
            });
            expect(
                (await listingPublicationModel.readListing({ tx, vertical, listingId: second.id }))
                    ?.inactiveSince
            ).toEqual(stamped);
            const table = {
                accommodation: 'accommodations',
                gastronomy: 'gastronomies',
                experience: 'experiences'
            }[vertical];
            const rows = await tx.execute(
                sql`SELECT publication_status, inactive_since, deadlines_version FROM ${sql.identifier(table)} WHERE id = ${first.id}`
            );
            expect(rows.rows[0]).toMatchObject({ publication_status: 'PUBLISHED' });
            expect(new Date(String(rows.rows[0]?.inactive_since))).toEqual(at);
            const version = await tx.execute(
                sql`SELECT max(version) AS version FROM vertical_deadline_version`
            );
            expect(rows.rows[0]?.deadlines_version).toBe(version.rows[0]?.version);
            const stampedVersion = await tx.execute(
                sql`SELECT inactive_since, deadlines_version FROM ${sql.identifier(table)} WHERE id = ${second.id}`
            );
            expect(new Date(String(stampedVersion.rows[0]?.inactive_since))).toEqual(stamped);
            expect(stampedVersion.rows[0]?.deadlines_version).toBe(version.rows[0]?.version);
            const events = await domainEventModel.findByEntity({
                tx,
                entityType: vertical,
                entityId: first.id
            });
            expect(events).toHaveLength(1);
            expect(events[0]?.changes).toEqual([
                { field: 'publicationStatus', old: 'DRAFT', new: 'PUBLISHED' },
                {
                    field: 'inactiveSince',
                    old: before!.inactiveSince.toISOString(),
                    new: at.toISOString()
                }
            ]);
            expect(
                await listingPublicationModel.setPublicationStatus({
                    tx,
                    vertical,
                    listingId: first.id,
                    from: PublicationStatusEnum.PUBLISHED,
                    to: PublicationStatusEnum.UNPUBLISHED_BY_BILLING
                })
            ).toBe(true);
            const unpublished = await tx.execute(
                sql`SELECT publication_status FROM ${sql.identifier(table)} WHERE id = ${first.id}`
            );
            expect(unpublished.rows[0]).toEqual({ publication_status: 'UNPUBLISHED_BY_BILLING' });
            expect(
                await listingPublicationModel.setPublicationStatus({
                    tx,
                    vertical,
                    listingId: first.id,
                    from: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                    to: PublicationStatusEnum.DRAFT
                })
            ).toBe(true);
            const draft = await tx.execute(
                sql`SELECT publication_status FROM ${sql.identifier(table)} WHERE id = ${first.id}`
            );
            expect(draft.rows[0]).toEqual({ publication_status: 'DRAFT' });
            const announced = new Date('2026-10-12T12:00:00.000Z');
            expect(
                await listingPublicationModel.setPublicationStatus({
                    tx,
                    vertical,
                    listingId: first.id,
                    from: PublicationStatusEnum.DRAFT,
                    to: PublicationStatusEnum.ARCHIVED,
                    deletionAnnouncedAt: announced
                })
            ).toBe(true);
            expect(
                await listingPublicationModel.setPublicationStatus({
                    tx,
                    vertical,
                    listingId: first.id,
                    from: PublicationStatusEnum.ARCHIVED,
                    to: PublicationStatusEnum.DRAFT
                })
            ).toBe(true);
            const announcementRow = await tx.execute(
                sql`SELECT deletion_announced_at FROM ${sql.identifier(table)} WHERE id = ${first.id}`
            );
            expect(new Date(String(announcementRow.rows[0]?.deletion_announced_at))).toEqual(
                announced
            );
            await listingPublicationModel.insertStatusChangedEvent({
                tx,
                vertical,
                listingId: first.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.ARCHIVED,
                actorType: 'job',
                correlationId: crypto.randomUUID(),
                deletionAnnouncedAt: announced,
                oldDeletionAnnouncedAt: null
            });
            const audited = await domainEventModel.findByEntity({
                tx,
                entityType: vertical,
                entityId: first.id
            });
            expect(audited.at(-1)?.changes).toContainEqual({
                field: 'deletionAnnouncedAt',
                old: null,
                new: announced.toISOString()
            });
        });
    });
});
