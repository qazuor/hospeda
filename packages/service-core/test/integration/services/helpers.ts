/**
 * Real-DB integration test helpers for `packages/service-core` (SPEC-080).
 *
 * Mirrors the SPEC-061 pattern in `packages/db/test/integration/helpers.ts`
 * but lives inside service-core so the suite can be installed as a peer to
 * the existing mocked tests under `test/integration/`.
 */
import {
    type DrizzleClient,
    accommodations,
    destinations,
    schema,
    setDb,
    userBookmarks,
    users
} from '@repo/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

let pool: Pool | null = null;
let cachedDb: DrizzleClient | null = null;

class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

function getTestConnectionString(): string {
    const url = process.env.HOSPEDA_TEST_DATABASE_URL;
    if (!url) {
        throw new Error(
            'HOSPEDA_TEST_DATABASE_URL is not set. ' +
                'Run service-core integration tests via "pnpm test:integration" so the global-setup creates the ephemeral DB.'
        );
    }
    return url;
}

/** Returns true when the integration DB env var is wired up. */
export function isServiceTestDbAvailable(): boolean {
    return Boolean(process.env.HOSPEDA_TEST_DATABASE_URL);
}

/** Lazy-initialised pg.Pool, scoped to the worker process. */
export function getServiceTestPool(): Pool {
    if (!pool) {
        pool = new Pool({ connectionString: getTestConnectionString(), max: 5 });
    }
    return pool;
}

/** Drizzle client wired to the same pool, cached for the worker lifetime. */
export function getServiceTestDb(): DrizzleClient {
    if (!cachedDb) {
        // Pass the combined schema so relational queries (`db.query.X.findFirst`)
        // can resolve relations the same way `packages/db/src/client.ts` does
        // at runtime.
        cachedDb = drizzle({ client: getServiceTestPool(), schema }) as unknown as DrizzleClient;
        // Wire @repo/db's runtime client so model methods called without an
        // explicit tx target the test DB instead of throwing
        // "Database not initialized".
        setDb(cachedDb);
    }
    return cachedDb;
}

/**
 * Runs a callback inside a Drizzle transaction that is ALWAYS rolled back.
 * Use it as the body of every test so seed inserts disappear at the end.
 */
export async function withServiceTestTransaction(
    fn: (tx: DrizzleClient) => Promise<void>
): Promise<void> {
    const db = getServiceTestDb();
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

/** Releases the pool. Call from `afterAll()` of each test file. */
export async function closeServiceTestPool(): Promise<void> {
    cachedDb = null;
    if (pool) {
        await pool.end();
        pool = null;
    }
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------
//
// Each helper inserts the FK chain required by the service it targets and
// returns the IDs so the test can call service.getById() against them. Helpers
// MUST be called inside `withServiceTestTransaction()` so the inserts roll
// back at the end of the test.

interface SeedAccommodationOverrides {
    readonly ownerId?: string;
    readonly destinationId?: string;
    readonly accommodationId?: string;
}

/**
 * Inserts a User (owner), a Destination, and an Accommodation referencing
 * both. Returns the IDs of all three. Used to validate
 * `AccommodationService.getById()` populates the `destination` and `owner`
 * relations.
 */
export async function seedAccommodation(
    tx: DrizzleClient,
    overrides: SeedAccommodationOverrides = {}
): Promise<{
    readonly userId: string;
    readonly destinationId: string;
    readonly accommodationId: string;
}> {
    const userId = overrides.ownerId ?? crypto.randomUUID();
    const destinationId = overrides.destinationId ?? crypto.randomUUID();
    const accommodationId = overrides.accommodationId ?? crypto.randomUUID();

    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(users).values({
        id: userId,
        email: `seed-owner-${uid}@example.com`,
        displayName: 'Seed Owner',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await tx.insert(destinations).values({
        id: destinationId,
        slug: `seed-dest-${uid}`,
        name: 'Seed Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/seed/dest-${uid}`,
        summary: 'Seed destination summary',
        description: 'Seed destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/seed-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);

    await tx.insert(accommodations).values({
        id: accommodationId,
        slug: `seed-acc-${uid}`,
        name: 'Seed Accommodation',
        summary: 'Seed accommodation summary',
        description: 'Seed accommodation description',
        type: 'HOTEL',
        ownerId: userId,
        destinationId,
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/seed-accommodation.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof accommodations.$inferInsert);

    return { userId, destinationId, accommodationId };
}

interface SeedUserBookmarkOverrides {
    readonly userId?: string;
    readonly bookmarkId?: string;
}

/**
 * Inserts a User and a UserBookmark referencing that user. Used to validate
 * `UserBookmarkService.getById()` populates the `user` relation.
 */
export async function seedUserBookmark(
    tx: DrizzleClient,
    overrides: SeedUserBookmarkOverrides = {}
): Promise<{ readonly userId: string; readonly bookmarkId: string }> {
    const userId = overrides.userId ?? crypto.randomUUID();
    const bookmarkId = overrides.bookmarkId ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);

    await tx.insert(users).values({
        id: userId,
        email: `seed-bookmark-${uid}@example.com`,
        displayName: 'Bookmark Owner',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);

    await tx.insert(userBookmarks).values({
        id: bookmarkId,
        userId,
        // Bookmarks reference any entity by (entityType, entityId). For the
        // relation-loading test we only care about the `user` join, so we
        // point at a random UUID with a permissive entityType.
        entityId: crypto.randomUUID(),
        entityType: 'ACCOMMODATION',
        name: 'Seed Bookmark',
        lifecycleState: 'ACTIVE'
    } as typeof userBookmarks.$inferInsert);

    return { userId, bookmarkId };
}
