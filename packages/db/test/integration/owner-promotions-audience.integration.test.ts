/**
 * HOS-2590: the accommodation read of owner promotions honours `tourist_audience`.
 *
 * Runs against the real integration database. Before HOS-2590,
 * `findActiveForAccommodation` / `countActiveForAccommodation` ignored the
 * audience column, so a VIP-only promotion reached every public reader.
 */
import type { Accommodation } from '@repo/schemas';
import { TouristAudienceEnum } from '@repo/schemas';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { OwnerPromotionModel } from '../../src/models/owner-promotion/ownerPromotion.model.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const model = new OwnerPromotionModel();

/** Creates an owner, a destination and one accommodation. */
async function fixtures(tx: DrizzleClient) {
    const owner = testData.user();
    const destination = testData.destination();
    await tx.insert(users).values(owner);
    await tx.insert(destinations).values(destination);
    const accommodation = await new AccommodationModel().create(
        {
            summary: 'summary',
            description: 'description',
            ownerId: owner.id,
            destinationId: destination.id,
            name: `H2590 ${crypto.randomUUID()}`,
            slug: `h2590-${crypto.randomUUID()}`,
            type: 'CABIN'
        } as Partial<Accommodation>,
        tx
    );
    return { owner, accommodation };
}

/** Inserts one active accommodation promotion with an explicit audience. */
async function insertPromotion(
    tx: DrizzleClient,
    args: {
        readonly ownerId: string;
        readonly accommodationId: string | null;
        readonly audience: 'plus' | 'vip';
    }
): Promise<string> {
    const result = await tx.execute(
        sql`INSERT INTO owner_promotions
            (slug, owner_id, entity_type, entity_id, accommodation_id, title, discount_type,
             discount_value, lifecycle_state, valid_from, tourist_audience)
            VALUES (${`h2590-${crypto.randomUUID()}`}, ${args.ownerId}, 'accommodation',
                    ${args.accommodationId}, ${args.accommodationId}, 'fixture', 'percentage', 10,
                    'ACTIVE', now() - interval '1 day', ${args.audience})
            RETURNING id`
    );
    return String(result.rows[0]?.id);
}

describe('HOS-2590 owner promotions audience scope (integration)', () => {
    it('returns only PLUS promotions for a PLUS scope, targeted and owner-wide alike', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const { owner, accommodation } = await fixtures(tx);
            const plus = await insertPromotion(tx, {
                ownerId: owner.id,
                accommodationId: accommodation.id,
                audience: 'plus'
            });
            await insertPromotion(tx, {
                ownerId: owner.id,
                accommodationId: accommodation.id,
                audience: 'vip'
            });
            await insertPromotion(tx, {
                ownerId: owner.id,
                accommodationId: null,
                audience: 'vip'
            });
            const params = {
                accommodationId: accommodation.id,
                ownerId: owner.id,
                touristAudiences: [TouristAudienceEnum.PLUS]
            };

            // Act
            const found = await model.findActiveForAccommodation(params, undefined, tx);
            const counted = await model.countActiveForAccommodation(params, tx);

            // Assert
            expect(found.items.map((item) => item.id)).toEqual([plus]);
            expect(found.total).toBe(1);
            expect(counted).toBe(1);
        });
    });

    it('returns PLUS and VIP promotions for a VIP scope', async () => {
        await withTestTransaction(async (tx) => {
            // Arrange
            const { owner, accommodation } = await fixtures(tx);
            const plus = await insertPromotion(tx, {
                ownerId: owner.id,
                accommodationId: accommodation.id,
                audience: 'plus'
            });
            const vip = await insertPromotion(tx, {
                ownerId: owner.id,
                accommodationId: null,
                audience: 'vip'
            });
            const params = {
                accommodationId: accommodation.id,
                ownerId: owner.id,
                touristAudiences: [TouristAudienceEnum.PLUS, TouristAudienceEnum.VIP]
            };

            // Act
            const found = await model.findActiveForAccommodation(params, undefined, tx);
            const counted = await model.countActiveForAccommodation(params, tx);

            // Assert
            expect(found.items.map((item) => item.id).sort()).toEqual([plus, vip].sort());
            expect(counted).toBe(2);
        });
    });
});
