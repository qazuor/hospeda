/**
 * @fileoverview
 * Integration tests for `0190-hos-2557-venue-whatsapp-public-default` (HOS-2557).
 *
 * Runs against the REAL integration database with the rollback-isolation idiom:
 * the SQL is what has to be proven. A venue with a number and no stored choice
 * becomes PUBLIC; a venue with an explicit choice (either value), a venue with no
 * number, and a venue with a blank number are left alone; a second run changes
 * nothing.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DrizzleClient } from '@repo/db';
import { destinations, eq, getDb, inArray, initializeDb, resetDb, users, venues } from '@repo/db';
import {
    DestinationTypeEnum,
    PublicationStatusEnum,
    RoleEnum,
    VenueTypeEnum,
    VenueWhatsappVisibilityEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0190-hos-2557-venue-whatsapp-public-default.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

const PREFIX = 'zzz-test-hos2557-';

/** Sentinel thrown at the end of every isolated test to force a rollback. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool;

/** Runs `fn` inside a transaction that ALWAYS rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    try {
        await getDb().transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

/** Builds the migration ctx against a transaction-scoped client. */
function buildCtx(tx: DrizzleClient, actorId: string): SeedMigrationCtx {
    const actor: Actor = { id: actorId, roles: [RoleEnum.SUPER_ADMIN], permissions: [] };
    return { db: tx, actor, models: {}, services: {}, helpers: {} } as unknown as SeedMigrationCtx;
}

type Fixture = {
    readonly ownerId: string;
    readonly noChoiceWithNumber: string;
    readonly loggedInOnly: string;
    readonly alreadyPublic: string;
    readonly noChoiceNoNumber: string;
    readonly noChoiceBlankNumber: string;
};

/** Inserts an owner, a destination and five venues covering every case. */
async function insertVenues(tx: DrizzleClient): Promise<Fixture> {
    const suffix = crypto.randomUUID().slice(0, 8);
    const [owner] = await tx
        .insert(users)
        .values({ email: `${PREFIX}owner-${suffix}@example.test` })
        .returning({ id: users.id });
    const [destination] = await tx
        .insert(destinations)
        .values({
            destinationType: DestinationTypeEnum.CITY,
            path: `${PREFIX}${suffix}`,
            slug: `${PREFIX}destination-${suffix}`,
            name: 'HOS-2557 destination',
            summary: 'HOS-2557 fixture destination.',
            description: 'HOS-2557 fixture destination, rolled back after the test.',
            location: { country: 'AR', state: 'Entre Rios', city: 'Concepcion del Uruguay' }
        } as typeof destinations.$inferInsert)
        .returning({ id: destinations.id });
    if (!owner || !destination) throw new Error('Failed to insert owner/destination');

    const insert = async (input: {
        readonly key: string;
        readonly whatsapp: string | null;
        readonly visibility: VenueWhatsappVisibilityEnum | null;
    }): Promise<string> => {
        const [row] = await tx
            .insert(venues)
            .values({
                slug: `${PREFIX}${input.key}-${suffix}`,
                name: 'HOS-2557 venue',
                summary: 'HOS-2557 fixture.',
                description: 'HOS-2557 fixture venue, rolled back after the test.',
                type: VenueTypeEnum.RESTAURANT,
                businessLines: ['food'],
                ownerId: owner.id,
                destinationId: destination.id,
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                inactiveSince: new Date(),
                deadlinesVersion: 1,
                contactInfo: input.whatsapp === null ? null : { whatsapp: input.whatsapp },
                whatsappVisibility: input.visibility
            } as typeof venues.$inferInsert)
            .returning({ id: venues.id });
        if (!row) throw new Error('Failed to insert venue');
        return row.id;
    };

    return {
        ownerId: owner.id,
        noChoiceWithNumber: await insert({
            key: 'a',
            whatsapp: '+5493442123456',
            visibility: null
        }),
        loggedInOnly: await insert({
            key: 'b',
            whatsapp: '+5493442123457',
            visibility: VenueWhatsappVisibilityEnum.LOGGED_IN_ONLY
        }),
        alreadyPublic: await insert({
            key: 'c',
            whatsapp: '+5493442123458',
            visibility: VenueWhatsappVisibilityEnum.PUBLIC
        }),
        noChoiceNoNumber: await insert({ key: 'd', whatsapp: null, visibility: null }),
        noChoiceBlankNumber: await insert({ key: 'e', whatsapp: '   ', visibility: null })
    };
}

/** Reads `whatsapp_visibility` of the given venues, keyed by id. */
async function readVisibility(
    tx: DrizzleClient,
    ids: readonly string[]
): Promise<Map<string, string | null>> {
    const rows = await tx
        .select({ id: venues.id, visibility: venues.whatsappVisibility })
        .from(venues)
        .where(inArray(venues.id, [...ids]));
    return new Map(rows.map((row) => [row.id, row.visibility]));
}

describe('HOS-2557: 0190-hos-2557-venue-whatsapp-public-default (integration)', () => {
    beforeAll(() => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error('HOSPEDA_DATABASE_URL is not set in this worktree');
        }
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    it('defaults only the venues with a number and no choice, and keeps every explicit pick', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const f = await insertVenues(tx);
            const ids = [
                f.noChoiceWithNumber,
                f.loggedInOnly,
                f.alreadyPublic,
                f.noChoiceNoNumber,
                f.noChoiceBlankNumber
            ];

            // Act
            const result = await migration.up(buildCtx(tx, f.ownerId));

            // Assert
            const after = await readVisibility(tx, ids);
            expect(after.get(f.noChoiceWithNumber)).toBe('PUBLIC');
            expect(after.get(f.loggedInOnly)).toBe('LOGGED_IN_ONLY');
            expect(after.get(f.alreadyPublic)).toBe('PUBLIC');
            expect(after.get(f.noChoiceNoNumber)).toBeNull();
            expect(after.get(f.noChoiceBlankNumber)).toBeNull();
            expect(result.counts?.defaulted).toBeGreaterThanOrEqual(1);
        });
    });

    it('is idempotent: a second run changes nothing', async () => {
        await withRollback(async (tx) => {
            // Arrange
            const f = await insertVenues(tx);
            await migration.up(buildCtx(tx, f.ownerId));

            // Act
            const second = await migration.up(buildCtx(tx, f.ownerId));

            // Assert
            expect(second.counts?.defaulted).toBe(0);
            const [row] = await tx
                .select({ visibility: venues.whatsappVisibility })
                .from(venues)
                .where(eq(venues.id, f.loggedInOnly));
            expect(row?.visibility).toBe('LOGGED_IN_ONLY');
        });
    });

    it('declares a non-destructive required migration named after its file', () => {
        expect(migration.meta.name).toBe('0190-hos-2557-venue-whatsapp-public-default');
        expect(migration.meta.group).toBe('required');
        expect(migration.meta.destructive).toBe(false);
    });
});
