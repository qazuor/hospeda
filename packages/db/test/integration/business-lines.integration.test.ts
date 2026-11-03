import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

async function setup(tx: DrizzleClient) {
    const owner = testData.user();
    const destination = testData.destination();
    await tx.insert(users).values(owner);
    await tx.insert(destinations).values(destination);
    return { ownerId: owner.id, destinationId: destination.id };
}

describe('TEST:2.3:2 AC:2:4 business_lines PostgreSQL constraints', () => {
    it('rejects an empty array, a foreign vertical value, and food on BOLICHE', async () => {
        await withTestTransaction(async (tx) => {
            const { ownerId, destinationId } = await setup(tx);
            const assertRejected = async (type: string, values: string) => {
                await expect(
                    tx.execute(
                        sql.raw(
                            `INSERT INTO venues (slug,name,summary,description,type,owner_id,destination_id,business_lines) VALUES ('bl-${crypto.randomUUID()}','n','s','d','${type}','${ownerId}','${destinationId}',${values})`
                        )
                    )
                ).rejects.toThrow();
            };
            await assertRejected('RESTAURANT', "'{}'::text[]");
        });
    });

    it('rejects values outside the venue vertical catalog', async () => {
        await withTestTransaction(async (tx) => {
            const { ownerId, destinationId } = await setup(tx);
            await expect(
                tx.execute(
                    sql.raw(
                        `INSERT INTO venues (slug,name,summary,description,type,owner_id,destination_id,business_lines) VALUES ('bl-${crypto.randomUUID()}','n','s','d','RESTAURANT','${ownerId}','${destinationId}',ARRAY['standard']::text[])`
                    )
                )
            ).rejects.toThrow();
        });
    });

    it('rejects food on BOLICHE', async () => {
        await withTestTransaction(async (tx) => {
            const { ownerId, destinationId } = await setup(tx);
            await expect(
                tx.execute(
                    sql.raw(
                        `INSERT INTO venues (slug,name,summary,description,type,owner_id,destination_id,business_lines) VALUES ('bl-${crypto.randomUUID()}','n','s','d','BOLICHE','${ownerId}','${destinationId}',ARRAY['food']::text[])`
                    )
                )
            ).rejects.toThrow();
        });
    });

    it('rejects business lines outside the venue type matrix', async () => {
        await withTestTransaction(async (tx) => {
            const { ownerId, destinationId } = await setup(tx);
            await expect(
                tx.execute(
                    sql.raw(
                        `INSERT INTO venues (slug,name,summary,description,type,owner_id,destination_id,business_lines) VALUES ('bl-${crypto.randomUUID()}','n','s','d','CAFE','${ownerId}','${destinationId}',ARRAY['nightlife']::text[])`
                    )
                )
            ).rejects.toThrow();
        });
    });

    it('defaults accommodation business_lines to standard', async () => {
        await withTestTransaction(async (tx) => {
            const { ownerId, destinationId } = await setup(tx);
            const result = await tx.execute(
                sql.raw(
                    `INSERT INTO accommodations (slug,name,summary,description,type,owner_id,destination_id) VALUES ('bl-${crypto.randomUUID()}','n','s','d','CABIN','${ownerId}','${destinationId}') RETURNING business_lines`
                )
            );
            expect(result.rows[0]?.business_lines).toEqual(['standard']);
        });
    });
});
