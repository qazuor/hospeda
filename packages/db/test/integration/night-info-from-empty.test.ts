// HOS-1846 (TEST:4.2:1, AC:4:1): the nightInfo columns and their two CHECKs
// exist on a database migrated from empty. Every row is written inside a
// transaction that rolls back; rejected inserts use SAVEPOINTs so the outer
// transaction survives.
import type { PoolClient } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { closeTestPool, getTestPool } from './helpers.ts';

afterAll(closeTestPool);

interface DbError {
    code?: string;
    constraint?: string;
}

async function withRollback(body: (client: PoolClient) => Promise<void>): Promise<void> {
    const client = await getTestPool().connect();
    try {
        await client.query('BEGIN');
        await body(client);
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
}

async function rejected(
    client: PoolClient,
    statement: string,
    params: unknown[]
): Promise<DbError | null> {
    await client.query('SAVEPOINT expected_rejection');
    try {
        await client.query(statement, params);
        return null;
    } catch (error) {
        return error as DbError;
    } finally {
        await client.query('ROLLBACK TO SAVEPOINT expected_rejection');
    }
}

async function seedOwnerAndDestination(client: PoolClient): Promise<{
    ownerId: string;
    destinationId: string;
}> {
    const userId = crypto.randomUUID();
    await client.query('INSERT INTO users (id, slug, email) VALUES ($1, $2, $3)', [
        userId,
        `night-info-${userId}`,
        `night-info-${userId}@example.test`
    ]);
    const destinationId = crypto.randomUUID();
    const suffix = crypto.randomUUID();
    await client.query(
        `INSERT INTO destinations
            (id, destination_type, path, slug, name, summary, description, location)
         VALUES ($1, 'CITY', $2, $3, 'Night Destination', 'summary', 'description',
            '{"state":"Entre Rios","country":"Argentina","coordinates":{"lat":"-32.48","long":"-58.23"}}'::jsonb)`,
        [destinationId, `/night/info-${suffix}`, `night-info-${suffix}`]
    );
    return { ownerId: userId, destinationId };
}

const insertVenue = `INSERT INTO venues
    (slug, name, summary, description, type, owner_id, destination_id,
     business_lines, publication_status, inactive_since, deadlines_version,
     entry_kind, entry_price_from)
VALUES ($1, 'Night Venue', 'summary', 'description', 'BOLICHE', $2, $3,
        ARRAY['nightlife']::text[], 'DRAFT', now(), 1, $4, $5)`;

describe('nightInfo schema from empty (HOS-1846, AC:4:1)', () => {
    it('exposes the four nullable entry columns on venues (age and dress code are policies, HOS-2060)', async () => {
        const result = await getTestPool().query<{
            column_name: string;
            data_type: string;
            is_nullable: string;
        }>(
            `SELECT column_name, data_type, is_nullable
               FROM information_schema.columns
              WHERE table_name = 'venues'
                AND column_name IN (
                    'entry_kind', 'entry_note_i18n', 'entry_price_from',
                    'entry_price_updated_at', 'min_age', 'dress_code',
                    'dress_code_note_i18n', 'policies'
                )
              ORDER BY column_name`
        );
        expect(result.rows.map((row) => row.column_name)).toEqual([
            'entry_kind',
            'entry_note_i18n',
            'entry_price_from',
            'entry_price_updated_at',
            'policies'
        ]);
        for (const row of result.rows) expect(row.is_nullable).toBe('YES');
        expect(result.rows.find((row) => row.column_name === 'entry_price_from')?.data_type).toBe(
            'integer'
        );
        expect(result.rows.find((row) => row.column_name === 'policies')?.data_type).toBe('jsonb');
        expect(
            result.rows.find((row) => row.column_name === 'entry_price_updated_at')?.data_type
        ).toBe('timestamp with time zone');
    });

    it('rejects a negative entry price', async () => {
        await withRollback(async (client) => {
            const { ownerId, destinationId } = await seedOwnerAndDestination(client);
            const error = await rejected(client, insertVenue, [
                `neg-${crypto.randomUUID()}`,
                ownerId,
                destinationId,
                'paid',
                -1
            ]);
            expect(error).toMatchObject({
                code: '23514',
                constraint: 'venues_entry_price_nonnegative'
            });
        });
    });

    it('rejects a price when entry_kind is not paid', async () => {
        await withRollback(async (client) => {
            const { ownerId, destinationId } = await seedOwnerAndDestination(client);
            const error = await rejected(client, insertVenue, [
                `free-${crypto.randomUUID()}`,
                ownerId,
                destinationId,
                'free',
                5000
            ]);
            expect(error).toMatchObject({
                code: '23514',
                constraint: 'venues_entry_price_requires_paid'
            });
        });
    });

    it('accepts a price with entry_kind paid and a null price otherwise', async () => {
        await withRollback(async (client) => {
            const { ownerId, destinationId } = await seedOwnerAndDestination(client);
            await client.query(insertVenue, [
                `paid-${crypto.randomUUID()}`,
                ownerId,
                destinationId,
                'paid',
                5000
            ]);
            const inserted = await client.query<{ entry_kind: string; entry_price_from: number }>(
                `SELECT entry_kind::text, entry_price_from FROM venues WHERE entry_price_from = 5000`
            );
            expect(inserted.rows).toContainEqual({ entry_kind: 'paid', entry_price_from: 5000 });

            await client.query(insertVenue, [
                `varies-${crypto.randomUUID()}`,
                ownerId,
                destinationId,
                'varies',
                null
            ]);
        });
    });
});
