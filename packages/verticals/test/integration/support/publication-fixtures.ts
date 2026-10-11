import { randomUUID } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import {
    AccommodationModel,
    destinations,
    ExperienceModel,
    GastronomyModel,
    users
} from '@repo/db';
import type { Accommodation, Experience, Gastronomy } from '@repo/schemas';
import { PublicationStatusEnum } from '@repo/schemas';
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
        publicationStatus: status,
        lifecycleState: status === PublicationStatusEnum.PUBLISHED ? 'ACTIVE' : 'INACTIVE',
        visibility: status === PublicationStatusEnum.PUBLISHED ? 'PUBLIC' : 'PRIVATE'
    };
    if (args.vertical === 'accommodation')
        return new AccommodationModel().create(
            { ...base, type: 'CABIN' } as Partial<Accommodation>,
            args.db
        );
    if (args.vertical === 'gastronomy')
        return new GastronomyModel().create(
            { ...base, type: 'RESTAURANT' } as Partial<Gastronomy>,
            args.db
        );
    return new ExperienceModel().create(
        { ...base, type: 'EXCURSION' } as Partial<Experience>,
        args.db
    );
}

/** Trial's pseudonym fixture without a mailbox. */
export function publicationPseudonym() {
    return randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
}
