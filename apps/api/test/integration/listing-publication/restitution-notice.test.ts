import { randomUUID } from 'node:crypto';
import {
    AccommodationModel,
    accommodationMedia,
    accommodations,
    destinations,
    emailOutbox,
    getDb,
    users
} from '@repo/db';
import { type Accommodation, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listingPublicationModel } from '../../../../../packages/db/src/models/listing/listing-publication.model';
import { LISTING_RESTITUTION_TEMPLATE } from '../../../../../packages/verticals/src/publication/publication-notices';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { subscribeListingCoverageRecalculation } from '../../../src/utils/listing-publication/coverage-listener';
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

describe('TEST:V6:5 restitution notice outbox', () => {
    it('HOS-1744 leaves an incomplete billing-unpublished listing out when coverage activates', async () => {
        const { ownerId, listingIds } = await createFixture();
        const db = getDb();
        // The incomplete candidate is older, so it wins the only available slot without the filter.
        const completeId = listingIds[4];
        const incompleteId = listingIds[3];
        if (!completeId || !incompleteId) throw new Error('Fixture candidates missing');
        await db
            .update(accommodations)
            .set({ publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING })
            .where(and(eq(accommodations.id, completeId), eq(accommodations.ownerId, ownerId)));
        await db
            .update(accommodations)
            .set({
                publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                extraInfo: null
            })
            .where(and(eq(accommodations.id, incompleteId), eq(accommodations.ownerId, ownerId)));

        const stop = subscribeListingCoverageRecalculation();
        try {
            accessState.limit = 4;
            accessState.listener?.({ userId: ownerId, vertical: VerticalEnum.ACCOMMODATION });
            await waitForPublished(ownerId, 4);
            const statuses = await db
                .select({
                    id: accommodations.id,
                    publicationStatus: accommodations.publicationStatus
                })
                .from(accommodations)
                .where(and(eq(accommodations.ownerId, ownerId)));
            expect(statuses.find((row) => row.id === completeId)?.publicationStatus).toBe(
                PublicationStatusEnum.PUBLISHED
            );
            expect(statuses.find((row) => row.id === incompleteId)?.publicationStatus).toBe(
                PublicationStatusEnum.UNPUBLISHED_BY_BILLING
            );
            const rows = await waitForOutbox(ownerId, 1);
            expect(rows[0]?.payload).toMatchObject({
                restoredListingIds: [completeId],
                notRestoredListingIds: []
            });
        } finally {
            stop();
        }
    });

    it('queues one pending notice with returned ids and deduplicates a no-change pass', async () => {
        const { ownerId, listingIds } = await createFixture();
        const stop = subscribeListingCoverageRecalculation();
        try {
            accessState.listener?.({ userId: ownerId, vertical: VerticalEnum.ACCOMMODATION });
            await waitForPublished(ownerId, 3);
            accessState.limit = 5;
            accessState.listener?.({ userId: ownerId, vertical: VerticalEnum.ACCOMMODATION });
            const rows = await waitForOutbox(ownerId, 1);
            expect(rows).toHaveLength(1);
            const notice = rows[0];
            expect(notice?.template).toBe(LISTING_RESTITUTION_TEMPLATE);
            expect(notice?.recipientEmail).toMatch(/^restitution-/);
            expect(notice?.status).toBe('pending');
            expect(notice?.payload).toMatchObject({
                vertical: VerticalEnum.ACCOMMODATION,
                restoredListingIds: listingIds.slice(3),
                notRestoredListingIds: [],
                criterion: 'LAST_FELL_FIRST_BACK'
            });
            accessState.listener?.({ userId: ownerId, vertical: VerticalEnum.ACCOMMODATION });
            await waitForPublished(ownerId, 5);
            expect(await readOutbox(ownerId)).toHaveLength(1);
        } finally {
            stop();
        }
    });

    it('completes restitution without an outbox row when the owner has no email', async () => {
        const { ownerId } = await createFixture();
        await getDb().update(users).set({ email: '' }).where(eq(users.id, ownerId));
        const stop = subscribeListingCoverageRecalculation();
        try {
            accessState.listener?.({ userId: ownerId, vertical: VerticalEnum.ACCOMMODATION });
            await waitForPublished(ownerId, 3);
            accessState.limit = 5;
            accessState.listener?.({ userId: ownerId, vertical: VerticalEnum.ACCOMMODATION });
            await waitForPublished(ownerId, 5);
            expect(await readOutbox(ownerId)).toHaveLength(0);
        } finally {
            stop();
        }
    });
});

async function createFixture(): Promise<{ ownerId: string; listingIds: string[] }> {
    const db = getDb();
    const [owner] = await db
        .insert(users)
        .values({
            email: `restitution-${randomUUID()}@example.test`,
            displayName: 'Restitution owner',
            emailVerified: true
        })
        .returning({ id: users.id });
    const [destination] = await db
        .insert(destinations)
        .values({
            name: `Restitution ${randomUUID()}`,
            slug: `restitution-${randomUUID()}`,
            destinationType: 'CITY',
            level: 5,
            path: `/restitution-${randomUUID()}`,
            pathIds: randomUUID(),
            summary: 'Fixture',
            description: 'Fixture',
            location: { coordinates: { lat: '-32.49', long: '-58.23' } }
        })
        .returning({ id: destinations.id });
    if (!owner || !destination) throw new Error('Fixture insert failed');
    const listingIds: string[] = [];
    for (let index = 0; index < 5; index += 1) {
        const listing = await new AccommodationModel().create(
            {
                name: `Restitution ${index}`,
                slug: `restitution-${randomUUID()}`,
                summary: 'Fixture',
                description: 'Fixture',
                ownerId: owner.id,
                destinationId: destination.id,
                type: 'CABIN',
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 }
            } as Partial<Accommodation>,
            db
        );
        listingIds.push(listing.id);
        await db.insert(accommodationMedia).values({
            accommodationId: listing.id,
            url: 'https://example.test/restitution-featured.jpg',
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
            actorId: owner.id,
            correlationId: randomUUID(),
            occurredAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`)
        });
    }
    return { ownerId: owner.id, listingIds };
}

async function readOutbox(ownerId: string) {
    return getDb()
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.template, LISTING_RESTITUTION_TEMPLATE),
                eq(emailOutbox.recipientUserId, ownerId)
            )
        );
}
async function waitForOutbox(ownerId: string, expected: number) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const rows = await readOutbox(ownerId);
        if (rows.length === expected) return rows;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Expected ${expected} restitution outbox row(s)`);
}
async function waitForPublished(ownerId: string, expected: number): Promise<void> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const rows = await getDb()
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
