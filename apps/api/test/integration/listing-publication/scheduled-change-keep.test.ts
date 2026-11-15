import { randomUUID } from 'node:crypto';
import {
    AccommodationModel,
    accommodationMedia,
    accommodations,
    billingOptions,
    destinations,
    eq,
    getDb,
    plans,
    planVersionEntitlements,
    planVersionLimits,
    planVersions,
    subscriptions,
    users
} from '@repo/db';
import { type Accommodation, PublicationStatusEnum, VerticalEnum } from '@repo/schemas';
import { and } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { listingPublicationModel } from '../../../../../packages/db/src/models/listing/listing-publication.model';
import { recalculateCoverage } from '../../../../../packages/verticals/src/publication/coverage-recalculation';
import { PUBLICATION_LIMIT_KEYS } from '../../../../../packages/verticals/src/publication/publication-types';
import { injectClock } from '../../../src/utils/clock';
import { validateApiEnv } from '../../../src/utils/env';
import { getListingAccessPorts } from '../../../src/utils/listing-access/ports';
import { getListingPublicationPorts } from '../../../src/utils/listing-publication/ports';
import { createScheduledChangeSurplusStep } from '../../../src/utils/listing-publication/scheduled-change-surplus-step';
import { testDb } from '../../e2e/setup/test-database';

const vertical = VerticalEnum.ACCOMMODATION;
const clock = { now: () => new Date('2026-10-10T12:00:00.000Z') };
const cache = vi.hoisted(() => ({
    values: new Map<string, string>(),
    hashes: new Map<string, Map<string, string>>()
}));
vi.mock('../../../src/utils/redis', () => ({
    getRedisClient: async () => ({
        get: async (key: string) => cache.values.get(key) ?? null,
        hget: async (key: string, field: string) => cache.hashes.get(key)?.get(field) ?? null,
        hset: async (key: string, field: string, value: string) => {
            const hash = cache.hashes.get(key) ?? new Map<string, string>();
            hash.set(field, value);
            cache.hashes.set(key, hash);
            return 1;
        },
        pexpire: async () => 1,
        incr: async (key: string) => {
            const next = Number(cache.values.get(key) ?? '0') + 1;
            cache.values.set(key, String(next));
            return next;
        }
    })
}));
beforeAll(async () => {
    await testDb.setup();
    validateApiEnv();
    injectClock({ clock });
});
beforeEach(async () => {
    await testDb.clean();
    cache.values.clear();
    cache.hashes.clear();
});
afterAll(async () => testDb.teardown());

describe('TEST:B8b:15 scheduled downgrade keep selection', () => {
    it('uses a hot old effective-set cache, keeps the chosen rows, and leaves later reconciliation stable', async () => {
        const db = getDb();
        const [owner] = await db
            .insert(users)
            .values({
                email: `scheduled-keep-${randomUUID()}@example.test`,
                displayName: 'Scheduled keep owner',
                emailVerified: true
            })
            .returning({ id: users.id });
        const [destination] = await db
            .insert(destinations)
            .values({
                name: `Scheduled keep ${randomUUID()}`,
                slug: `scheduled-keep-${randomUUID()}`,
                destinationType: 'CITY',
                level: 5,
                path: '/scheduled-keep',
                pathIds: randomUUID(),
                summary: 'Fixture',
                description: 'Fixture',
                location: { coordinates: { lat: '-32.49', long: '-58.23' } }
            })
            .returning({ id: destinations.id });
        if (!owner || !destination) throw new Error('Fixture insert failed');
        const source = await seedLimitVersion({ limit: 3, suffix: 'source' });
        const target = await seedLimitVersion({ limit: 2, suffix: 'target' });
        const [subscription] = await db
            .insert(subscriptions)
            .values({
                userId: owner.id,
                vertical,
                planVersionId: source.versionId,
                billingOptionId: source.optionId,
                paymentMethod: 'CARD',
                status: 'ACTIVE',
                class: 'PRINCIPAL'
            })
            .returning({ id: subscriptions.id });
        if (!subscription) throw new Error('Subscription insert failed');

        const listings: string[] = [];
        for (let index = 0; index < 3; index += 1) {
            const listing = await new AccommodationModel().create(
                {
                    name: `Scheduled keep listing ${index}`,
                    slug: `scheduled-keep-${randomUUID()}`,
                    summary: 'Fixture',
                    description: 'Fixture description',
                    ownerId: owner.id,
                    destinationId: destination.id,
                    type: 'CABIN',
                    publicationStatus: PublicationStatusEnum.PUBLISHED,
                    extraInfo: { capacity: 4, minNights: 1, bedrooms: 2, bathrooms: 1 }
                } as Partial<Accommodation>,
                db
            );
            listings.push(listing.id);
            await db.insert(accommodationMedia).values({
                accommodationId: listing.id,
                url: `https://example.test/${listing.id}.jpg`,
                moderationState: 'APPROVED',
                state: 'visible',
                isFeatured: true,
                sortOrder: 0
            });
            await listingPublicationModel.insertStatusChangedEvent({
                tx: db,
                vertical,
                listingId: listing.id,
                from: PublicationStatusEnum.DRAFT,
                to: PublicationStatusEnum.PUBLISHED,
                actorType: 'owner',
                actorId: owner.id,
                correlationId: randomUUID(),
                occurredAt: new Date(`2026-01-0${index + 1}T00:00:00.000Z`)
            });
        }

        const oldEffective = await getListingAccessPorts().effectiveSet({
            userId: owner.id,
            vertical
        });
        expect(
            oldEffective.limits.get({
                key: PUBLICATION_LIMIT_KEYS[vertical],
                userId: owner.id,
                vertical
            })
        ).toBe(3);
        await db
            .update(subscriptions)
            .set({
                planVersionId: target.versionId,
                billingOptionId: target.optionId
            })
            .where(eq(subscriptions.id, subscription.id));
        const oldestListingId = listings[0];
        const secondListingId = listings[1];
        const newestListingId = listings[2];
        if (!oldestListingId || !secondListingId || !newestListingId)
            throw new Error('Listing fixture incomplete');
        const keepListingIds = [secondListingId, newestListingId];

        await createScheduledChangeSurplusStep().reconcile({
            userId: owner.id,
            vertical,
            keepListingIds
        });

        const statuses = await db
            .select({ id: accommodations.id, status: accommodations.publicationStatus })
            .from(accommodations)
            .where(eq(accommodations.ownerId, owner.id));
        expect(statuses.find((row) => row.id === oldestListingId)?.status).toBe(
            PublicationStatusEnum.UNPUBLISHED_BY_BILLING
        );
        expect(
            statuses
                .filter((row) => row.status === PublicationStatusEnum.PUBLISHED)
                .map((row) => row.id)
                .sort()
        ).toEqual(keepListingIds.sort());
        await recalculateCoverage({
            ...getListingPublicationPorts(),
            userId: owner.id,
            vertical,
            correlationId: randomUUID()
        });
        const after = await db
            .select({ id: accommodations.id, status: accommodations.publicationStatus })
            .from(accommodations)
            .where(
                and(
                    eq(accommodations.ownerId, owner.id),
                    eq(accommodations.publicationStatus, PublicationStatusEnum.PUBLISHED)
                )
            );
        expect(after.map((row) => row.id).sort()).toEqual(keepListingIds.sort());
    });
});

async function seedLimitVersion(input: { limit: number; suffix: string }) {
    const db = getDb();
    const [plan] = await db
        .insert(plans)
        .values({
            vertical,
            slug: `scheduled-${input.suffix}-${randomUUID()}`,
            name: `Scheduled ${input.suffix}`
        })
        .returning({ id: plans.id });
    if (!plan) throw new Error('Plan fixture insert failed');
    const versionId = await db.transaction(async (tx) => {
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical,
                rank: Math.floor(Math.random() * 100000000) + 1000,
                sellable: false,
                current: false,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Plan version fixture insert failed');
        await tx.insert(planVersionEntitlements).values([
            {
                planVersionId: version.id,
                key: 'publish_accommodations',
                planQuota: null,
                trialQuota: null
            },
            {
                planVersionId: version.id,
                key: 'edit_accommodation_info',
                planQuota: null,
                trialQuota: null
            }
        ]);
        await tx.insert(planVersionLimits).values({
            planVersionId: version.id,
            key: PUBLICATION_LIMIT_KEYS[vertical],
            value: input.limit
        });
        return version.id;
    });
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: versionId,
            cycle: 'monthly',
            amount: input.limit * 10000,
            currency: 'ARS'
        })
        .returning({ id: billingOptions.id });
    if (!option) throw new Error('Billing option fixture insert failed');
    return { versionId, optionId: option.id };
}
