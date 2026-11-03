import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { destinations } from '../../src/schemas/destination/destination.dbschema.ts';
import { users } from '../../src/schemas/user/user.dbschema.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(async () => closeTestPool());

const migrationSql = readFileSync(
    fileURLToPath(new URL('../../src/migrations/0186_confused_violations.sql', import.meta.url)),
    'utf8'
);
const migrationStatements = migrationSql
    .split('--> statement-breakpoint')
    .map((part) => part.trim());
const businessLineConstraints = migrationStatements
    .filter((statement) =>
        /^ALTER TABLE .*ADD CONSTRAINT .*business_lines_valid" CHECK \(/s.test(statement)
    )
    .map((statement) => statement.slice(0, statement.indexOf(';') + 1));
const venueBackfill = migrationStatements.find((statement) =>
    /^UPDATE "venues" SET "business_lines" = CASE/s.test(statement)
);
if (businessLineConstraints.length !== 3 || !venueBackfill) {
    throw new Error('0186 business_lines constraint/backfill SQL could not be read');
}

async function setup(tx: DrizzleClient) {
    const owner = testData.user();
    const destination = testData.destination();
    await tx.insert(users).values(owner);
    await tx.insert(destinations).values(destination);
    return { ownerId: owner.id, destinationId: destination.id };
}

describe('TEST:2.3:2 AC:2:4 business_lines PostgreSQL constraints', () => {
    it('enforces the versioned migration CHECKs and applies its backfill', async () => {
        await withTestTransaction(async (tx) => {
            for (const statement of businessLineConstraints) {
                const table = statement.match(/^ALTER TABLE "(\w+)"/)?.[1];
                const constraint = statement.match(/ADD CONSTRAINT "([\w]+)"/)?.[1];
                expect(table).toBeDefined();
                expect(constraint).toBeDefined();
                await tx.execute(sql.raw(`ALTER TABLE "${table}" DROP CONSTRAINT "${constraint}"`));
                await tx.execute(sql.raw(statement));
            }

            const { ownerId, destinationId } = await setup(tx);
            let rejectionNumber = 0;
            const rejected = async (table: string, values: string, type = 'CABIN') => {
                const listingType = table === 'venues' ? `'${type}'` : `'${type}'`;
                const savepoint = `business_lines_rejection_${rejectionNumber++}`;
                await tx.execute(sql.raw(`SAVEPOINT ${savepoint}`));
                try {
                    await expect(
                        tx.execute(
                            sql.raw(
                                `INSERT INTO "${table}" (slug,name,summary,description,type,owner_id,destination_id,business_lines) VALUES ('bl-${crypto.randomUUID()}','n','s','d',${listingType},'${ownerId}','${destinationId}',${values})`
                            )
                        )
                    ).rejects.toThrow();
                } finally {
                    await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${savepoint}`));
                    await tx.execute(sql.raw(`RELEASE SAVEPOINT ${savepoint}`));
                }
            };
            await rejected('venues', "'{}'::text[]", 'RESTAURANT');
            await rejected('venues', "ARRAY['standard']::text[]", 'RESTAURANT');
            await rejected('venues', "ARRAY['food']::text[]", 'BOLICHE');
            await rejected('venues', "ARRAY['nightlife']::text[]", 'CAFE');
            await rejected('accommodations', "ARRAY['food']::text[]");
            await rejected('experiences', "ARRAY['food']::text[]", 'EXCURSION');

            await tx.execute(
                sql.raw('ALTER TABLE "venues" ALTER COLUMN "business_lines" DROP NOT NULL')
            );
            for (const [type, slug] of [
                ['BOLICHE', 'deleted'],
                ['BAR', 'bar'],
                ['CAFE', 'cafe']
            ]) {
                await tx.execute(
                    sql.raw(
                        `INSERT INTO venues (slug,name,summary,description,type,owner_id,destination_id,business_lines,publication_status,inactive_since,deadlines_version,deleted_at) VALUES ('bl-${slug}-${crypto.randomUUID()}','n','s','d','${type}','${ownerId}','${destinationId}',NULL,'DRAFT',now(),1,${slug === 'deleted' ? 'now()' : 'NULL'})`
                    )
                );
            }
            await tx.execute(sql.raw(venueBackfill));
            const result = await tx.execute(
                sql.raw(
                    `SELECT type::text, business_lines FROM venues WHERE slug LIKE 'bl-%' AND type IN ('BOLICHE','BAR','CAFE') ORDER BY type::text`
                )
            );
            expect(result.rows.map((row: any) => [row.type, row.business_lines])).toEqual([
                ['BAR', ['food', 'nightlife']],
                ['BOLICHE', ['nightlife']],
                ['CAFE', ['food']]
            ]);
        });
    });
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
                    `INSERT INTO accommodations (slug,name,summary,description,type,owner_id,destination_id,publication_status,inactive_since,deadlines_version) VALUES ('bl-${crypto.randomUUID()}','n','s','d','CABIN','${ownerId}','${destinationId}','DRAFT',now(),1) RETURNING business_lines`
                )
            );
            expect(result.rows[0]?.business_lines).toEqual(['standard']);
        });
    });
});
