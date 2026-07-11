/**
 * HOS-113 T-028 — seed integration test for the `pointsOfInterest` required
 * group, against a real PostgreSQL database.
 *
 * Mirrors the transaction-rollback pattern established by
 * `hos25-t022-reseed-determinism.integration.test.ts`: every INSERT/DELETE
 * runs for real (constraints enforced, unique indexes checked) inside a
 * single Drizzle transaction that is ALWAYS rolled back, so the shared
 * worktree database is left byte-for-byte as it was before this file ran.
 * Requires `apps/api/.env.local`'s `HOSPEDA_DATABASE_URL` to be reachable
 * (`pnpm db:start`); every test is `it.skipIf`-skipped (exit code 0) when it
 * is not.
 *
 * Covers AC-3: fresh-seed produces the T-023 POIs with correct
 * lat/long/type/no-name, the T-026 destination relationships (including the
 * M2M `playa_banco_pelay` case), and idempotent re-running of the
 * relationship-building step.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    type DrizzleClient,
    destinations,
    eq,
    initializeDb,
    PointOfInterestModel,
    RDestinationPointOfInterestModel,
    resetDb,
    users
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { type Actor, PointOfInterestService } from '@repo/service-core';
import { config as loadDotenv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { normalizePointOfInterestSeedItem } from '../../src/required/pointsOfInterest.seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// packages/seed/test/integration -> packages/seed/test -> packages/seed ->
// packages -> repo root -> apps/api/.env.local (mirrors T-022's path math).
const apiEnvLocalPath = join(__dirname, '../../../../apps/api/.env.local');
if (existsSync(apiEnvLocalPath)) {
    loadDotenv({ path: apiEnvLocalPath });
}

const dbAvailable = Boolean(process.env.HOSPEDA_DATABASE_URL);

let pool: Pool | undefined;
let db: DrizzleClient | undefined;

/** Sentinel thrown to force a transaction rollback without failing the test. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

/**
 * Runs `fn` inside a real Drizzle transaction against the worktree database,
 * then ALWAYS rolls it back.
 */
async function withRealDbTransaction(fn: (tx: DrizzleClient) => Promise<void>): Promise<void> {
    if (!db) throw new Error('withRealDbTransaction: database not initialized');
    try {
        await db.transaction(async (tx) => {
            await fn(tx as unknown as DrizzleClient);
            throw new RollbackSignal();
        });
    } catch (error) {
        if (error instanceof RollbackSignal) return;
        throw error;
    }
}

/** Inserts a minimal, valid `users` row and returns its id. */
async function insertUser(tx: DrizzleClient): Promise<string> {
    const id = crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);
    await tx.insert(users).values({
        id,
        email: `t028-user-${uid}@example.com`,
        displayName: 'T-028 Test User',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);
    return id;
}

/** Inserts a minimal, valid `destinations` row and returns its id. */
async function insertPlainDestination(tx: DrizzleClient, name: string): Promise<string> {
    const id = crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);
    await tx.insert(destinations).values({
        id,
        slug: `t028-dest-${uid}`,
        name,
        destinationType: 'CITY',
        level: 4,
        path: `/t028/dest-${uid}`,
        summary: 'T-028 destination summary',
        description: 'T-028 destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/t028-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);
    return id;
}

/** Minimal shape of a raw POI fixture, for the fields this test needs. */
interface PointOfInterestFixture {
    id: string;
    slug: string;
    lat: number;
    long: number;
    type: string;
    description?: string;
    icon?: string;
    isBuiltin?: boolean;
    isFeatured?: boolean;
    displayWeight?: number;
    lifecycleState?: string;
}

const SEED_SRC_DIR = join(__dirname, '../../src');

function readPointOfInterestManifestFiles(): string[] {
    const manifestPath = join(SEED_SRC_DIR, 'manifest-required.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, string[]>;
    const files = manifest.pointsOfInterest;
    if (!files || files.length === 0) {
        throw new Error('manifest-required.json has no entries for "pointsOfInterest"');
    }
    return files;
}

function loadPointOfInterestFixture(file: string): PointOfInterestFixture {
    const fullPath = join(SEED_SRC_DIR, 'data', 'pointOfInterest', file);
    return JSON.parse(readFileSync(fullPath, 'utf-8')) as PointOfInterestFixture;
}

describe('HOS-113 T-028 — pointsOfInterest required-seed group against a real database', () => {
    beforeAll(() => {
        if (!dbAvailable) return;
        pool = new Pool({ connectionString: process.env.HOSPEDA_DATABASE_URL, max: 3 });
        db = initializeDb(pool);
    });

    afterAll(async () => {
        if (!dbAvailable) return;
        await pool?.end();
        resetDb();
    });

    describe('1. All T-023 POIs persist with correct lat/long/type and no name column', () => {
        it.skipIf(!dbAvailable)(
            'creates every manifest-listed POI fixture via the real normalizer + model',
            async () => {
                await withRealDbTransaction(async (tx) => {
                    const model = new PointOfInterestModel();
                    const files = readPointOfInterestManifestFiles();
                    const fixtures = files.map(loadPointOfInterestFixture);

                    const createdBySlug = new Map<
                        string,
                        { id: string; lat: number; long: number; type: string }
                    >();

                    for (const fixture of fixtures) {
                        const normalized = normalizePointOfInterestSeedItem(
                            fixture as unknown as Record<string, unknown>
                        );
                        const created = (await model.create(normalized, tx)) as {
                            id: string;
                            slug: string;
                            lat: number;
                            long: number;
                            type: string;
                        };
                        expect(created.id).toBeTruthy();
                        expect(created.slug).toBe(fixture.slug);
                        createdBySlug.set(fixture.slug, {
                            id: created.id,
                            lat: created.lat,
                            long: created.long,
                            type: created.type
                        });
                    }

                    // Every fixture actually persisted.
                    expect(createdBySlug.size).toBe(fixtures.length);

                    // Spot-check one fixture's coordinates/type round-trip exactly.
                    const autodromo = fixtures.find(
                        (f) => f.slug === 'autodromo_concepcion_del_uruguay'
                    );
                    expect(autodromo).toBeDefined();
                    if (autodromo) {
                        const persisted = createdBySlug.get(autodromo.slug);
                        expect(persisted?.lat).toBeCloseTo(autodromo.lat, 6);
                        expect(persisted?.long).toBeCloseTo(autodromo.long, 6);
                        expect(persisted?.type).toBe(autodromo.type);
                    }

                    // No `name` column exists on the persisted row shape (OQ-2) —
                    // the DB schema itself has no such column, so any accidental
                    // `name` value passed through the normalizer would be silently
                    // dropped by Drizzle rather than surfacing as a bug. Assert the
                    // raw fixture never carried one in the first place.
                    for (const fixture of fixtures) {
                        expect(fixture).not.toHaveProperty('name');
                    }
                });
            }
        );
    });

    describe('2. Destination relationships persist, including the M2M case (OQ-1)', () => {
        it.skipIf(!dbAvailable)(
            'creates r_destination_point_of_interest rows and supports one POI mapped to 2 destinations',
            async () => {
                await withRealDbTransaction(async (tx) => {
                    const poiModel = new PointOfInterestModel();
                    const relationModel = new RDestinationPointOfInterestModel();

                    const bancoPelayFixture = loadPointOfInterestFixture(
                        '002-point-of-interest-playa_banco_pelay.json'
                    );
                    const normalized = normalizePointOfInterestSeedItem(
                        bancoPelayFixture as unknown as Record<string, unknown>
                    );
                    const poi = (await poiModel.create(normalized, tx)) as { id: string };

                    const destinationA = await insertPlainDestination(
                        tx,
                        'T-028 Concepcion del Uruguay'
                    );
                    const destinationB = await insertPlainDestination(tx, 'T-028 Liebig');

                    await relationModel.create(
                        { destinationId: destinationA, pointOfInterestId: poi.id },
                        tx
                    );
                    await relationModel.create(
                        { destinationId: destinationB, pointOfInterestId: poi.id },
                        tx
                    );

                    const { items: relations } = await relationModel.findAll(
                        { pointOfInterestId: poi.id },
                        undefined,
                        undefined,
                        tx
                    );

                    const destinationIds = relations.map(
                        (r: { destinationId: string }) => r.destinationId
                    );
                    expect(destinationIds).toContain(destinationA);
                    expect(destinationIds).toContain(destinationB);
                    expect(new Set(destinationIds).size).toBe(2);
                });
            }
        );
    });

    describe('3. Relationship building is idempotent (AC-3)', () => {
        // NOTE: unlike sections 1/2, this test does NOT run inside
        // `withRealDbTransaction`. `PointOfInterestService.addPointOfInterestToDestination`
        // (mirroring `AttractionService.addAttractionToDestination` exactly)
        // does not thread `ctx.tx` to its internal `this.model.findOne` /
        // `this.destinationModel.findOne` / `this.relatedModel.findOne` existence
        // checks — a pre-existing pattern shared by both entities' relation-builder
        // methods, consistent with how the real seed's `createServiceRelationBuilder`
        // also calls them without a transaction. Those reads fall back to the
        // process-global `getDb()` connection, which cannot see uncommitted rows
        // from a separate in-flight transaction (a different pooled connection).
        // This test therefore commits real rows directly (exactly how the real
        // seed pipeline runs this method) and cleans them up explicitly in
        // `finally`, rather than relying on transaction rollback.
        it.skipIf(!dbAvailable)(
            'PointOfInterestService.addPointOfInterestToDestination returns ALREADY_EXISTS on re-run, without creating a duplicate row',
            async () => {
                if (!db) throw new Error('db not initialized');
                const poiModel = new PointOfInterestModel();
                const relationModel = new RDestinationPointOfInterestModel();

                let userId: string | undefined;
                let poiId: string | undefined;
                let destinationId: string | undefined;

                try {
                    userId = await insertUser(db);

                    const fixture = loadPointOfInterestFixture(
                        '005-point-of-interest-parque_unzue.json'
                    );
                    const normalized = normalizePointOfInterestSeedItem(
                        fixture as unknown as Record<string, unknown>
                    );
                    const poi = (await poiModel.create(normalized)) as { id: string };
                    poiId = poi.id;
                    destinationId = await insertPlainDestination(
                        db,
                        'T-028 Idempotency Destination'
                    );

                    const actor: Actor = {
                        id: userId,
                        role: RoleEnum.SUPER_ADMIN,
                        permissions: [
                            PermissionEnum.POINT_OF_INTEREST_CREATE,
                            PermissionEnum.POINT_OF_INTEREST_VIEW
                        ]
                    };
                    const service = new PointOfInterestService({});

                    // ── First run: creates the relation ─────────────────────────
                    const first = await service.addPointOfInterestToDestination(actor, {
                        destinationId,
                        pointOfInterestId: poi.id
                    });
                    expect(first.error).toBeUndefined();

                    // ── Second run: same pair — must be a graceful ALREADY_EXISTS,
                    //    never a duplicate row or a thrown constraint violation ──
                    const second = await service.addPointOfInterestToDestination(actor, {
                        destinationId,
                        pointOfInterestId: poi.id
                    });
                    expect(second.error).toBeDefined();
                    expect(second.error?.code).toBe('ALREADY_EXISTS');

                    const { items: relations } = await relationModel.findAll({
                        destinationId,
                        pointOfInterestId: poi.id
                    });
                    expect(relations).toHaveLength(1);
                } finally {
                    // Namespaced cleanup — only the rows this test created.
                    if (destinationId && poiId) {
                        await relationModel.hardDelete({ destinationId, pointOfInterestId: poiId });
                    }
                    if (poiId) await poiModel.hardDelete({ id: poiId });
                    if (destinationId) {
                        await db.delete(destinations).where(eq(destinations.id, destinationId));
                    }
                    if (userId) await db.delete(users).where(eq(users.id, userId));
                }
            }
        );
    });
});
