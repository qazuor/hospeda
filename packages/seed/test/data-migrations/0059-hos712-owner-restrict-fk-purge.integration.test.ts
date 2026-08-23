/**
 * @fileoverview
 * Regression test for HOS-712 (second round): `0059-purge-test-and-commerce-example`
 * resolved the content it deletes ONLY by literal slug, while three of those
 * tables hold an `ON DELETE restrict` reference back to the accounts the
 * migration purges in its last step.
 *
 * The slug lists were inventoried against production on 2026-08-19 and are a
 * snapshot. Anything one of the 23 test accounts created after that date — or
 * whose slug was edited since — was invisible to the slug arm while its
 * `owner_id` kept holding the `users` delete open. Measured on 2026-08-23
 * against a clone of production, that was 20 rows the slug lists did not name
 * (`gastronomies` 9, `experiences` 7, `accommodations` 4) plus 6
 * `accommodation_occupancy` rows referenced through `created_by_id`, and it
 * aborted the run with:
 *
 *     ERROR: update or delete on table "users" violates foreign key constraint
 *            "experiences_owner_id_users_id_fk" on table "experiences"
 *
 * Because the runner stops at the first failing migration (HOS-25 G-5), that
 * abort also stranded the ten data-migrations numbered after it.
 *
 * A real database rather than a stubbed `ctx.db`, for the same reason as the
 * sibling `0059-hos712-billing-restrict-fk-order.integration.test.ts`: the whole
 * risk surface IS the database's FK enforcement. A mocked `db.delete()` chain
 * can never violate a real constraint, so it can never catch this bug — which is
 * exactly how it reached production undetected twice.
 *
 * Uses the rollback-isolation idiom: every test opens a `db.transaction()`, does
 * setup + `up()` + assertions inside it, then throws a sentinel to roll the whole
 * thing back. Nothing persists after this file runs.
 *
 * @module test/data-migrations/0059-hos712-owner-restrict-fk-purge
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    accommodationOccupancy,
    accommodations,
    conversations,
    type DrizzleClient,
    destinations,
    eq,
    experiences,
    gastronomies,
    getDb,
    initializeDb,
    resetDb,
    users
} from '@repo/db';
import {
    AccommodationTypeEnum,
    DestinationTypeEnum,
    ExperienceTypeEnum,
    GastronomyTypeEnum,
    OccupancySourceEnum,
    RoleEnum
} from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as migration from '../../src/data-migrations/0059-purge-test-and-commerce-example.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

loadEnv({ path: path.resolve(__dirname, '../../../../apps/api/.env.local') });

/**
 * Emails that ARE in the migration's `TEST_ACCOUNT_EMAILS` list. One per test,
 * so a leak between tests would surface as a count mismatch rather than silently
 * passing.
 */
const PURGED_EMAIL_GASTRONOMY = 'gastro-owner-julieta@local.test';
const PURGED_EMAIL_EXPERIENCE = 'gastro-owner-rodrigo@local.test';
const PURGED_EMAIL_ACCOMMODATION = 'gastro-owner-valentina@local.test';
const PURGED_EMAIL_OCCUPANCY = 'qazuor+r2gastro@gmail.com';
const PURGED_EMAIL_SCOPE = 'qazuor+r5prov@gmail.com';

/**
 * An email deliberately NOT in `TEST_ACCOUNT_EMAILS` — it stands in for the
 * eight real people who signed up. Used to prove the owner arm is SCOPED:
 * widening the lookup must not turn this migration into "delete every
 * gastronomy".
 */
const SURVIVING_EMAIL = 'hos712-real-person@example.test';

/**
 * Slugs deliberately absent from `GASTRONOMY_SLUGS` / `EXPERIENCE_SLUGS` /
 * `TEST_ACCOMMODATION_SLUGS`. If any of these ever got added to those literal
 * lists, the slug arm would delete the row and these tests would pass for the
 * wrong reason — hence the `zzz-hos712-` prefix, which no inventory uses.
 */
const UNLISTED_GASTRONOMY_SLUG = 'zzz-hos712-unlisted-gastronomy';
const UNLISTED_EXPERIENCE_SLUG = 'zzz-hos712-unlisted-experience';
const UNLISTED_ACCOMMODATION_SLUG = 'zzz-hos712-unlisted-accommodation';
const SURVIVING_GASTRONOMY_SLUG = 'zzz-hos712-surviving-gastronomy';
const SURVIVING_ACCOMMODATION_SLUG = 'zzz-hos712-surviving-accommodation';

const STUB_ACTOR: Actor = {
    id: 'actor-stub-hos712-0059-owner-fk',
    role: RoleEnum.SUPER_ADMIN,
    permissions: []
};

/** Sentinel thrown at the end of every isolated test to force a rollback. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

let pool: Pool;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

/** Runs `fn` inside a transaction that ALWAYS rolls back. */
async function withRollback(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    const db = getDb();
    try {
        await db.transaction(async (tx) => {
            await fn(tx);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) {
            return;
        }
        throw error;
    }
}

/** Builds the migration ctx against a transaction-scoped client. */
function buildCtx(tx: DrizzleClient): SeedMigrationCtx {
    return { db: tx, actor: STUB_ACTOR } as unknown as SeedMigrationCtx;
}

/** Inserts one user by email, returning its id. */
async function insertUser(tx: DrizzleClient, email: string): Promise<string> {
    const inserted = await tx.insert(users).values({ email }).returning({ id: users.id });
    const row = inserted[0];
    if (!row) {
        throw new Error(`Insert of test user ${email} returned no row`);
    }
    return row.id;
}

/**
 * Inserts a destination to hang content off. The integration database is
 * migrated but NOT seeded, so nothing can be looked up — every parent row a test
 * needs has to be created inside its own transaction.
 */
async function insertDestination(tx: DrizzleClient, suffix: string): Promise<string> {
    const inserted = await tx
        .insert(destinations)
        .values({
            destinationType: DestinationTypeEnum.CITY,
            path: `zzz-hos712-${suffix}`,
            slug: `zzz-hos712-destination-${suffix}`,
            name: `HOS-712 destination ${suffix}`,
            summary: 'HOS-712 fixture destination.',
            description: 'HOS-712 fixture destination, rolled back after the test.',
            location: { country: 'AR', state: 'Entre Rios', city: 'Concepcion del Uruguay' }
        } as typeof destinations.$inferInsert)
        .returning({ id: destinations.id });
    const row = inserted[0];
    if (!row) {
        throw new Error('Insert of test destination returned no row');
    }
    return row.id;
}

/** Inserts a gastronomy owned by `ownerId` under a slug the migration never lists. */
async function insertGastronomy(
    tx: DrizzleClient,
    args: { readonly ownerId: string; readonly destinationId: string; readonly slug: string }
): Promise<string> {
    const inserted = await tx
        .insert(gastronomies)
        .values({
            slug: args.slug,
            name: 'HOS-712 gastronomy',
            summary: 'HOS-712 fixture.',
            description: 'HOS-712 fixture gastronomy, rolled back after the test.',
            type: GastronomyTypeEnum.RESTAURANT,
            ownerId: args.ownerId,
            destinationId: args.destinationId
        } as typeof gastronomies.$inferInsert)
        .returning({ id: gastronomies.id });
    const row = inserted[0];
    if (!row) {
        throw new Error('Insert of test gastronomy returned no row');
    }
    return row.id;
}

/** Inserts an experience owned by `ownerId` under a slug the migration never lists. */
async function insertExperience(
    tx: DrizzleClient,
    args: { readonly ownerId: string; readonly destinationId: string; readonly slug: string }
): Promise<string> {
    const inserted = await tx
        .insert(experiences)
        .values({
            slug: args.slug,
            name: 'HOS-712 experience',
            summary: 'HOS-712 fixture.',
            description: 'HOS-712 fixture experience, rolled back after the test.',
            type: ExperienceTypeEnum.KAYAK_RENTAL,
            ownerId: args.ownerId,
            destinationId: args.destinationId
        } as typeof experiences.$inferInsert)
        .returning({ id: experiences.id });
    const row = inserted[0];
    if (!row) {
        throw new Error('Insert of test experience returned no row');
    }
    return row.id;
}

/** Inserts an accommodation owned by `ownerId` under a slug the migration never lists. */
async function insertAccommodation(
    tx: DrizzleClient,
    args: { readonly ownerId: string; readonly destinationId: string; readonly slug: string }
): Promise<string> {
    const inserted = await tx
        .insert(accommodations)
        .values({
            slug: args.slug,
            name: 'HOS-712 accommodation',
            summary: 'HOS-712 fixture.',
            description: 'HOS-712 fixture accommodation, rolled back after the test.',
            type: AccommodationTypeEnum.CABIN,
            ownerId: args.ownerId,
            destinationId: args.destinationId
        } as typeof accommodations.$inferInsert)
        .returning({ id: accommodations.id });
    const row = inserted[0];
    if (!row) {
        throw new Error('Insert of test accommodation returned no row');
    }
    return row.id;
}

/** Inserts one `accommodation_occupancy` row created by `createdById`. */
async function insertOccupancy(
    tx: DrizzleClient,
    args: { readonly accommodationId: string; readonly createdById: string }
): Promise<void> {
    await tx.insert(accommodationOccupancy).values({
        accommodationId: args.accommodationId,
        date: '2026-08-25',
        source: OccupancySourceEnum.MANUAL,
        createdById: args.createdById
    } as typeof accommodationOccupancy.$inferInsert);
}

/** Inserts one `conversations` row attached to `accommodationId`. */
async function insertConversation(tx: DrizzleClient, accommodationId: string): Promise<void> {
    await tx.insert(conversations).values({
        accommodationId
    } as typeof conversations.$inferInsert);
}

/** True when a user row with this email still exists. */
async function userExists(tx: DrizzleClient, email: string): Promise<boolean> {
    const rows = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    return rows.length > 0;
}

/** True when a gastronomy row with this slug still exists. */
async function gastronomyExists(tx: DrizzleClient, slug: string): Promise<boolean> {
    const rows = await tx
        .select({ id: gastronomies.id })
        .from(gastronomies)
        .where(eq(gastronomies.slug, slug));
    return rows.length > 0;
}

/** True when an experience row with this slug still exists. */
async function experienceExists(tx: DrizzleClient, slug: string): Promise<boolean> {
    const rows = await tx
        .select({ id: experiences.id })
        .from(experiences)
        .where(eq(experiences.slug, slug));
    return rows.length > 0;
}

/** True when an accommodation row with this slug still exists. */
async function accommodationExists(tx: DrizzleClient, slug: string): Promise<boolean> {
    const rows = await tx
        .select({ id: accommodations.id })
        .from(accommodations)
        .where(eq(accommodations.slug, slug));
    return rows.length > 0;
}

describe('HOS-712: 0059 resolves purged content by owner, not only by literal slug', () => {
    beforeAll(async () => {
        if (!process.env.HOSPEDA_DATABASE_URL) {
            throw new Error(
                'HOSPEDA_DATABASE_URL is not set — is the integration global-setup wired?'
            );
        }

        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL });
        resetDb();
        initializeDb(pool);
    });

    afterAll(async () => {
        await pool.end();
        resetDb();
    });

    afterEach(() => {
        process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    });

    it('purges a gastronomy the slug list does not name, resolved by its owner (9 such rows in production)', async () => {
        await withRollback(async (tx) => {
            const ownerId = await insertUser(tx, PURGED_EMAIL_GASTRONOMY);
            const destinationId = await insertDestination(tx, 'gastro');
            await insertGastronomy(tx, {
                ownerId,
                destinationId,
                slug: UNLISTED_GASTRONOMY_SLUG
            });

            process.env.NODE_ENV = 'production';

            // Before the fix, this line rejects with a Postgres FK violation on
            // gastronomies_owner_id_users_id_fk at the `delete from users` step.
            const result = await migration.up(buildCtx(tx));
            const counts = result.counts as Record<string, number>;

            expect(counts.gastronomiesDeleted).toBe(1);
            expect(counts.usersDeleted).toBe(1);
            expect(await gastronomyExists(tx, UNLISTED_GASTRONOMY_SLUG)).toBe(false);
            expect(await userExists(tx, PURGED_EMAIL_GASTRONOMY)).toBe(false);
        });
    });

    it('purges an experience the slug list does not name, resolved by its owner (the exact constraint production named)', async () => {
        await withRollback(async (tx) => {
            const ownerId = await insertUser(tx, PURGED_EMAIL_EXPERIENCE);
            const destinationId = await insertDestination(tx, 'exp');
            await insertExperience(tx, {
                ownerId,
                destinationId,
                slug: UNLISTED_EXPERIENCE_SLUG
            });

            process.env.NODE_ENV = 'production';

            const result = await migration.up(buildCtx(tx));
            const counts = result.counts as Record<string, number>;

            expect(counts.experiencesDeleted).toBe(1);
            expect(counts.usersDeleted).toBe(1);
            expect(await experienceExists(tx, UNLISTED_EXPERIENCE_SLUG)).toBe(false);
            expect(await userExists(tx, PURGED_EMAIL_EXPERIENCE)).toBe(false);
        });
    });

    it('purges an accommodation the slug list does not name, together with the conversation attached to it', async () => {
        await withRollback(async (tx) => {
            const ownerId = await insertUser(tx, PURGED_EMAIL_ACCOMMODATION);
            const destinationId = await insertDestination(tx, 'acc');
            const accommodationId = await insertAccommodation(tx, {
                ownerId,
                destinationId,
                slug: UNLISTED_ACCOMMODATION_SLUG
            });
            // `conversations.accommodation_id` is the single non-cascade inbound
            // FK to `accommodations`, so this row blocks the accommodation delete
            // that the owner arm newly reaches.
            await insertConversation(tx, accommodationId);

            process.env.NODE_ENV = 'production';

            const result = await migration.up(buildCtx(tx));
            const counts = result.counts as Record<string, number>;

            expect(counts.accommodationsDeleted).toBe(1);
            expect(counts.conversationsDeleted).toBe(1);
            expect(counts.usersDeleted).toBe(1);
            expect(await accommodationExists(tx, UNLISTED_ACCOMMODATION_SLUG)).toBe(false);
            expect(await userExists(tx, PURGED_EMAIL_ACCOMMODATION)).toBe(false);
        });
    });

    it('purges an occupancy row a test account created on an accommodation that SURVIVES the purge', async () => {
        await withRollback(async (tx) => {
            // The accommodation belongs to someone who is NOT purged, so the
            // cascade from `accommodation_id` never reaches this occupancy row.
            // Only the `created_by_id` arm does — and that column is RESTRICT
            // over NOT NULL, so leaving it blocks the users delete. Production
            // had 6 rows in exactly this shape.
            const survivingOwnerId = await insertUser(tx, SURVIVING_EMAIL);
            const purgedUserId = await insertUser(tx, PURGED_EMAIL_OCCUPANCY);
            const destinationId = await insertDestination(tx, 'occ');
            const survivingAccommodationId = await insertAccommodation(tx, {
                ownerId: survivingOwnerId,
                destinationId,
                slug: SURVIVING_ACCOMMODATION_SLUG
            });
            await insertOccupancy(tx, {
                accommodationId: survivingAccommodationId,
                createdById: purgedUserId
            });

            process.env.NODE_ENV = 'production';

            const result = await migration.up(buildCtx(tx));
            const counts = result.counts as Record<string, number>;

            expect(counts.occupancyByCreatorDeleted).toBe(1);
            expect(counts.usersDeleted).toBe(1);
            expect(await userExists(tx, PURGED_EMAIL_OCCUPANCY)).toBe(false);
            // The accommodation itself is untouched: it is not in the slug list
            // and its owner is not purged.
            expect(await accommodationExists(tx, SURVIVING_ACCOMMODATION_SLUG)).toBe(true);
            expect(await userExists(tx, SURVIVING_EMAIL)).toBe(true);
        });
    });

    it('leaves content owned by a NON-purged account alone — the owner arm is scoped, not a table wipe', async () => {
        await withRollback(async (tx) => {
            const survivingOwnerId = await insertUser(tx, SURVIVING_EMAIL);
            const purgedUserId = await insertUser(tx, PURGED_EMAIL_SCOPE);
            const destinationId = await insertDestination(tx, 'scope');
            // One gastronomy for a real person, one for a purged test account.
            await insertGastronomy(tx, {
                ownerId: survivingOwnerId,
                destinationId,
                slug: SURVIVING_GASTRONOMY_SLUG
            });
            await insertGastronomy(tx, {
                ownerId: purgedUserId,
                destinationId,
                slug: UNLISTED_GASTRONOMY_SLUG
            });

            process.env.NODE_ENV = 'production';

            const result = await migration.up(buildCtx(tx));
            const counts = result.counts as Record<string, number>;

            // Exactly one of the two, not both.
            expect(counts.gastronomiesDeleted).toBe(1);
            expect(await gastronomyExists(tx, UNLISTED_GASTRONOMY_SLUG)).toBe(false);
            expect(await gastronomyExists(tx, SURVIVING_GASTRONOMY_SLUG)).toBe(true);
            expect(await userExists(tx, SURVIVING_EMAIL)).toBe(true);
        });
    });
});
