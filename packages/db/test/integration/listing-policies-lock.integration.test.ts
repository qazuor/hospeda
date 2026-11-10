// HOS-2060 — `listingPoliciesModel.readForUpdate` really locks the row, so two
// concurrent `policies` merges serialise instead of losing one page's key.
import type { Accommodation } from '@repo/schemas';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccommodationModel } from '../../src/models/accommodation/accommodation.model.ts';
import { listingPoliciesModel } from '../../src/models/listing/listing-policies.model.ts';
import { accommodations } from '../../src/schemas/accommodation/accommodation.dbschema.ts';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, getTestDb, getTestPool, testData } from './helpers.ts';

const owner = testData.user();
const destination = testData.destination();
let listingId = '';

beforeAll(async () => {
    // Committed rows: the competing connection must see them.
    const db = getTestDb();
    await db.insert(users).values(owner);
    await db.insert(destinations).values(destination);
    const created = await new AccommodationModel().create(
        {
            name: 'Lock fixture',
            slug: `lock-${crypto.randomUUID()}`,
            summary: 'summary',
            description: 'description',
            type: 'CABIN',
            ownerId: owner.id,
            destinationId: destination.id,
            policies: { paymentMethods: ['cash'], minNights: 2 }
        } as Partial<Accommodation>,
        db
    );
    listingId = created.id;
});

afterAll(async () => {
    const db = getTestDb();
    if (listingId) await db.delete(accommodations).where(eq(accommodations.id, listingId));
    await db.delete(destinations).where(eq(destinations.id, destination.id));
    await db.delete(users).where(eq(users.id, owner.id));
    await closeTestPool();
});

describe('listingPoliciesModel.readForUpdate', () => {
    it('returns the stored policies', async () => {
        // Act
        const result = await getTestDb().transaction(async (tx) =>
            listingPoliciesModel.readForUpdate({
                tx: tx as unknown as DrizzleClient,
                vertical: 'accommodation',
                listingId
            })
        );

        // Assert
        expect(result).toEqual({
            found: true,
            policies: { paymentMethods: ['cash'], minNights: 2 }
        });
    });

    it('reports a missing row', async () => {
        // Act
        const result = await getTestDb().transaction(async (tx) =>
            listingPoliciesModel.readForUpdate({
                tx: tx as unknown as DrizzleClient,
                vertical: 'venue',
                listingId: crypto.randomUUID()
            })
        );

        // Assert
        expect(result).toEqual({ found: false, policies: null });
    });

    it('holds the row lock until commit: a competing FOR UPDATE cannot take it', async () => {
        // Arrange
        const competitor = await getTestPool().connect();
        try {
            await getTestDb().transaction(async (tx) => {
                // Act: the first merge reads under the lock and keeps the tx open.
                await listingPoliciesModel.readForUpdate({
                    tx: tx as unknown as DrizzleClient,
                    vertical: 'accommodation',
                    listingId
                });

                // Assert: a second merge on another connection is blocked.
                await competitor.query('BEGIN');
                await competitor.query(`SET LOCAL lock_timeout = '300ms'`);
                await expect(
                    competitor.query(
                        'SELECT policies FROM accommodations WHERE id = $1 FOR UPDATE',
                        [listingId]
                    )
                ).rejects.toMatchObject({ code: '55P03' });
                await competitor.query('ROLLBACK');
                await tx.execute(sql`SELECT 1`);
            });
        } finally {
            competitor.release();
        }
    });
});
