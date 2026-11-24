/**
 * HOS-2270 (release N, expand): the polymorphic target of an owner promotion.
 *
 * Runs against the real integration database (migrations applied from empty) and
 * covers what only SQL can prove:
 * - AC-12: the CHECK rejects a venue promotion without an `entity_id`.
 * - AC-11: a venue promotion is never read as an owner-wide accommodation one.
 * - the dual read: a promotion whose `entity_id` has NOT been copied yet (legacy
 *   `accommodation_id` only) is still found by its accommodation and is NOT
 *   mistaken for an owner-wide one.
 * - the venue quota count ignores accommodation promotions and counts scheduled ones.
 */
import type { Accommodation, Venue } from '@repo/schemas';
import { TouristAudienceEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { OwnerPromotionModel } from '../../src/models/owner-promotion/ownerPromotion.model.ts';
import { VenueModel } from '../../src/models/venue/venue.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const model = new OwnerPromotionModel();

/** Every audience: these cases test the target, not the audience scope (HOS-2590). */
const ALL_AUDIENCES = [TouristAudienceEnum.PLUS, TouristAudienceEnum.VIP] as const;

/** Creates an owner, a destination, one accommodation and one venue. */
async function fixtures(tx: DrizzleClient) {
    const owner = testData.user();
    const destination = testData.destination();
    await tx.insert(users).values(owner);
    await tx.insert(destinations).values(destination);
    const base = {
        summary: 'summary',
        description: 'description',
        ownerId: owner.id,
        destinationId: destination.id
    };
    const accommodation = await new AccommodationModel().create(
        {
            ...base,
            name: `H2270 ${crypto.randomUUID()}`,
            slug: `h2270-${crypto.randomUUID()}`,
            type: 'CABIN'
        } as Partial<Accommodation>,
        tx
    );
    const venue = await new VenueModel().create(
        {
            ...base,
            name: `H2270 ${crypto.randomUUID()}`,
            slug: `h2270-${crypto.randomUUID()}`,
            type: 'RESTAURANT',
            businessLines: ['food']
        } as Partial<Venue>,
        tx
    );
    return { owner, accommodation, venue };
}

/** Inserts one promotion row with raw SQL so every column is explicit. */
async function insertPromotion(
    tx: DrizzleClient,
    args: {
        readonly ownerId: string;
        readonly entityType: 'accommodation' | 'venue';
        readonly entityId: string | null;
        readonly accommodationId?: string | null;
        readonly lifecycleState?: string;
        readonly validFromOffsetDays?: number;
    }
): Promise<string> {
    const result = await tx.execute(
        sql`INSERT INTO owner_promotions
            (slug, owner_id, entity_type, entity_id, accommodation_id, title, discount_type,
             discount_value, lifecycle_state, valid_from)
            VALUES (${`h2270-${crypto.randomUUID()}`}, ${args.ownerId}, ${args.entityType},
                    ${args.entityId}, ${args.accommodationId ?? null}, 'fixture', 'percentage', 10,
                    ${args.lifecycleState ?? 'ACTIVE'},
                    now() + (${args.validFromOffsetDays ?? -1} || ' days')::interval)
            RETURNING id`
    );
    return String(result.rows[0]?.id);
}

describe('HOS-2270 owner promotions entity pair (integration)', () => {
    it('AC-12: the CHECK rejects a venue promotion without entity_id and accepts the valid shapes', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation, venue } = await fixtures(tx);

            await tx.execute(sql`SAVEPOINT before_bad_insert`);
            const failure = await insertPromotion(tx, {
                ownerId: owner.id,
                entityType: 'venue',
                entityId: null
            }).then(
                () => null,
                (error: unknown) => error as { cause?: { constraint?: string; code?: string } }
            );
            await tx.execute(sql`ROLLBACK TO SAVEPOINT before_bad_insert`);
            // The driver error rides in `cause` (23514 = check_violation).
            expect(failure?.cause?.code).toBe('23514');
            expect(failure?.cause?.constraint).toBe('owner_promotions_venue_requires_entity_check');

            await expect(
                insertPromotion(tx, { ownerId: owner.id, entityType: 'venue', entityId: venue.id })
            ).resolves.toBeTypeOf('string');
            await expect(
                insertPromotion(tx, {
                    ownerId: owner.id,
                    entityType: 'accommodation',
                    entityId: accommodation.id,
                    accommodationId: accommodation.id
                })
            ).resolves.toBeTypeOf('string');
            // "All of the owner's accommodations": accommodation type, no target.
            await expect(
                insertPromotion(tx, {
                    ownerId: owner.id,
                    entityType: 'accommodation',
                    entityId: null
                })
            ).resolves.toBeTypeOf('string');
        });
    });

    it('AC-11: a venue promotion of the same owner is never returned for an accommodation', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation, venue } = await fixtures(tx);
            const venuePromotion = await insertPromotion(tx, {
                ownerId: owner.id,
                entityType: 'venue',
                entityId: venue.id
            });

            const found = await model.findActiveForAccommodation(
                {
                    accommodationId: accommodation.id,
                    ownerId: owner.id,
                    touristAudiences: ALL_AUDIENCES
                },
                undefined,
                tx
            );
            const counted = await model.countActiveForAccommodation(
                {
                    accommodationId: accommodation.id,
                    ownerId: owner.id,
                    touristAudiences: ALL_AUDIENCES
                },
                tx
            );

            expect(found.items.map((item) => item.id)).not.toContain(venuePromotion);
            expect(found.total).toBe(0);
            expect(counted).toBe(0);
        });
    });

    it('keeps the owner-wide accommodation promotion working (D-4, unchanged behaviour)', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await fixtures(tx);
            const ownerWide = await insertPromotion(tx, {
                ownerId: owner.id,
                entityType: 'accommodation',
                entityId: null
            });

            const found = await model.findActiveForAccommodation(
                {
                    accommodationId: accommodation.id,
                    ownerId: owner.id,
                    touristAudiences: ALL_AUDIENCES
                },
                undefined,
                tx
            );

            expect(found.items.map((item) => item.id)).toEqual([ownerWide]);
        });
    });

    it('dual read: a legacy-only row is found by its accommodation and is NOT owner-wide', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation } = await fixtures(tx);
            const other = await new AccommodationModel().create(
                {
                    summary: 'summary',
                    description: 'description',
                    ownerId: owner.id,
                    destinationId: accommodation.destinationId,
                    name: `H2270 ${crypto.randomUUID()}`,
                    slug: `h2270-${crypto.randomUUID()}`,
                    type: 'CABIN'
                } as Partial<Accommodation>,
                tx
            );
            // entity_id still NULL: the data-migration has not run yet.
            const legacy = await insertPromotion(tx, {
                ownerId: owner.id,
                entityType: 'accommodation',
                entityId: null,
                accommodationId: accommodation.id
            });

            const own = await model.findActiveForAccommodation(
                {
                    accommodationId: accommodation.id,
                    ownerId: owner.id,
                    touristAudiences: ALL_AUDIENCES
                },
                undefined,
                tx
            );
            const sibling = await model.findActiveForAccommodation(
                { accommodationId: other.id, ownerId: owner.id, touristAudiences: ALL_AUDIENCES },
                undefined,
                tx
            );

            expect(own.items.map((item) => item.id)).toEqual([legacy]);
            expect(sibling.items).toHaveLength(0);
        });
    });

    it('counts only venue promotions that hold a slot, scheduled ones included', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation, venue } = await fixtures(tx);
            await insertPromotion(tx, {
                ownerId: owner.id,
                entityType: 'accommodation',
                entityId: accommodation.id,
                accommodationId: accommodation.id
            });
            await insertPromotion(tx, {
                ownerId: owner.id,
                entityType: 'venue',
                entityId: venue.id
            });
            await insertPromotion(tx, {
                ownerId: owner.id,
                entityType: 'venue',
                entityId: venue.id,
                validFromOffsetDays: 30
            });
            await insertPromotion(tx, {
                ownerId: owner.id,
                entityType: 'venue',
                entityId: venue.id,
                lifecycleState: 'ARCHIVED'
            });

            const count = await model.countActiveForVenueOwner({ ownerId: owner.id }, tx);

            expect(count).toBe(2);
        });
    });

    it('findOneOfVenue answers null for a promotion of another target', async () => {
        await withTestTransaction(async (tx) => {
            const { owner, accommodation, venue } = await fixtures(tx);
            const venuePromotion = await insertPromotion(tx, {
                ownerId: owner.id,
                entityType: 'venue',
                entityId: venue.id
            });
            const accommodationPromotion = await insertPromotion(tx, {
                ownerId: owner.id,
                entityType: 'accommodation',
                entityId: accommodation.id,
                accommodationId: accommodation.id
            });

            const own = await model.findOneOfVenue(
                { promotionId: venuePromotion, venueId: venue.id },
                tx
            );
            const wrongVenue = await model.findOneOfVenue(
                { promotionId: venuePromotion, venueId: crypto.randomUUID() },
                tx
            );
            const wrongType = await model.findOneOfVenue(
                { promotionId: accommodationPromotion, venueId: accommodation.id },
                tx
            );

            expect(own?.id).toBe(venuePromotion);
            expect(wrongVenue).toBeNull();
            expect(wrongType).toBeNull();
        });
    });
});
