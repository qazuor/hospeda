import { randomUUID } from 'node:crypto';
import {
    AccommodationModel,
    accommodationMedia,
    accommodations,
    destinations,
    getDb,
    users
} from '@repo/db';
import { type Accommodation, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listingPublicationModel } from '../../../../../packages/db/src/models/listing/listing-publication.model';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { subscribeListingCoverageRecalculation } from '../../../src/utils/listing-publication/coverage-listener';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { testDb } from '../../e2e/setup/test-database';

const accessState = vi.hoisted(() => ({
    covered: true,
    limit: 3,
    listener: undefined as ((event: { userId: string; vertical: string }) => void) | undefined
}));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        billing: {
            coverage: async () => ({ covered: accessState.covered, sources: [] }),
            onCoverageChanged: (
                listener: (event: { userId: string; vertical: string }) => void
            ) => {
                accessState.listener = listener;
                return () => {
                    accessState.listener = undefined;
                };
            }
        },
        effectiveSet: async () => ({ limits: { get: () => accessState.limit } })
    })
}));

const clock = { now: () => new Date('2026-10-10T12:00:00.000Z') };
beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
});
beforeEach(async () => {
    await testDb.clean();
    accessState.covered = true;
    accessState.limit = 3;
});
afterAll(async () => testDb.teardown());

describe('TEST:V6:5 production publication listener', () => {
    it('lowers to the declared limit and restores in the established order', async () => {
        const db = getDb();
        const [user] = await db
            .insert(users)
            .values({
                email: `surplus-${randomUUID()}@example.test`,
                displayName: 'Surplus owner',
                emailVerified: true
            })
            .returning({ id: users.id });
        const [destination] = await db
            .insert(destinations)
            .values({
                name: `Surplus ${randomUUID()}`,
                slug: `surplus-${randomUUID()}`,
                destinationType: 'CITY',
                level: 5,
                path: `/surplus-${randomUUID()}`,
                pathIds: randomUUID(),
                summary: 'Fixture',
                description: 'Fixture',
                location: { coordinates: { lat: '-32.49', long: '-58.23' } }
            })
            .returning({ id: destinations.id });
        if (!user || !destination) throw new Error('Fixture insert failed');
        const listings: Accommodation[] = [];
        for (let index = 0; index < 5; index += 1) {
            const listing = await new AccommodationModel().create(
                {
                    name: `Surplus ${index}`,
                    slug: `surplus-${randomUUID()}`,
                    summary: 'Fixture',
                    description: 'Fixture',
                    ownerId: user.id,
                    destinationId: destination.id,
                    type: 'CABIN',
                    publicationStatus: PublicationStatusEnum.PUBLISHED,
                    extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 }
                } as Partial<Accommodation>,
                db
            );
            listings.push(listing);
            await db.insert(accommodationMedia).values({
                accommodationId: listing.id,
                url: 'https://example.test/surplus-featured.jpg',
                moderationState: 'APPROVED',
                state: 'visible',
                isFeatured: true,
                sortOrder: 0
            });
            await listingPublicationModel.insertStatusChangedEvent({
                tx: db,
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: listing.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'owner',
                actorId: user.id,
                correlationId: randomUUID(),
                occurredAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`)
            });
        }
        const stop = subscribeListingCoverageRecalculation();
        try {
            accessState.limit = 3;
            accessState.listener?.({ userId: user.id, vertical: VerticalEnum.ACCOMMODATION });
            await waitForPublishedCount(user.id, 3);
            accessState.limit = 4;
            accessState.listener?.({ userId: user.id, vertical: VerticalEnum.ACCOMMODATION });
            await waitForPublishedCount(user.id, 4);
            const partial = await db
                .select({
                    id: accommodations.id,
                    publicationStatus: accommodations.publicationStatus
                })
                .from(accommodations)
                .where(eq(accommodations.ownerId, user.id));
            expect(partial.find((row) => row.id === listings[3]?.id)?.publicationStatus).toBe(
                PublicationStatusEnum.PUBLISHED
            );
            expect(partial.find((row) => row.id === listings[4]?.id)?.publicationStatus).toBe(
                PublicationStatusEnum.UNPUBLISHED_BY_BILLING
            );
            accessState.limit = 5;
            accessState.listener?.({ userId: user.id, vertical: VerticalEnum.ACCOMMODATION });
            await waitForPublishedCount(user.id, 5);
            const stored = await db
                .select({
                    id: accommodations.id,
                    publicationStatus: accommodations.publicationStatus
                })
                .from(accommodations)
                .where(and(eq(accommodations.ownerId, user.id)));
            expect(
                stored
                    .filter((row) => row.publicationStatus === PublicationStatusEnum.PUBLISHED)
                    .map((row) => row.id)
                    .sort()
            ).toEqual(listings.map((row) => row.id).sort());
            const instants = await getListingPublicationPorts().unitOfWork.runLocked(
                { userId: user.id, vertical: VerticalEnum.ACCOMMODATION },
                (tx) =>
                    tx.readPublicationInstants({
                        vertical: VerticalEnum.ACCOMMODATION,
                        listingIds: listings.map((row) => row.id)
                    })
            );
            expect(instants.size).toBe(5);
        } finally {
            stop();
        }
    });
});

async function waitForPublishedCount(ownerId: string, expected: number): Promise<void> {
    const db = getDb();
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const rows = await db
            .select({ id: accommodations.id })
            .from(accommodations)
            .where(
                and(
                    eq(accommodations.ownerId, ownerId),
                    eq(accommodations.publicationStatus, PublicationStatusEnum.PUBLISHED)
                )
            );
        if (rows.length === expected) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Expected ${expected} published listings`);
}
