import { randomUUID } from 'node:crypto';
import {
    AccommodationModel,
    accommodations,
    destinations,
    domainEventModel,
    getDb,
    users
} from '@repo/db';
import { type Accommodation, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runDailyCoverageReconciler } from '../../../../../packages/verticals/src/publication/coverage-reconciler';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingReconcilerPorts } from '../../../src/utils/listing-publication/reconciler-ports';
import { testDb } from '../../e2e/setup/test-database';

const state = vi.hoisted(() => ({ uncoveredUserId: '' }));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        billing: {
            coverage: async ({ userId }: { readonly userId: string }) => ({
                covered: userId !== state.uncoveredUserId,
                sources: []
            }),
            onCoverageChanged: () => () => {}
        },
        effectiveSet: async () => {
            throw new Error('cached effective set must not be used');
        },
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
    state.uncoveredUserId = '';
    await testDb.clean();
});
afterAll(async () => testDb.teardown());

/** TEST:V6:7 exercises the production DB composition for a lost coverage notice. */
describe('TEST:V6:7 API daily coverage reconciler', () => {
    it('lowers an uncovered published listing through the production ports', async () => {
        const db = getDb();
        const [owner] = await db
            .insert(users)
            .values({
                email: `reconciler-${randomUUID()}@example.test`,
                displayName: 'Reconciler owner'
            })
            .returning({ id: users.id });
        const [destination] = await db
            .insert(destinations)
            .values({
                name: `Reconciler ${randomUUID()}`,
                slug: `reconciler-${randomUUID()}`,
                destinationType: 'CITY',
                level: 5,
                path: '/reconciler',
                pathIds: randomUUID(),
                summary: 'Reconciler',
                description: 'Reconciler fixture',
                location: { coordinates: { lat: '-32.49', long: '-58.23' } }
            })
            .returning({ id: destinations.id });
        if (!owner || !destination) throw new Error('reconciler fixture insert failed');
        state.uncoveredUserId = owner.id;
        const listing = await new AccommodationModel().create(
            {
                name: 'Reconciler listing',
                slug: `reconciler-${randomUUID()}`,
                summary: 'Listing',
                description: 'Fixture',
                ownerId: owner.id,
                destinationId: destination.id,
                type: 'CABIN',
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC'
            } as Partial<Accommodation>,
            db
        );
        const result = await runDailyCoverageReconciler({ ports: getListingReconcilerPorts() });
        expect(result.complete).toBe(true);
        expect(result.lowered).toBe(1);
        const [stored] = await db
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, listing.id));
        expect(stored?.publicationStatus).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
        expect(stored?.inactiveSince.toISOString()).toBe(now.toISOString());
        const events = await domainEventModel.findByEntity({
            tx: db,
            entityType: VerticalEnum.ACCOMMODATION,
            entityId: listing.id
        });
        expect(
            events.some((event) =>
                event.changes.some(
                    (change) =>
                        change.field === 'publicationStatus' &&
                        change.new === PublicationStatusEnum.UNPUBLISHED_BY_BILLING
                )
            )
        ).toBe(true);
    });
});
