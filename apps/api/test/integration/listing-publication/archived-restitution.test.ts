import { randomUUID } from 'node:crypto';
import {
    AccommodationModel,
    accommodations,
    destinations,
    domainEventModel,
    emailOutbox,
    getDb,
    users
} from '@repo/db';
import { type Accommodation, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { archiveInactiveListing } from '../../../../../packages/verticals/src/publication/archive-inactive-listing';
import { LISTING_ARCHIVED_TEMPLATE } from '../../../../../packages/verticals/src/publication/archive-notices';
import { LISTING_RESTITUTION_TEMPLATE } from '../../../../../packages/verticals/src/publication/publication-notices';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { subscribeListingCoverageRecalculation } from '../../../src/utils/listing-publication/coverage-listener';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { testDb } from '../../e2e/setup/test-database';

const state = vi.hoisted(() => ({
    covered: true,
    limit: 1,
    listener: undefined as ((event: { userId: string; vertical: string }) => void) | undefined
}));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        billing: {
            coverage: async () => ({ covered: state.covered, sources: [] }),
            retentionStopped: async () => ({
                stopped: false,
                pauseEndedAt: null,
                coverageLostAt: null
            }),
            onCoverageChanged: (
                listener: (event: { userId: string; vertical: string }) => void
            ) => {
                state.listener = listener;
                return () => {
                    state.listener = undefined;
                };
            }
        },
        effectiveSet: async () => ({ limits: { get: () => state.limit } }),
        loadFacts: async () => ({ facts: null, ownerId: null })
    })
}));

const now = new Date('2026-10-11T05:00:00.000Z');
beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => now } });
});
beforeEach(async () => {
    await testDb.clean();
    state.covered = true;
    state.limit = 1;
    state.listener = undefined;
});
afterAll(async () => testDb.teardown());

describe('TEST:V6:10 PB7 restitution from archived origins', () => {
    it('TEST:V6:10 restores only the PB4 origin on notice and names it in the outbox', async () => {
        const { ownerId, pb4, pb5 } = await createArchivedPair();
        const stop = subscribeListingCoverageRecalculation();
        try {
            state.listener?.({ userId: ownerId, vertical: VerticalEnum.ACCOMMODATION });
            await waitForStatus(pb4, PublicationStatusEnum.PUBLISHED);
            const [pb5Row] = await getDb()
                .select({ status: accommodations.publicationStatus })
                .from(accommodations)
                .where(eq(accommodations.id, pb5));
            expect(pb5Row?.status).toBe(PublicationStatusEnum.ARCHIVED);
            const notices = await getDb()
                .select()
                .from(emailOutbox)
                .where(eq(emailOutbox.recipientUserId, ownerId));
            const restitutions = notices.filter(
                (notice) => notice.template === LISTING_RESTITUTION_TEMPLATE
            );
            expect(restitutions).toHaveLength(1);
            expect(restitutions[0]?.template).toBe(LISTING_RESTITUTION_TEMPLATE);
            expect(restitutions[0]?.payload).toMatchObject({ restoredListingIds: [pb4] });
            const archivedNotices = notices.filter(
                (notice) => notice.template === LISTING_ARCHIVED_TEMPLATE
            );
            expect(archivedNotices).toHaveLength(2);
            expect(
                archivedNotices.map((notice) => ({
                    transition: notice.payload.transition,
                    listingId: notice.payload.listingId
                }))
            ).toEqual(
                expect.arrayContaining([
                    { transition: 'PB4', listingId: pb4 },
                    { transition: 'PB5', listingId: pb5 }
                ])
            );
            expect(notices).toHaveLength(3);
            const events = await domainEventModel.findByEntity({
                tx: getDb(),
                entityType: VerticalEnum.ACCOMMODATION,
                entityId: pb4
            });
            expect(
                events.some((event) =>
                    event.changes.some(
                        (change) =>
                            change.field === 'publicationStatus' &&
                            change.old === PublicationStatusEnum.ARCHIVED &&
                            change.new === PublicationStatusEnum.PUBLISHED
                    )
                )
            ).toBe(true);
        } finally {
            stop();
        }
    });
});

async function createArchivedPair(): Promise<{ ownerId: string; pb4: string; pb5: string }> {
    const db = getDb();
    const [owner] = await db
        .insert(users)
        .values({
            email: `archived-return-${randomUUID()}@example.test`,
            displayName: 'Archived return owner',
            emailVerified: true
        })
        .returning({ id: users.id });
    const [destination] = await db
        .insert(destinations)
        .values({
            name: `Archived ${randomUUID()}`,
            slug: `archived-${randomUUID()}`,
            destinationType: 'CITY',
            level: 5,
            path: `/archived-${randomUUID()}`,
            pathIds: randomUUID(),
            summary: 'Fixture',
            description: 'Fixture',
            location: { coordinates: { lat: '-32.49', long: '-58.23' } }
        })
        .returning({ id: destinations.id });
    if (!owner || !destination) throw new Error('Archived restitution fixture insert failed');
    const make = async (
        status: typeof PublicationStatusEnum.PUBLISHED | typeof PublicationStatusEnum.DRAFT
    ) => {
        const row = await new AccommodationModel().create(
            {
                name: 'Archived fixture',
                slug: `archived-${randomUUID()}`,
                summary: 'Fixture',
                description: 'Fixture',
                ownerId: owner.id,
                destinationId: destination.id,
                type: 'CABIN',
                publicationStatus: status
            } as Partial<Accommodation>,
            db
        );
        await db
            .update(accommodations)
            .set({ inactiveSince: new Date(now.getTime() - 120 * 86_400_000) })
            .where(eq(accommodations.id, row.id));
        const ports = getListingPublicationPorts();
        const archived = await archiveInactiveListing({
            ...ports,
            billing: {
                ...ports.billing,
                coverage: async () => ({ covered: false, sources: [] }),
                retentionStopped: async () => ({
                    stopped: false,
                    pauseEndedAt: null,
                    coverageLostAt: null
                })
            },
            clock: { now: () => now },
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: row.id,
            ownerId: owner.id,
            correlationId: randomUUID()
        });
        if (!archived.archived) throw new Error('Expected archive fixture to archive');
        return row.id;
    };
    return {
        ownerId: owner.id,
        pb4: await make(PublicationStatusEnum.PUBLISHED),
        pb5: await make(PublicationStatusEnum.DRAFT)
    };
}

async function waitForStatus(id: string, expected: PublicationStatusEnum): Promise<void> {
    for (let attempt = 0; attempt < 40; attempt += 1) {
        const [row] = await getDb()
            .select({ status: accommodations.publicationStatus })
            .from(accommodations)
            .where(eq(accommodations.id, id));
        if (row?.status === expected) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Listing ${id} did not reach ${expected}`);
}
