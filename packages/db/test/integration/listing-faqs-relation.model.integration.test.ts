/**
 * HOS-2670 regression: `findWithRelations(..., { faqs: true })` must load the
 * FAQ rows of a listing, for every listing vertical.
 *
 * `BaseModelImpl.findWithRelations` is a stub that ignores `relations` and
 * returns the bare row. `AccommodationModel` overrides it (SPEC-158), but
 * `VenueModel` and `ExperienceModel` did not, so the public and admin FAQ
 * reads (`listVenueFaqs` / `listExperienceFaqs`) returned `[]` for every
 * listing even when `venue_faqs` / `experience_faqs` held rows.
 *
 * This runs against the real integration database because the bug lives in
 * which query is issued, which a mocked client cannot see.
 */
import type { Accommodation, Experience, Venue } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { ExperienceModel } from '../../src/models/experience/experience.model.ts';
import { VenueModel } from '../../src/models/venue/venue.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

type Vertical = 'accommodation' | 'venue' | 'experience';

const FAQ_TABLES = {
    accommodation: { table: 'accommodation_faqs', fk: 'accommodation_id' },
    venue: { table: 'venue_faqs', fk: 'venue_id' },
    experience: { table: 'experience_faqs', fk: 'experience_id' }
} as const;

function modelFor(vertical: Vertical) {
    if (vertical === 'accommodation') return new AccommodationModel();
    if (vertical === 'venue') return new VenueModel();
    return new ExperienceModel();
}

async function createListing(
    tx: DrizzleClient,
    vertical: Vertical,
    ownerId: string,
    destinationId: string
): Promise<{ id: string }> {
    const base = {
        name: `FAQ fixture ${crypto.randomUUID()}`,
        slug: `faq-${crypto.randomUUID()}`,
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
        return new VenueModel().create(
            { ...base, type: 'RESTAURANT', businessLines: ['food'] } as Partial<Venue>,
            tx
        );
    return new ExperienceModel().create({ ...base, type: 'EXCURSION' } as Partial<Experience>, tx);
}

async function insertFaq(
    tx: DrizzleClient,
    vertical: Vertical,
    input: {
        readonly listingId: string;
        readonly question: string;
        readonly displayOrder: number | null;
        readonly deleted?: boolean;
    }
): Promise<void> {
    const { table, fk } = FAQ_TABLES[vertical];
    await tx.execute(sql`
        INSERT INTO ${sql.identifier(table)} (${sql.identifier(fk)}, question, answer, display_order, deleted_at)
        VALUES (${input.listingId}, ${input.question}, 'answer', ${input.displayOrder}, ${input.deleted ? sql`now()` : sql`NULL`})`);
}

describe.each([
    'accommodation',
    'venue',
    'experience'
] as const)('HOS-2670 %s findWithRelations({ faqs: true })', (vertical) => {
    it('loads the live FAQs of the listing, ordered, without deleted or foreign rows', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const owner = testData.user();
            const destination = testData.destination();
            await tx.insert(users).values(owner);
            await tx.insert(destinations).values(destination);
            const listing = await createListing(tx, vertical, owner.id, destination.id);
            const other = await createListing(tx, vertical, owner.id, destination.id);
            await insertFaq(tx, vertical, {
                listingId: listing.id,
                question: 'unordered',
                displayOrder: null
            });
            await insertFaq(tx, vertical, {
                listingId: listing.id,
                question: 'second',
                displayOrder: 2
            });
            await insertFaq(tx, vertical, {
                listingId: listing.id,
                question: 'first',
                displayOrder: 1
            });
            await insertFaq(tx, vertical, {
                listingId: listing.id,
                question: 'deleted',
                displayOrder: 0,
                deleted: true
            });
            await insertFaq(tx, vertical, {
                listingId: other.id,
                question: 'foreign',
                displayOrder: 0
            });

            // Act
            const found = await modelFor(vertical).findWithRelations(
                { id: listing.id },
                { faqs: true },
                tx
            );

            // Assert
            expect(found?.id).toBe(listing.id);
            const faqs = (found as unknown as { faqs?: { question: string }[] } | null)?.faqs;
            expect(faqs?.map((f) => f.question)).toEqual(['first', 'second', 'unordered']);
        });
    });
});
