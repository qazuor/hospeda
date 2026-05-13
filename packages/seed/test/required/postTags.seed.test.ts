import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
/**
 * Unit tests for the PostTag seed (SPEC-086 R-4).
 *
 * The seed accepts an optional `PostTagModelPort` override and an optional
 * `dataDirOverride`, so all tests use in-memory stubs and a temporary directory
 * with synthetic JSON files — no live database connection required.
 *
 * Pattern mirrors `test/required/internalTags.seed.test.ts` and
 * `test/required/systemTags.seed.test.ts` from T-037.
 *
 * Key differences from INTERNAL/SYSTEM seeds:
 *   - PostTags HAVE a `slug` field (public URL exposure — D-018).
 *   - Idempotency guard is by `slug` (unique key for PostTags), not `(type, name)`.
 *   - No `type` or `ownerId` columns — PostTags are a separate subsystem (D-001).
 *   - JSON files have no prefix (all `.json` files in `data/postTag/` are PostTags).
 *
 * References: AC-F20, R-4, tag-seeds.md
 */
import { resolve } from 'node:path';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PostTagModelPort } from '../../src/required/postTags.seed.js';
import { seedPostTags } from '../../src/required/postTags.seed.js';

// Use literal constant to avoid workspace module resolution issues in Vitest.
// Must match packages/db/src/constants/index.ts.
const SYSTEM_USER_ID = 'a0000000-0000-4000-8000-000000000001' as const;

// ---------------------------------------------------------------------------
// Silence logger and summaryTracker in all tests.
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('../../src/utils/summaryTracker.js', () => ({
    summaryTracker: {
        trackSuccess: vi.fn(),
        trackError: vi.fn()
    }
}));

// ---------------------------------------------------------------------------
// Synthetic data directory with a small set of NNN-{slug}.json files.
// ---------------------------------------------------------------------------

/** Absolute path to the temp dir created for this test suite run. */
let testDataDir: string;

/**
 * Writes the provided PostTag definitions as `NNN-{slug}.json` files
 * in the test data directory.
 */
function writePostTagFiles(
    tags: Array<{
        name: string;
        slug: string;
        description: string;
        color: string;
        lifecycleState: string;
    }>
): void {
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const num = String(i + 1).padStart(3, '0');
        const slug = tag?.slug ?? 'unknown-slug';
        const filename = `${num}-${slug}.json`;
        writeFileSync(join(testDataDir, filename), JSON.stringify(tag, null, 2), 'utf-8');
    }
}

// ---------------------------------------------------------------------------
// In-memory stub satisfying PostTagModelPort.
// ---------------------------------------------------------------------------

/** In-memory store of created PostTags (simulates the DB). */
let store: Array<Record<string, unknown>> = [];

/** Controls what findOne returns — null means "PostTag does not exist". */
let findOneReturnValue: Record<string, unknown> | null = null;

/** Whether `findOneReturnValue` is applied to ALL calls (true) or only by store lookup (false). */
let alwaysFound = false;

/** Number of times `create` was called. */
let createCallCount = 0;

/** Captures the most recent argument passed to `create`. */
let lastCreateArg: Record<string, unknown> | null = null;

/** When set, `create` throws this error. */
let createShouldThrow: Error | null = null;

/**
 * Builds a fresh in-memory stub for each test.
 *
 * `findOne` checks the in-memory `store` by `slug` when `alwaysFound` is false,
 * or unconditionally returns `findOneReturnValue` when true.
 */
function buildStubModel(): PostTagModelPort {
    return {
        async findOne(filter: Partial<Record<string, unknown>>) {
            if (alwaysFound) {
                return findOneReturnValue;
            }
            if (findOneReturnValue !== null) {
                return findOneReturnValue;
            }
            // Check the in-memory store for an existing row matching slug.
            const match = store.find((row) => row.slug === filter.slug);
            return match ?? null;
        },
        async create(data: Partial<Record<string, unknown>>) {
            createCallCount++;
            lastCreateArg = data as Record<string, unknown>;
            if (createShouldThrow) {
                throw createShouldThrow;
            }
            const row = { id: `fake-uuid-${createCallCount}`, ...data };
            store.push(row);
            return row;
        }
    };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(() => {
    testDataDir = join(tmpdir(), `hospeda-seed-post-tags-test-${Date.now()}`);
    mkdirSync(testDataDir, { recursive: true });
});

afterAll(() => {
    rmSync(testDataDir, { recursive: true, force: true });
});

beforeEach(() => {
    store = [];
    findOneReturnValue = null;
    alwaysFound = false;
    createCallCount = 0;
    lastCreateArg = null;
    createShouldThrow = null;
});

afterEach(() => {
    vi.clearAllMocks();
    // Remove all json files written by the current test.
    try {
        const { readdirSync, unlinkSync } = require('node:fs') as typeof import('node:fs');
        for (const f of readdirSync(testDataDir)) {
            if (f.endsWith('.json')) {
                unlinkSync(join(testDataDir, f));
            }
        }
    } catch {
        // ignore cleanup errors
    }
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('seedPostTags (SPEC-086 R-4)', () => {
    describe('when PostTags do not yet exist', () => {
        it('should call create once per JSON file found in the data directory', async () => {
            // Arrange: write 3 synthetic PostTag files
            writePostTagFiles([
                {
                    name: 'Guía de viaje',
                    slug: 'guia-de-viaje',
                    description: 'Publicaciones con guías prácticas.',
                    color: 'BLUE',
                    lifecycleState: 'ACTIVE'
                },
                {
                    name: 'Naturaleza entrerriana',
                    slug: 'naturaleza-entrerriana',
                    description: 'Paisajes y reservas.',
                    color: 'GREEN',
                    lifecycleState: 'ACTIVE'
                },
                {
                    name: 'Historia',
                    slug: 'historia',
                    description: 'Patrimonio histórico.',
                    color: 'BROWN',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            // Act
            await seedPostTags(model, testDataDir);

            // Assert
            expect(createCallCount).toBe(3);
        });

        it('should insert each PostTag with the slug from the JSON fixture', async () => {
            writePostTagFiles([
                {
                    name: 'Guía de viaje',
                    slug: 'guia-de-viaje',
                    description: 'Desc',
                    color: 'BLUE',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedPostTags(model, testDataDir);

            expect(lastCreateArg?.slug).toBe('guia-de-viaje');
        });

        it('should insert each PostTag with createdById = SYSTEM_USER_ID', async () => {
            writePostTagFiles([
                {
                    name: 'Historia',
                    slug: 'historia',
                    description: 'Desc',
                    color: 'BROWN',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedPostTags(model, testDataDir);

            expect(lastCreateArg?.createdById).toBe(SYSTEM_USER_ID);
        });

        it('should insert each PostTag with lifecycleState from the JSON fixture', async () => {
            writePostTagFiles([
                {
                    name: 'Verano',
                    slug: 'verano',
                    description: 'Desc',
                    color: 'ORANGE',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedPostTags(model, testDataDir);

            expect(lastCreateArg?.lifecycleState).toBe('ACTIVE');
        });

        it('should include the slug field in the inserted row (PostTag has slug — D-018)', async () => {
            writePostTagFiles([
                {
                    name: 'Carnaval',
                    slug: 'carnaval',
                    description: 'Desc',
                    color: 'PURPLE',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedPostTags(model, testDataDir);

            expect(lastCreateArg).not.toBeNull();
            expect('slug' in (lastCreateArg ?? {})).toBe(true);
            expect(lastCreateArg?.slug).toBe('carnaval');
        });

        it('should NOT include a type or ownerId field (PostTag is a separate subsystem — D-001)', async () => {
            writePostTagFiles([
                {
                    name: 'Escapadas',
                    slug: 'escapadas',
                    description: 'Desc',
                    color: 'TEAL',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedPostTags(model, testDataDir);

            expect('type' in (lastCreateArg ?? {})).toBe(false);
            expect('ownerId' in (lastCreateArg ?? {})).toBe(false);
        });

        it('should insert each PostTag with the name from the JSON fixture', async () => {
            writePostTagFiles([
                {
                    name: 'Turismo termal',
                    slug: 'turismo-termal',
                    description: 'Desc',
                    color: 'CYAN',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedPostTags(model, testDataDir);

            expect(lastCreateArg?.name).toBe('Turismo termal');
        });
    });

    describe('idempotency — when PostTags already exist', () => {
        it('should NOT call create for PostTags already in the DB (matched by slug)', async () => {
            // Arrange: one PostTag file, stub always returns "found"
            writePostTagFiles([
                {
                    name: 'Guía de viaje',
                    slug: 'guia-de-viaje',
                    description: 'Desc',
                    color: 'BLUE',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            alwaysFound = true;
            findOneReturnValue = {
                id: 'existing-uuid',
                slug: 'guia-de-viaje',
                name: 'Guía de viaje'
            };
            const model = buildStubModel();

            // Act
            await seedPostTags(model, testDataDir);

            // Assert
            expect(createCallCount).toBe(0);
        });

        it('should resolve without error when all PostTags already exist', async () => {
            writePostTagFiles([
                {
                    name: 'Guía de viaje',
                    slug: 'guia-de-viaje',
                    description: 'Desc',
                    color: 'BLUE',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            alwaysFound = true;
            findOneReturnValue = {
                id: 'existing-uuid',
                slug: 'guia-de-viaje',
                name: 'Guía de viaje'
            };
            const model = buildStubModel();

            await expect(seedPostTags(model, testDataDir)).resolves.toBeUndefined();
        });

        it('should skip existing PostTags but create new ones (partial idempotency)', async () => {
            // Arrange: two PostTag files, one pre-seeded in store by slug
            writePostTagFiles([
                {
                    name: 'Ya existe',
                    slug: 'ya-existe',
                    description: 'Desc',
                    color: 'RED',
                    lifecycleState: 'ACTIVE'
                },
                {
                    name: 'No existe',
                    slug: 'no-existe',
                    description: 'Desc',
                    color: 'BLUE',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            // Pre-seed "Ya existe" in the store
            store.push({ id: 'pre-existing', slug: 'ya-existe', name: 'Ya existe' });
            const model = buildStubModel();

            await seedPostTags(model, testDataDir);

            // Only "No existe" should have been inserted
            expect(createCallCount).toBe(1);
            expect(lastCreateArg?.name).toBe('No existe');
        });

        it('should be safe to run twice (second run creates 0 rows)', async () => {
            writePostTagFiles([
                {
                    name: 'Guía de viaje',
                    slug: 'guia-de-viaje',
                    description: 'Desc',
                    color: 'BLUE',
                    lifecycleState: 'ACTIVE'
                },
                {
                    name: 'Historia',
                    slug: 'historia',
                    description: 'Desc',
                    color: 'BROWN',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            // First run: creates 2 rows
            await seedPostTags(model, testDataDir);
            expect(createCallCount).toBe(2);

            // Second run: store now has both PostTags — should create 0
            const countBefore = createCallCount;
            await seedPostTags(model, testDataDir);
            expect(createCallCount).toBe(countBefore); // No new creates
        });
    });

    describe('counts matching the canonical tag-seeds.md list', () => {
        it('should create exactly 34 rows when seeding the real data directory', async () => {
            // Use the real data dir — no DB needed because we use a counting stub.
            // This verifies that T-038 created exactly 34 PostTag JSON files.

            const realDataDir = resolve(import.meta.dirname, '../../src/data/postTag');

            const model = buildStubModel();
            await seedPostTags(model, realDataDir);

            expect(createCallCount).toBe(34);
        });

        it('should populate slug field for every PostTag in the real data directory', async () => {
            // Verifies that all 34 real JSON files include a non-empty slug.

            const realDataDir = resolve(import.meta.dirname, '../../src/data/postTag');

            const slugsSeen: string[] = [];
            const countingModel: PostTagModelPort = {
                async findOne() {
                    return null; // always absent — we want to see all creates
                },
                async create(data) {
                    const slug = data.slug;
                    if (typeof slug === 'string' && slug.length > 0) {
                        slugsSeen.push(slug);
                    }
                    return { id: `fake-${slugsSeen.length}`, ...data };
                }
            };

            await seedPostTags(countingModel, realDataDir);

            // All 34 PostTags should have a populated slug
            expect(slugsSeen).toHaveLength(34);
            // No slug should be empty
            for (const slug of slugsSeen) {
                expect(slug.length).toBeGreaterThan(0);
            }
        });
    });

    describe('error handling', () => {
        it('should propagate errors thrown by the DB create call', async () => {
            writePostTagFiles([
                {
                    name: 'Tag Error',
                    slug: 'tag-error',
                    description: 'Desc',
                    color: 'RED',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            createShouldThrow = new Error('DB connection lost');
            const model = buildStubModel();

            await expect(seedPostTags(model, testDataDir)).rejects.toThrow('DB connection lost');
        });

        it('should propagate errors thrown by the DB findOne call', async () => {
            writePostTagFiles([
                {
                    name: 'Tag Find Error',
                    slug: 'tag-find-error',
                    description: 'Desc',
                    color: 'RED',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const errorModel: PostTagModelPort = {
                async findOne() {
                    throw new Error('findOne failure');
                },
                async create() {
                    return {};
                }
            };

            await expect(seedPostTags(errorModel, testDataDir)).rejects.toThrow('findOne failure');
        });
    });
});
