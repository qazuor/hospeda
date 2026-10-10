import { randomUUID } from 'node:crypto';
import {
    AccommodationModel,
    accommodations,
    destinations,
    getDb,
    plans,
    planVersions,
    trials,
    users
} from '@repo/db';
import { type Accommodation, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { computeTrialEmailPseudonym } from '@repo/service-core';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { recalculateCoverage } from '../../../../../packages/verticals/src/publication/coverage-recalculation';
import { publishListing } from '../../../../../packages/verticals/src/publication/publish-listing';
import { unpublishListing } from '../../../../../packages/verticals/src/publication/unpublish-listing';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { testDb } from '../../e2e/setup/test-database';

const now = new Date('2026-10-10T12:00:00.000Z');
const clock = { now: () => now };

beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
});
beforeEach(async () => testDb.clean());
afterAll(async () => testDb.teardown());

describe('TEST:V6 API coverage recalculation', () => {
    it('lowers a published accommodation through PB2 under the production lock', async () => {
        const db = getDb();
        const [user] = await db
            .insert(users)
            .values({
                email: `listing-publication-${randomUUID()}@example.test`,
                displayName: 'Publication owner',
                emailVerified: true
            })
            .returning({ id: users.id, email: users.email });
        const [destination] = await db
            .insert(destinations)
            .values({
                name: `Publication ${randomUUID()}`,
                slug: `publication-${randomUUID()}`,
                destinationType: 'CITY',
                level: 5,
                path: '/publication',
                pathIds: randomUUID(),
                summary: 'Publication fixture',
                description: 'Publication fixture destination',
                location: { coordinates: { lat: '-32.49', long: '-58.23' } }
            })
            .returning({ id: destinations.id });
        if (!user || !destination) throw new Error('Fixture insert failed');
        const accommodation = await new AccommodationModel().create(
            {
                name: 'Publication fixture',
                slug: `publication-${randomUUID()}`,
                summary: 'Publication fixture',
                description: 'Publication fixture description',
                ownerId: user.id,
                destinationId: destination.id,
                type: 'CABIN',
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                lifecycleState: 'ACTIVE',
                visibility: 'PUBLIC'
            } as Partial<Accommodation>,
            db
        );
        const otherIds: string[] = [];
        for (const status of [
            PublicationStatusEnum.DRAFT,
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        ]) {
            const other = await new AccommodationModel().create(
                {
                    name: 'Publication fixture',
                    slug: `publication-${randomUUID()}`,
                    summary: 'Publication fixture',
                    description: 'Publication fixture description',
                    ownerId: user.id,
                    destinationId: destination.id,
                    type: 'CABIN',
                    publicationStatus: status,
                    lifecycleState: 'INACTIVE',
                    visibility: 'PRIVATE'
                } as Partial<Accommodation>,
                db
            );
            otherIds.push(other.id);
        }

        await recalculateCoverage({
            ...getListingPublicationPorts(),
            userId: user.id,
            vertical: VerticalEnum.ACCOMMODATION,
            correlationId: randomUUID()
        });

        const [stored] = await db
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, accommodation.id));
        expect(stored?.publicationStatus).toBe(PublicationStatusEnum.UNPUBLISHED_BY_BILLING);
        const stamped = await db
            .select({ id: accommodations.id, inactiveSince: accommodations.inactiveSince })
            .from(accommodations)
            .where(eq(accommodations.ownerId, user.id));
        expect(stamped).toHaveLength(3);
        expect(stamped.every((row) => row.inactiveSince?.toISOString() === now.toISOString())).toBe(
            true
        );
        expect(otherIds).toHaveLength(2);
    });

    it('serializes simultaneous PB1 calls and starts only one T1', async () => {
        const db = getDb();
        const email = `pb1-${randomUUID()}@example.test`;
        const [user] = await db
            .insert(users)
            .values({ email, displayName: 'PB1 owner' })
            .returning({ id: users.id, email: users.email });
        const [destination] = await db
            .insert(destinations)
            .values({
                name: `PB1 ${randomUUID()}`,
                slug: `pb1-${randomUUID()}`,
                destinationType: 'CITY',
                level: 5,
                path: '/pb1',
                pathIds: randomUUID(),
                summary: 'PB1 fixture',
                description: 'PB1 fixture destination',
                location: { coordinates: { lat: '-32.49', long: '-58.23' } }
            })
            .returning({ id: destinations.id });
        if (!user || !destination) throw new Error('Fixture insert failed');
        const [trialPlan] = await db
            .select({ id: plans.id })
            .from(plans)
            .where(and(eq(plans.vertical, VerticalEnum.ACCOMMODATION), eq(plans.role, 'trial')))
            .limit(1);
        const [trialVersion] = trialPlan
            ? await db
                  .select({ id: planVersions.id })
                  .from(planVersions)
                  .where(and(eq(planVersions.planId, trialPlan.id), eq(planVersions.current, true)))
                  .limit(1)
            : [];
        const [sellableVersion] = await db
            .select({ id: planVersions.id })
            .from(planVersions)
            .where(
                and(
                    eq(planVersions.vertical, VerticalEnum.ACCOMMODATION),
                    eq(planVersions.sellable, true),
                    eq(planVersions.current, true)
                )
            )
            .limit(1);
        if (!trialPlan || !trialVersion || !sellableVersion)
            throw new Error('Trial catalog fixture insert failed');
        const listingIds = await Promise.all(
            [0, 1].map(async () => {
                const listing = await new AccommodationModel().create(
                    {
                        name: 'PB1 fixture',
                        slug: `pb1-${randomUUID()}`,
                        summary: 'PB1 fixture',
                        description: 'PB1 fixture description',
                        ownerId: user.id,
                        destinationId: destination.id,
                        type: 'CABIN',
                        publicationStatus: PublicationStatusEnum.DRAFT,
                        lifecycleState: 'INACTIVE',
                        visibility: 'PRIVATE'
                    } as Partial<Accommodation>,
                    db
                );
                return listing.id;
            })
        );
        const pseudonym = computeTrialEmailPseudonym({ email: user.email });
        if (!pseudonym.ok) throw new Error('Fixture email was rejected');

        const result = await Promise.all(
            listingIds.map((listingId) =>
                publishListing({
                    ...getListingPublicationPorts(),
                    userId: user.id,
                    vertical: VerticalEnum.ACCOMMODATION,
                    listingId,
                    event: 'listing_published',
                    emailPseudonym: pseudonym.pseudonym,
                    correlationId: randomUUID()
                })
            )
        );

        expect(result.filter((entry) => entry.published)).toHaveLength(1);
        const storedPublished = await db
            .select()
            .from(accommodations)
            .where(
                and(
                    eq(accommodations.ownerId, user.id),
                    eq(accommodations.publicationStatus, PublicationStatusEnum.PUBLISHED)
                )
            );
        expect(storedPublished).toHaveLength(1);
        const publishedId = storedPublished[0]?.id;
        if (!publishedId) throw new Error('PB1 did not leave a published listing');
        const unpublish = await unpublishListing({
            ...getListingPublicationPorts(),
            userId: user.id,
            vertical: VerticalEnum.ACCOMMODATION,
            listingId: publishedId,
            correlationId: randomUUID()
        });
        expect(unpublish.unpublished).toBe(true);
        const [stored] = await db
            .select()
            .from(accommodations)
            .where(eq(accommodations.id, publishedId));
        const [trial] = await db.select().from(trials).where(eq(trials.userId, user.id));
        expect(stored?.publicationStatus).toBe(PublicationStatusEnum.DRAFT);
        expect(trial?.status).toBe('TRIAL_ACTIVE');
    });
});
