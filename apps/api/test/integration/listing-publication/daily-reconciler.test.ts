import { randomUUID } from 'node:crypto';
import {
    AccommodationModel,
    accommodations,
    destinations,
    domainEventModel,
    emailOutbox,
    getDb,
    trials,
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
import { createTrial } from './publication-routes.helpers';

const state = vi.hoisted(() => ({
    uncoveredUserId: '',
    liveTrialVersionId: '',
    staleCacheUserId: '',
    invalidatedUserIds: [] as string[],
    scheduledRevalidations: [] as unknown[]
}));
vi.mock('../../../src/utils/listing-access/ports', () => ({
    getListingAccessPorts: () => ({
        billing: {
            coverage: async ({ userId }: { readonly userId: string }) => ({
                covered: userId !== state.uncoveredUserId,
                sources:
                    userId === state.staleCacheUserId
                        ? [
                              {
                                  type: 'TRIAL',
                                  reference: {
                                      kind: 'PLAN_VERSION',
                                      planVersionId: state.liveTrialVersionId
                                  },
                                  scope: 'VERTICAL',
                                  target: null,
                                  since: now,
                                  until: new Date(now.getTime() + 86_400_000),
                                  charged: null,
                                  floor: null
                              }
                          ]
                        : []
            }),
            onCoverageChanged: () => () => {}
        },
        effectiveSet: async () => {
            throw new Error('cached effective set must not be used');
        },
        loadFacts: async () => ({ facts: null, ownerId: null })
    })
}));
vi.mock('../../../src/utils/effective-set-cache', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../src/utils/effective-set-cache')>();
    return {
        ...actual,
        peekEffectiveSetForUser: async ({
            userId,
            vertical
        }: {
            userId: string;
            vertical: string;
        }) =>
            userId === state.staleCacheUserId
                ? {
                      version: 1,
                      userId,
                      vertical,
                      hasLiveNonTrialTitle: false,
                      inheritsTouristVip: false,
                      entries: []
                  }
                : actual.peekEffectiveSetForUser({ userId, vertical }),
        invalidateEffectiveSetsForUser: async (userId: string) => {
            state.invalidatedUserIds.push(userId);
            return actual.invalidateEffectiveSetsForUser(userId);
        }
    };
});
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        getRevalidationService: () => ({
            scheduleRevalidation: (input: unknown) => state.scheduledRevalidations.push(input)
        })
    };
});

const now = new Date('2026-10-11T05:00:00.000Z');
beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock: { now: () => now } });
});
beforeEach(async () => {
    state.uncoveredUserId = '';
    state.liveTrialVersionId = '';
    state.staleCacheUserId = '';
    state.invalidatedUserIds = [];
    state.scheduledRevalidations = [];
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

    it('restores a covered candidate with the live limit, queues notice, and runs production effects', async () => {
        const db = getDb();
        const [owner] = await db
            .insert(users)
            .values({
                email: `reconciler-pb3-${randomUUID()}@example.test`,
                displayName: 'Reconciler PB3 owner'
            })
            .returning({ id: users.id });
        const [destination] = await db
            .insert(destinations)
            .values({
                name: `Reconciler PB3 ${randomUUID()}`,
                slug: `reconciler-pb3-${randomUUID()}`,
                destinationType: 'CITY',
                level: 5,
                path: '/reconciler-pb3',
                pathIds: randomUUID(),
                summary: 'Reconciler PB3',
                description: 'Reconciler PB3 fixture',
                location: { coordinates: { lat: '-32.49', long: '-58.23' } }
            })
            .returning({ id: destinations.id });
        if (!owner || !destination) throw new Error('reconciler PB3 fixture insert failed');

        await createTrial({ userId: owner.id, status: 'TRIAL_ACTIVE' });
        state.staleCacheUserId = owner.id;
        const [trial] = await db
            .select({ floorTrialPlanVersionId: trials.floorTrialPlanVersionId })
            .from(trials)
            .where(eq(trials.userId, owner.id))
            .limit(1);
        if (!trial?.floorTrialPlanVersionId) throw new Error('active trial fixture missing');
        state.liveTrialVersionId = trial.floorTrialPlanVersionId;
        const listing = await new AccommodationModel().create(
            {
                name: 'Reconciler PB3 listing',
                slug: `reconciler-pb3-${randomUUID()}`,
                summary: 'Listing',
                description: 'Fixture',
                ownerId: owner.id,
                destinationId: destination.id,
                type: 'CABIN',
                publicationStatus: PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
                lifecycleState: 'INACTIVE',
                visibility: 'PRIVATE'
            } as Partial<Accommodation>,
            db
        );

        const ports = getListingReconcilerPorts();
        const liveLimit = await ports.liveLimit({
            userId: owner.id,
            vertical: VerticalEnum.ACCOMMODATION
        });
        expect(liveLimit).not.toBeNull();
        expect(liveLimit).toBeGreaterThan(0);
        const result = await runDailyCoverageReconciler({ ports });

        expect(result.complete).toBe(true);
        expect(result.restored).toBe(1);
        const [stored] = await db
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, listing.id));
        expect(stored?.publicationStatus).toBe(PublicationStatusEnum.PUBLISHED);
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
                        change.new === PublicationStatusEnum.PUBLISHED
                )
            )
        ).toBe(true);
        const notices = await db
            .select()
            .from(emailOutbox)
            .where(eq(emailOutbox.recipientUserId, owner.id));
        expect(notices).toHaveLength(1);
        expect(notices[0]?.payload).toMatchObject({ restoredListingIds: [listing.id] });
        expect(state.invalidatedUserIds).toContain(owner.id);
        expect(state.scheduledRevalidations).toContainEqual(
            expect.objectContaining({ id: listing.id, entityType: VerticalEnum.ACCOMMODATION })
        );
    });
});
