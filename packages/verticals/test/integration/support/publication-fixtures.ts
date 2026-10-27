import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { AccommodationModel, destinations, ExperienceModel, users, VenueModel } from '@repo/db';
import type { Accommodation, Experience, Venue } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import type { PublicationVertical } from '../../../src/publication/publication-types';

/** Seeds an owner and a destination for publication integration tests. */
export async function seedPublicationOwner(args: { readonly db: DrizzleClient }) {
    const [user] = await args.db
        .insert(users)
        .values({
            email: `publication-${randomUUID()}@example.com`,
            displayName: 'Publication owner'
        })
        .returning({ id: users.id });
    const [destination] = await args.db
        .insert(destinations)
        .values({
            name: `Publication destination ${randomUUID()}`,
            slug: `publication-${randomUUID()}`,
            destinationType: 'CITY',
            level: 5,
            path: `/publication-${randomUUID()}`,
            pathIds: randomUUID(),
            summary: 'Test city',
            description: 'A city for publication fixtures',
            location: { coordinates: { lat: '-32.49', long: '-58.23' } }
        })
        .returning({ id: destinations.id });
    if (!user || !destination) throw new Error('fixture insert failed');
    return { userId: user.id, destinationId: destination.id };
}

/** Seeds a listing in one of the three current vertical tables. */
export async function seedPublicationListing(args: {
    readonly db: DrizzleClient;
    readonly vertical: PublicationVertical;
    readonly userId: string;
    readonly destinationId: string;
    readonly status?: PublicationStatusEnum;
}) {
    const status = args.status ?? PublicationStatusEnum.DRAFT;
    const base = {
        name: 'Publication fixture',
        slug: `publication-${randomUUID()}`,
        summary: 'Summary',
        description: 'Description',
        ownerId: args.userId,
        destinationId: args.destinationId,
        publicationStatus: status
    };
    if (args.vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            args.db
        );
    if (args.vertical === 'venue')
        return new VenueModel().create({ ...base, type: 'RESTAURANT' } as Partial<Venue>, args.db);
    return new ExperienceModel().create(
        { ...base, type: 'EXCURSION' } as Partial<Experience>,
        args.db
    );
}

/** Trial's pseudonym fixture without a mailbox. */
export function publicationPseudonym() {
    return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}

/** Tracks fixtures owned by one integration file and removes them from global populations. */
export function createPublicationFixtureTracker(db: DrizzleClient) {
    const ownerIds = new Set<string>();
    const listingIds = new Set<string>();
    return {
        owner: async () => {
            const owner = await seedPublicationOwner({ db });
            ownerIds.add(owner.userId);
            return owner;
        },
        listing: async (args: Omit<Parameters<typeof seedPublicationListing>[0], 'db'>) => {
            const listing = await seedPublicationListing({ ...args, db });
            listingIds.add(listing.id);
            return listing;
        },
        cleanup: async () => {
            const ids = [...listingIds];
            if (ids.length) {
                const listingIdList = sql.join(
                    ids.map((id) => sql`${id}`),
                    sql`, `
                );
                await db.execute(
                    sql`UPDATE accommodations SET deleted_at = now() WHERE id IN (${listingIdList})`
                );
                await db.execute(
                    sql`UPDATE gastronomies SET deleted_at = now() WHERE id IN (${listingIdList})`
                );
                await db.execute(
                    sql`UPDATE experiences SET deleted_at = now() WHERE id IN (${listingIdList})`
                );
            }
            if (ownerIds.size) {
                const ownerIdList = sql.join(
                    [...ownerIds].map((id) => sql`${id}`),
                    sql`, `
                );
                await db.execute(
                    sql`UPDATE users SET deleted_at = now() WHERE id IN (${ownerIdList})`
                );
            }
            listingIds.clear();
            ownerIds.clear();
        }
    };
}
