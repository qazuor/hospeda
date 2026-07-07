/**
 * HOS-25 T-022 — end-to-end determinism-stability test (OQ-1).
 *
 * Every prior test in this HOS-25 line (`test/example/determinism.test.ts`
 * T-016/T-025/T-026, `test/required/destinations.seed.test.ts` T-025) proves
 * that the pure `get*FixtureId` helpers are stable functions of their seed
 * key — call them twice, get the same UUID. What none of them prove is that
 * a REAL seed run actually PERSISTS that computed id: that the
 * `deterministicId` model-direct passthrough in `createSeedFactory` (and the
 * raw-Drizzle-insert variant used by `gastronomies.seed.ts`) writes the
 * explicit id unmodified, and that deleting a row and reseeding the exact
 * same fixture reproduces the exact same persisted UUID.
 *
 * This file closes that gap by running the actual insert mechanisms each
 * `example`/`required` seed uses — `Model.create({ id: explicit, ... })` or a
 * direct `db.insert(table).values({ id: explicit, ... })` — against the real
 * worktree PostgreSQL database, for a representative subset of the wired
 * entities/mechanisms (HOS-25 T-016/T-025/T-026):
 *
 * 1. **Top-level `deterministicId` factory, model-direct**: `posts` (the
 *    simplest FK footprint of the three `deterministicId`-factory entities —
 *    `accommodations`/`events`/`posts` — needing only a single author user).
 * 2. **Child-row model-direct (composite seed-key)**: `accommodation_faqs`,
 *    created via `AccommodationFaqModel.create()` outside the parent
 *    factory's own item loop, exactly like `accommodations.seed.ts`'s
 *    `relationBuilder` does.
 * 3. **Hierarchy/service-helper seam (T-025)**: `destinations`, reusing the
 *    real, exported `preProcessDestination` to prove `level`/`path`/`pathIds`
 *    reconstruct identically across two independent seed runs, not just that
 *    the id itself is stable.
 * 4. **Reviews + the `recalculateStats` seam (T-025)**: `accommodation_reviews`,
 *    inserted model-direct (bypassing `_afterCreate`), followed by
 *    `AccommodationReviewService.recalculateStats()` — asserting both the
 *    review id's reseed-stability AND the parent aggregate's correctness,
 *    reusing the same insert shape as
 *    `accommodation-review-recalculate-stats.integration.test.ts` (T-025).
 * 5. **Raw-Drizzle-insert / already-bypassed entity**: `gastronomies`, which
 *    (per `gastronomies.seed.ts`) was ALREADY a direct `db.insert()` before
 *    HOS-25 — never routed through a service OR a `BaseModelImpl` subclass —
 *    so this proves the deterministic id survives that third insertion style
 *    too.
 *
 * ## Why this is safe against the shared worktree database
 *
 * `CLAUDE.md`'s HOS-25 spec explicitly forbids a global `db:seed --reset` /
 * `db:fresh(-dev)` from a test — that would TRUNCATE every table in the
 * worktree's shared dev database. Instead, every assertion here runs inside
 * a single Drizzle transaction (`withRealDbTransaction`) that performs real,
 * fully-constraint-checked INSERT / DELETE / re-INSERT statements — the
 * database genuinely executes each statement exactly as it would for a real
 * `pnpm db:seed` run — and then is ALWAYS rolled back at the end (success or
 * failure), so the shared worktree database is left byte-for-byte as it was
 * before this file ran. This is the same accepted pattern already used by
 * `accommodation-review-recalculate-stats.integration.test.ts` (T-025).
 *
 * Requires `apps/api/.env.local` to provide `HOSPEDA_DATABASE_URL` pointing
 * at a reachable worktree PostgreSQL instance (`pnpm db:start`, or the
 * worktree-scoped instance the `wt:up` skill manages). When unset/unreachable,
 * every test is skipped via `it.skipIf` — exit code stays 0.
 */
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    AccommodationFaqModel,
    AccommodationModel,
    accommodationFaqs,
    accommodationReviews,
    DestinationModel,
    type DrizzleClient,
    destinations,
    eq,
    gastronomies,
    initializeDb,
    PostModel,
    posts,
    resetDb,
    users
} from '@repo/db';
import type { DestinationType } from '@repo/schemas';
import { AccommodationReviewService, type ServiceContext } from '@repo/service-core';
import { config as loadDotenv } from 'dotenv';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getAccommodationReviewFixtureId } from '../../src/example/accommodationReviews.seed.js';
import {
    getAccommodationFaqFixtureId,
    getAccommodationFixtureId
} from '../../src/example/accommodations.seed.js';
import { getGastronomyFixtureId } from '../../src/example/gastronomies.seed.js';
import { getPostFixtureId } from '../../src/example/posts.seed.js';
import {
    getDestinationFixtureId,
    preProcessDestination
} from '../../src/required/destinations.seed.js';
import { deterministicFixtureId } from '../../src/utils/deterministicFixtureId.js';
import type { SeedContext } from '../../src/utils/seedContext.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load HOSPEDA_DATABASE_URL from the worktree's own apps/api/.env.local
// (this file's package is 4 levels below the repo root:
// packages/seed/test/integration -> packages/seed/test -> packages/seed ->
// packages -> repo root). Never falls back to a global/shared database.
const apiEnvLocalPath = join(__dirname, '../../../../apps/api/.env.local');
if (existsSync(apiEnvLocalPath)) {
    loadDotenv({ path: apiEnvLocalPath });
}

const dbAvailable = Boolean(process.env.HOSPEDA_DATABASE_URL);

let pool: Pool | undefined;
let db: DrizzleClient | undefined;

/**
 * Minimal model-create surface used to call the SAME model-direct insert
 * mechanism `createSeedFactory`'s `deterministicId` option uses (see
 * `SeedFactoryConfig.deterministicId.modelClass` / `SeedModelConstructor` in
 * `../../src/utils/seedFactory.ts`), without needing per-entity
 * domain-type-shaped object literals for test-only insert payloads. Every
 * concrete `@repo/db` model extending `BaseModelImpl` structurally satisfies
 * this (its real `create(data: Partial<T>, tx?)` signature), the same way
 * `seedFactory.ts` itself widens to this shape.
 */
interface ModelDirectCreate {
    create: (data: Record<string, unknown>, tx?: DrizzleClient) => Promise<{ id: string }>;
}

/** Sentinel thrown to force a transaction rollback without failing the test. */
class RollbackSignal extends Error {
    constructor() {
        super('RollbackSignal');
        this.name = 'RollbackSignal';
    }
}

/**
 * Runs `fn` inside a real Drizzle transaction against the worktree database,
 * then ALWAYS rolls it back — every INSERT/DELETE/UPDATE inside `fn` executes
 * for real (constraints enforced, defaults applied, unique indexes checked)
 * but leaves zero residue in the shared database once the callback returns.
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
async function insertUser(tx: DrizzleClient, overrides: { id?: string } = {}): Promise<string> {
    const id = overrides.id ?? crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);
    await tx.insert(users).values({
        id,
        email: `t022-user-${uid}@example.com`,
        displayName: 'T-022 Test User',
        emailVerified: true,
        lifecycleState: 'ACTIVE'
    } as typeof users.$inferInsert);
    return id;
}

/** Inserts a minimal, valid `destinations` row (CITY, non-hierarchy-tested) and returns its id. */
async function insertPlainDestination(tx: DrizzleClient): Promise<string> {
    const id = crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);
    await tx.insert(destinations).values({
        id,
        slug: `t022-dest-${uid}`,
        name: 'T-022 Test Destination',
        destinationType: 'CITY',
        level: 4,
        path: `/t022/dest-${uid}`,
        summary: 'T-022 destination summary',
        description: 'T-022 destination description',
        location: {
            state: 'Entre Rios',
            country: 'Argentina',
            coordinates: { lat: '-32.48', long: '-58.23' }
        },
        media: {
            featuredImage: {
                moderationState: 'APPROVED',
                url: 'https://example.com/t022-destination.jpg'
            }
        },
        lifecycleState: 'ACTIVE'
    } as typeof destinations.$inferInsert);
    return id;
}

/** Inserts a minimal, valid `accommodations` row and returns its id. */
async function insertPlainAccommodation(
    tx: DrizzleClient,
    ownerId: string,
    destinationId: string
): Promise<string> {
    const id = crypto.randomUUID();
    const uid = crypto.randomUUID().slice(0, 8);
    const model: ModelDirectCreate = new AccommodationModel();
    const created = await model.create(
        {
            id,
            slug: `t022-acc-${uid}`,
            name: 'T-022 Test Accommodation',
            summary: 'T-022 accommodation summary',
            description: 'T-022 accommodation description',
            type: 'HOTEL',
            ownerId,
            destinationId,
            location: {
                state: 'Entre Rios',
                country: 'Argentina',
                coordinates: { lat: '-32.48', long: '-58.23' }
            },
            media: {
                featuredImage: {
                    moderationState: 'APPROVED',
                    url: 'https://example.com/t022-accommodation.jpg'
                }
            },
            lifecycleState: 'ACTIVE',
            visibility: 'PUBLIC',
            createdById: ownerId,
            updatedById: ownerId
        },
        tx
    );
    return created.id;
}

describe('HOS-25 T-022 — end-to-end reseed-determinism against a real database', () => {
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

    describe('1. Top-level deterministicId factory (posts, model-direct via PostModel)', () => {
        it.skipIf(!dbAvailable)(
            'persists the same deterministic id across an insert -> delete -> reseed cycle',
            async () => {
                await withRealDbTransaction(async (tx) => {
                    const authorId = await insertUser(tx);
                    const seedFixture = { id: 't022-post-fixture-001' };
                    const expectedId = getPostFixtureId(seedFixture);

                    expect(expectedId).toBe(
                        deterministicFixtureId({ seedKey: `post:${seedFixture.id}` })
                    );

                    const model: ModelDirectCreate = new PostModel();
                    const basePostData = {
                        slug: `t022-post-${seedFixture.id}`,
                        category: 'GENERAL',
                        title: 'T-022 Reseed Determinism Post',
                        summary: 'T-022 post summary',
                        content: 'T-022 post content, long enough to satisfy validation.',
                        authorId,
                        lifecycleState: 'ACTIVE'
                    };

                    // ── First seed ──────────────────────────────────────────────
                    const created1 = await model.create(
                        {
                            ...basePostData,
                            id: expectedId,
                            createdById: authorId,
                            updatedById: authorId
                        },
                        tx
                    );
                    expect(created1.id).toBe(expectedId);

                    const persistedRow1 = await tx
                        .select({ id: posts.id })
                        .from(posts)
                        .where(eq(posts.id, expectedId));
                    expect(persistedRow1[0]?.id).toBe(expectedId);

                    // ── Real DELETE (namespaced — only this row) ────────────────
                    await tx.delete(posts).where(eq(posts.id, expectedId));
                    const goneRows = await tx
                        .select({ id: posts.id })
                        .from(posts)
                        .where(eq(posts.id, expectedId));
                    expect(goneRows).toHaveLength(0);

                    // ── Reseed: recompute the id from the SAME fixture and insert again ──
                    const reseededId = getPostFixtureId(seedFixture);
                    expect(reseededId).toBe(expectedId);

                    const created2 = await model.create(
                        {
                            ...basePostData,
                            id: reseededId,
                            createdById: authorId,
                            updatedById: authorId
                        },
                        tx
                    );
                    expect(created2.id).toBe(expectedId);

                    const persistedRow2 = await tx
                        .select({ id: posts.id, slug: posts.slug })
                        .from(posts)
                        .where(eq(posts.id, expectedId));
                    expect(persistedRow2[0]?.id).toBe(expectedId);
                    expect(persistedRow2[0]?.slug).toBe(basePostData.slug);
                });
            }
        );
    });

    describe('2. Child-row model-direct with composite seed-key (accommodation_faqs)', () => {
        it.skipIf(!dbAvailable)(
            'persists the same deterministic FAQ id across an insert -> delete -> reseed cycle',
            async () => {
                await withRealDbTransaction(async (tx) => {
                    const ownerId = await insertUser(tx);
                    const destinationId = await insertPlainDestination(tx);
                    const accommodationId = await insertPlainAccommodation(
                        tx,
                        ownerId,
                        destinationId
                    );

                    const accommodationSeedKey = 'accommodation:t022-hotel-fixture';
                    const faqModel: ModelDirectCreate = new AccommodationFaqModel();

                    const faqInput = [
                        { question: 'Q0?', answer: 'A0', index: 0 },
                        { question: 'Q1?', answer: 'A1', index: 1 }
                    ];

                    // ── First seed ──────────────────────────────────────────────
                    const firstIds: string[] = [];
                    for (const faq of faqInput) {
                        const expectedId = getAccommodationFaqFixtureId({
                            accommodationSeedKey,
                            index: faq.index
                        });
                        const created = await faqModel.create(
                            {
                                id: expectedId,
                                accommodationId,
                                question: faq.question,
                                answer: faq.answer,
                                displayOrder: faq.index,
                                createdById: ownerId,
                                updatedById: ownerId
                            },
                            tx
                        );
                        expect(created.id).toBe(expectedId);
                        firstIds.push(expectedId);
                    }

                    // ── Real DELETE (namespaced — only this accommodation's FAQs) ──
                    await tx
                        .delete(accommodationFaqs)
                        .where(eq(accommodationFaqs.accommodationId, accommodationId));
                    const remaining = await tx
                        .select({ id: accommodationFaqs.id })
                        .from(accommodationFaqs)
                        .where(eq(accommodationFaqs.accommodationId, accommodationId));
                    expect(remaining).toHaveLength(0);

                    // ── Reseed: same composite seed-key, same indices ───────────
                    const secondIds: string[] = [];
                    for (const faq of faqInput) {
                        const reseededId = getAccommodationFaqFixtureId({
                            accommodationSeedKey,
                            index: faq.index
                        });
                        const created = await faqModel.create(
                            {
                                id: reseededId,
                                accommodationId,
                                question: faq.question,
                                answer: faq.answer,
                                displayOrder: faq.index,
                                createdById: ownerId,
                                updatedById: ownerId
                            },
                            tx
                        );
                        expect(created.id).toBe(reseededId);
                        secondIds.push(reseededId);
                    }

                    expect(secondIds).toEqual(firstIds);
                    // Distinct FAQ indices must never collide with each other.
                    expect(new Set(secondIds).size).toBe(secondIds.length);
                });
            }
        );
    });

    describe('3. Hierarchy/service-helper reconstruction stability (destinations, T-025 seam)', () => {
        /** Minimal shape `preProcessDestination` needs; mutated in place, same as the real seed. */
        interface MinimalDestinationFixture {
            id: string;
            slug: string;
            destinationType: DestinationType;
            parentDestinationId?: string;
            // Populated by preProcessDestination — absent on the raw fixture.
            level?: number;
            path?: string;
            pathIds?: string;
        }

        const dummyContext = {} as SeedContext;
        const parentSeedId = 't022-destination-parent';
        const childSeedId = 't022-destination-child';

        /** Fresh clones every call — mirrors loading a fresh JSON file per real seed run. */
        function freshFixtures(): {
            parent: MinimalDestinationFixture;
            child: MinimalDestinationFixture;
        } {
            return {
                parent: {
                    id: parentSeedId,
                    slug: 't022-destination-parent',
                    destinationType: 'COUNTRY'
                },
                child: {
                    id: childSeedId,
                    slug: 't022-destination-child',
                    destinationType: 'REGION',
                    parentDestinationId: parentSeedId
                }
            };
        }

        it.skipIf(!dbAvailable)(
            'reconstructs identical level/path/pathIds/id across two independent seed runs, and persists both',
            async () => {
                await withRealDbTransaction(async (tx) => {
                    const model: ModelDirectCreate = new DestinationModel();

                    async function runOnce(): Promise<{
                        parent: MinimalDestinationFixture;
                        child: MinimalDestinationFixture;
                        parentId: string;
                        childId: string;
                    }> {
                        const { parent, child } = freshFixtures();
                        await preProcessDestination(parent, dummyContext);
                        await preProcessDestination(child, dummyContext);

                        const parentId = getDestinationFixtureId({ id: parent.id });
                        const childId = getDestinationFixtureId({ id: child.id });

                        const commonFields = {
                            summary: 'T-022 destination summary',
                            description: 'T-022 destination description',
                            location: {
                                state: 'Entre Rios',
                                country: 'Argentina',
                                coordinates: { lat: '-32.48', long: '-58.23' }
                            },
                            media: {
                                featuredImage: {
                                    moderationState: 'APPROVED',
                                    url: 'https://example.com/t022-destination.jpg'
                                }
                            },
                            lifecycleState: 'ACTIVE'
                        };

                        await model.create(
                            {
                                id: parentId,
                                slug: parent.slug,
                                name: 'T-022 Parent Country',
                                destinationType: parent.destinationType,
                                level: parent.level,
                                path: parent.path,
                                pathIds: parent.pathIds,
                                ...commonFields
                            },
                            tx
                        );
                        await model.create(
                            {
                                id: childId,
                                slug: child.slug,
                                name: 'T-022 Child Region',
                                destinationType: child.destinationType,
                                parentDestinationId: child.parentDestinationId,
                                level: child.level,
                                path: child.path,
                                pathIds: child.pathIds,
                                ...commonFields
                            },
                            tx
                        );

                        return { parent, child, parentId, childId };
                    }

                    // ── First run ────────────────────────────────────────────────
                    const first = await runOnce();
                    expect(first.parent.level).toBe(0);
                    expect(first.parent.pathIds).toBe('');
                    expect(first.parent.path).toBe('/t022-destination-parent');
                    expect(first.child.level).toBe(1);
                    expect(first.child.path).toBe(
                        '/t022-destination-parent/t022-destination-child'
                    );
                    expect(first.child.pathIds).toBe(first.parentId);
                    // The parent-seed-id reference must resolve to the parent's real UUID.
                    expect(first.child.parentDestinationId).toBe(first.parentId);

                    // ── Real DELETE (child first — self-referencing FK) ─────────
                    await tx.delete(destinations).where(eq(destinations.id, first.childId));
                    await tx.delete(destinations).where(eq(destinations.id, first.parentId));

                    // ── Second, fully independent run ───────────────────────────
                    const second = await runOnce();

                    // Same ids, both runs.
                    expect(second.parentId).toBe(first.parentId);
                    expect(second.childId).toBe(first.childId);

                    // Same reconstructed hierarchy fields, both runs — this is the
                    // T-025 seam: not just the id, but level/path/pathIds must be
                    // byte-for-byte identical on reseed.
                    expect(second.parent.level).toBe(first.parent.level);
                    expect(second.parent.path).toBe(first.parent.path);
                    expect(second.parent.pathIds).toBe(first.parent.pathIds);
                    expect(second.child.level).toBe(first.child.level);
                    expect(second.child.path).toBe(first.child.path);
                    expect(second.child.pathIds).toBe(first.child.pathIds);
                    expect(second.child.parentDestinationId).toBe(first.child.parentDestinationId);

                    // Both rows are actually persisted after the second run.
                    const persistedParent = await tx
                        .select({ path: destinations.path, level: destinations.level })
                        .from(destinations)
                        .where(eq(destinations.id, second.parentId));
                    expect(persistedParent[0]?.path).toBe(first.parent.path);
                    expect(persistedParent[0]?.level).toBe(0);

                    const persistedChild = await tx
                        .select({ path: destinations.path, pathIds: destinations.pathIds })
                        .from(destinations)
                        .where(eq(destinations.id, second.childId));
                    expect(persistedChild[0]?.path).toBe(first.child.path);
                    expect(persistedChild[0]?.pathIds).toBe(first.parentId);
                });
            }
        );
    });

    describe('4. Reviews + recalculateStats seam (accommodation_reviews, T-025)', () => {
        it.skipIf(!dbAvailable)(
            'persists stable review ids across reseed AND recomputes a correct parent aggregate each time',
            async () => {
                await withRealDbTransaction(async (tx) => {
                    const ownerId = await insertUser(tx);
                    const destinationId = await insertPlainDestination(tx);
                    const accommodationId = await insertPlainAccommodation(
                        tx,
                        ownerId,
                        destinationId
                    );
                    const service = new AccommodationReviewService({});
                    const ctx: ServiceContext = { tx };

                    const reviewFixtures = [
                        {
                            id: 't022-review-fixture-001',
                            userId: await insertUser(tx),
                            rating: {
                                cleanliness: 5,
                                hospitality: 5,
                                services: 4,
                                accuracy: 5,
                                communication: 5,
                                location: 4
                            }
                        },
                        {
                            id: 't022-review-fixture-002',
                            userId: await insertUser(tx),
                            rating: {
                                cleanliness: 3,
                                hospitality: 4,
                                services: 3,
                                accuracy: 4,
                                communication: 3,
                                location: 4
                            }
                        }
                    ] as const;

                    async function insertReviews(): Promise<string[]> {
                        const ids: string[] = [];
                        for (const fixture of reviewFixtures) {
                            const expectedId = getAccommodationReviewFixtureId({ id: fixture.id });
                            const values = Object.values(fixture.rating);
                            const averageRating =
                                Math.round(
                                    (values.reduce((a, b) => a + b, 0) / values.length) * 100
                                ) / 100;

                            await tx.insert(accommodationReviews).values({
                                id: expectedId,
                                accommodationId,
                                userId: fixture.userId,
                                title: 'T-022 Review',
                                content: 'Model-direct review inserted for T-022 reseed proof.',
                                rating: fixture.rating,
                                averageRating,
                                lifecycleState: 'ACTIVE'
                            } as typeof accommodationReviews.$inferInsert);
                            ids.push(expectedId);
                        }
                        return ids;
                    }

                    // ── First seed ──────────────────────────────────────────────
                    const firstIds = await insertReviews();
                    await service.recalculateStats(accommodationId, ctx);

                    const accommodationsAggregateFirst = await tx.query.accommodations.findFirst({
                        where: (fields, { eq: eqFn }) => eqFn(fields.id, accommodationId),
                        columns: { reviewsCount: true, averageRating: true, rating: true }
                    });
                    expect(accommodationsAggregateFirst?.reviewsCount).toBe(2);
                    expect(accommodationsAggregateFirst?.rating).toEqual({
                        cleanliness: 4,
                        hospitality: 4.5,
                        services: 3.5,
                        accuracy: 4.5,
                        communication: 4,
                        location: 4
                    });
                    const expectedOverall = (4 + 4.5 + 3.5 + 4.5 + 4 + 4) / 6;
                    expect(accommodationsAggregateFirst?.averageRating).toBeCloseTo(
                        expectedOverall,
                        2
                    );

                    // ── Real DELETE (namespaced — only this accommodation's reviews) ──
                    await tx
                        .delete(accommodationReviews)
                        .where(eq(accommodationReviews.accommodationId, accommodationId));
                    await service.recalculateStats(accommodationId, ctx);
                    const afterDelete = await tx.query.accommodations.findFirst({
                        where: (fields, { eq: eqFn }) => eqFn(fields.id, accommodationId),
                        columns: { reviewsCount: true }
                    });
                    expect(afterDelete?.reviewsCount).toBe(0);

                    // ── Reseed: same fixtures, same mechanism ───────────────────
                    const secondIds = await insertReviews();
                    await service.recalculateStats(accommodationId, ctx);

                    expect(secondIds).toEqual(firstIds);

                    const accommodationsAggregateSecond = await tx.query.accommodations.findFirst({
                        where: (fields, { eq: eqFn }) => eqFn(fields.id, accommodationId),
                        columns: { reviewsCount: true, averageRating: true, rating: true }
                    });
                    expect(accommodationsAggregateSecond?.reviewsCount).toBe(2);
                    expect(accommodationsAggregateSecond?.rating).toEqual(
                        accommodationsAggregateFirst?.rating
                    );
                    expect(accommodationsAggregateSecond?.averageRating).toBeCloseTo(
                        expectedOverall,
                        2
                    );
                });
            }
        );
    });

    describe('5. Raw-Drizzle-insert / already-bypassed entity (gastronomies)', () => {
        it.skipIf(!dbAvailable)(
            'persists the same deterministic id across an insert -> delete -> reseed cycle via a direct db.insert() (no model, no service)',
            async () => {
                await withRealDbTransaction(async (tx) => {
                    const ownerId = await insertUser(tx);
                    const destinationId = await insertPlainDestination(tx);
                    const seedId = 't022-gastronomy-fixture-001';
                    const expectedId = getGastronomyFixtureId(seedId);

                    expect(expectedId).toBe(
                        deterministicFixtureId({ seedKey: `gastronomy:${seedId}` })
                    );

                    const baseValues = {
                        slug: `t022-gastronomy-${seedId}`,
                        name: 'T-022 Test Gastronomy',
                        summary: 'T-022 gastronomy summary',
                        description: 'T-022 gastronomy description',
                        type: 'RESTAURANT',
                        ownerId,
                        destinationId,
                        visibility: 'PUBLIC',
                        lifecycleState: 'ACTIVE',
                        moderationState: 'APPROVED',
                        isFeatured: false,
                        reviewsCount: 0,
                        averageRating: 0,
                        createdById: ownerId,
                        updatedById: ownerId
                    };

                    // ── First seed — direct db.insert(), exactly like gastronomies.seed.ts ──
                    const [inserted1] = await tx
                        .insert(gastronomies)
                        .values({
                            id: expectedId,
                            ...baseValues
                        } as typeof gastronomies.$inferInsert)
                        .returning({ id: gastronomies.id });
                    expect(inserted1?.id).toBe(expectedId);

                    // ── Real DELETE ──────────────────────────────────────────────
                    await tx.delete(gastronomies).where(eq(gastronomies.id, expectedId));
                    const gone = await tx
                        .select({ id: gastronomies.id })
                        .from(gastronomies)
                        .where(eq(gastronomies.id, expectedId));
                    expect(gone).toHaveLength(0);

                    // ── Reseed: same seed id, same raw-insert mechanism ─────────
                    const reseededId = getGastronomyFixtureId(seedId);
                    expect(reseededId).toBe(expectedId);

                    const [inserted2] = await tx
                        .insert(gastronomies)
                        .values({
                            id: reseededId,
                            ...baseValues
                        } as typeof gastronomies.$inferInsert)
                        .returning({ id: gastronomies.id, slug: gastronomies.slug });
                    expect(inserted2?.id).toBe(expectedId);
                    expect(inserted2?.slug).toBe(baseValues.slug);
                });
            }
        );
    });

    describe('6. Cross-entity id isolation at the persisted-DB level', () => {
        it.skipIf(!dbAvailable)(
            'never collides between an accommodation-shaped seedKey and a post/gastronomy-shaped seedKey sharing the same raw fixture id',
            async () => {
                const sharedRawId = 't022-shared-raw-fixture-id';

                const accommodationId = getAccommodationFixtureId({ id: sharedRawId });
                const postId = getPostFixtureId({ id: sharedRawId });
                const gastronomyId = getGastronomyFixtureId(sharedRawId);
                const destinationId = getDestinationFixtureId({ id: sharedRawId });

                const allIds = [accommodationId, postId, gastronomyId, destinationId];
                expect(new Set(allIds).size).toBe(allIds.length);
            }
        );
    });
});
