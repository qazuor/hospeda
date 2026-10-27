import type { Accommodation, Experience, Venue } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import type { ListingVertical } from '../../src/models/listing/listing-publication.model.ts';
import { listingPurgeModel } from '../../src/models/listing/listing-purge.model.ts';
import { VenueModel } from '../../src/models/venue/venue.model.ts';
import { accommodationCalendarSync } from '../../src/schemas/accommodation/accommodationCalendarSync.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

/** Upper bound on pages walked, so a cursor that never advances fails instead of hanging. */
const MAX_PAGES = 10_000;

const VERTICALS = ['accommodation', 'venue', 'experience'] as const;

const MEDIA_TABLES = {
    accommodation: { table: 'accommodation_media', fk: 'accommodation_id' },
    venue: { table: 'gastronomy_media', fk: 'gastronomy_id' },
    experience: { table: 'experience_media', fk: 'experience_id' }
} as const;

async function createListing(
    tx: DrizzleClient,
    vertical: ListingVertical,
    ownerId: string,
    destinationId: string
) {
    const base = {
        name: `Remote deletion fixture ${crypto.randomUUID()}`,
        slug: `remote-deletion-${crypto.randomUUID()}`,
        summary: 'summary',
        description: 'description',
        ownerId,
        destinationId
    };
    if (vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            tx
        );
    if (vertical === 'venue')
        return new VenueModel().create({ ...base, type: 'RESTAURANT' } as Partial<Venue>, tx);
    return new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx);
}

async function insertMedia(args: {
    readonly tx: DrizzleClient;
    readonly vertical: ListingVertical;
    readonly listingId: string;
    readonly publicId: string;
    readonly markedAt: Date | null;
}): Promise<string> {
    const target = MEDIA_TABLES[args.vertical];
    const result = await args.tx.execute(sql<{ id: string }>`
        INSERT INTO ${sql.identifier(target.table)}
            (${sql.identifier(target.fk)}, url, public_id, sort_order, remote_deletion_pending_at)
        VALUES (${args.listingId}, ${`https://cdn.example.test/${args.publicId}.jpg`},
            ${args.publicId}, 0, ${args.markedAt})
        RETURNING id`);
    return String(result.rows[0]?.id);
}

async function walkMarkedMedia(tx: DrizzleClient) {
    const pages: {
        readonly vertical: ListingVertical;
        readonly mediaId: string;
        readonly publicId: string | null;
        readonly markedAt: Date;
    }[][] = [];
    let after: { readonly vertical: ListingVertical; readonly mediaId: string } | null = null;
    const cursors = new Set<string>();
    do {
        if (pages.length >= MAX_PAGES) throw new Error('listMarkedMedia cursor never ended');
        const page = await listingPurgeModel.listMarkedMedia({ tx, after, limit: 2 });
        pages.push([...page.items]);
        const nextKey = page.next === null ? null : `${page.next.vertical}|${page.next.mediaId}`;
        if (nextKey !== null && cursors.has(nextKey))
            throw new Error(`listMarkedMedia cursor did not advance past ${nextKey}`);
        if (nextKey !== null) cursors.add(nextKey);
        after = page.next;
    } while (after !== null);
    return pages;
}

async function walkMarkedCalendar(tx: DrizzleClient) {
    const pages: {
        readonly connectionId: string;
        readonly accommodationId: string;
        readonly provider: string;
        readonly markedAt: Date;
    }[][] = [];
    let after: string | null = null;
    const cursors = new Set<string>();
    do {
        if (pages.length >= MAX_PAGES)
            throw new Error('listMarkedCalendarConnections cursor never ended');
        const page = await listingPurgeModel.listMarkedCalendarConnections({
            tx,
            after,
            limit: 1
        });
        pages.push([...page.items]);
        if (page.next !== null && cursors.has(page.next))
            throw new Error(
                `listMarkedCalendarConnections cursor did not advance past ${page.next}`
            );
        if (page.next !== null) cursors.add(page.next);
        after = page.next;
    } while (after !== null);
    return pages;
}

describe('AC:V6:30 the marked remote deletions are read page by page', () => {
    it('AC:V6:30 walks every page once and returns only the marked rows', async () => {
        await withTestTransaction(async (tx) => {
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            const markedAt = new Date('2026-10-12T12:34:56.789Z');
            const marked = new Map<
                string,
                { vertical: ListingVertical; publicId: string; markedAt: Date }
            >();
            const unmarked = new Set<string>();
            let accommodationId = '';
            for (const vertical of VERTICALS) {
                const listing = await createListing(tx, vertical, owner.id, destination.id);
                if (vertical === 'accommodation') accommodationId = listing.id;
                const markedPublicId = `remote-deletion/${crypto.randomUUID()}`;
                const markedId = await insertMedia({
                    tx,
                    vertical,
                    listingId: listing.id,
                    publicId: markedPublicId,
                    markedAt
                });
                marked.set(markedId, { vertical, publicId: markedPublicId, markedAt });
                unmarked.add(
                    await insertMedia({
                        tx,
                        vertical,
                        listingId: listing.id,
                        publicId: `remote-deletion/${crypto.randomUUID()}`,
                        markedAt: null
                    })
                );
            }
            const calendarRows = await tx
                .insert(accommodationCalendarSync)
                .values(
                    (['GOOGLE_CALENDAR', 'BOOKING', 'AIRBNB'] as const).map((provider) => ({
                        accommodationId,
                        provider,
                        accessTokenCiphertext: 'fixture-ciphertext',
                        accessTokenIv: 'fixture-iv',
                        accessTokenAuthTag: 'fixture-tag',
                        createdById: owner.id,
                        remoteDeletionPendingAt: provider === 'AIRBNB' ? null : markedAt
                    }))
                )
                .returning({
                    id: accommodationCalendarSync.id,
                    provider: accommodationCalendarSync.provider
                });
            const markedCalendar = calendarRows.filter((row) => row.provider !== 'AIRBNB');
            const unmarkedCalendar = calendarRows.find((row) => row.provider === 'AIRBNB');

            const mediaPages = await walkMarkedMedia(tx);
            const calendarPages = await walkMarkedCalendar(tx);

            const seenMedia = new Set<string>();
            for (const page of mediaPages) {
                expect(page.length).toBeLessThanOrEqual(2);
                for (const item of page) {
                    const key = `${item.vertical}|${item.mediaId}`;
                    expect(seenMedia.has(key)).toBe(false);
                    seenMedia.add(key);
                }
            }
            const allMedia = mediaPages.flat();
            for (const [mediaId, expected] of marked) {
                const found = allMedia.filter((item) => item.mediaId === mediaId);
                expect(found).toEqual([{ mediaId, ...expected }]);
            }
            for (const mediaId of unmarked) {
                expect(allMedia.some((item) => item.mediaId === mediaId)).toBe(false);
            }

            const seenCalendar = new Set<string>();
            for (const page of calendarPages) {
                expect(page.length).toBeLessThanOrEqual(1);
                for (const item of page) {
                    expect(seenCalendar.has(item.connectionId)).toBe(false);
                    seenCalendar.add(item.connectionId);
                }
            }
            const allCalendar = calendarPages.flat();
            for (const row of markedCalendar) {
                expect(allCalendar.filter((item) => item.connectionId === row.id)).toEqual([
                    { connectionId: row.id, accommodationId, provider: row.provider, markedAt }
                ]);
            }
            expect(allCalendar.some((item) => item.connectionId === unmarkedCalendar?.id)).toBe(
                false
            );

            const [deletedId, deleted] = [...marked.entries()][0] ?? [];
            expect(
                await listingPurgeModel.deleteMarkedMedia({
                    tx,
                    vertical: deleted!.vertical,
                    mediaId: deletedId!
                })
            ).toBe(true);
            const afterDelete = (await walkMarkedMedia(tx)).flat();
            expect(afterDelete.some((item) => item.mediaId === deletedId)).toBe(false);
            for (const [mediaId] of [...marked.entries()].slice(1)) {
                expect(afterDelete.filter((item) => item.mediaId === mediaId)).toHaveLength(1);
            }
        });
    });
});
