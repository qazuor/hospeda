import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
/**
 * Unit tests for the INTERNAL tags seed (SPEC-086 R-2).
 *
 * The seed accepts an optional `TagModelPort` override and an optional `dataDirOverride`,
 * so all tests use in-memory stubs and a temporary directory with synthetic JSON files —
 * no live database connection required.
 *
 * Pattern mirrors `test/required/systemUser.seed.test.ts`.
 *
 * References: AC-F20, R-2, tag-seeds.md
 */
import { resolve } from 'node:path';
import { join } from 'node:path';
import { TagTypeEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TagModelPort } from '../../src/required/internalTags.seed.js';
import { seedInternalTags } from '../../src/required/internalTags.seed.js';

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
// Synthetic data directory with a small set of internal-*.json files.
// ---------------------------------------------------------------------------

/** Absolute path to the temp dir created for each test suite run. */
let testDataDir: string;

/**
 * Writes the provided tag definitions as `internal-NNN-{slug}.json` files
 * in the test data directory.
 */
function writeInternalTagFiles(
    tags: Array<{ name: string; description: string; color: string; lifecycleState: string }>
): void {
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const num = String(i + 1).padStart(3, '0');
        const slug = (tag?.name ?? 'unknown').toLowerCase().replace(/\s+/g, '-');
        const filename = `internal-${num}-${slug}.json`;
        writeFileSync(join(testDataDir, filename), JSON.stringify(tag, null, 2), 'utf-8');
    }
}

// ---------------------------------------------------------------------------
// In-memory stub satisfying TagModelPort.
// ---------------------------------------------------------------------------

/** In-memory store of created tags (simulates the DB). */
let store: Array<Record<string, unknown>> = [];

/** Controls what findOne returns — null means "tag does not exist". */
let findOneReturnValue: Record<string, unknown> | null = null;

/** Whether `findOneReturnValue` is applied to ALL calls (true) or only the first (false). */
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
 * `findOne` checks the in-memory `store` when `alwaysFound` is false,
 * or unconditionally returns `findOneReturnValue` when true.
 */
function buildStubModel(): TagModelPort {
    return {
        async findOne(filter: Partial<Record<string, unknown>>) {
            if (alwaysFound) {
                return findOneReturnValue;
            }
            if (findOneReturnValue !== null) {
                return findOneReturnValue;
            }
            // Check the in-memory store for an existing row matching type+name.
            const match = store.find((row) => row.type === filter.type && row.name === filter.name);
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
    // Create a unique temp dir for this test file.
    testDataDir = join(tmpdir(), `hospeda-seed-internal-tags-test-${Date.now()}`);
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

    // Clear all files from previous test
    const entries = vi.importMeta?.env ? [] : [];
    void entries; // no-op — actual cleanup is via rmSync+mkdirSync per test
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

describe('seedInternalTags (SPEC-086 R-2)', () => {
    describe('when INTERNAL tags do not yet exist', () => {
        it('should call create once per JSON file found in the data directory', async () => {
            // Arrange: write 3 synthetic tag files
            writeInternalTagFiles([
                {
                    name: 'Tag Uno',
                    description: 'Desc uno',
                    color: 'RED',
                    lifecycleState: 'ACTIVE'
                },
                {
                    name: 'Tag Dos',
                    description: 'Desc dos',
                    color: 'BLUE',
                    lifecycleState: 'ACTIVE'
                },
                {
                    name: 'Tag Tres',
                    description: 'Desc tres',
                    color: 'GREEN',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            // Act
            await seedInternalTags(model, testDataDir);

            // Assert
            expect(createCallCount).toBe(3);
        });

        it('should insert each tag with type = INTERNAL', async () => {
            writeInternalTagFiles([
                {
                    name: 'Tag Alpha',
                    description: 'Desc',
                    color: 'ORANGE',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedInternalTags(model, testDataDir);

            expect(lastCreateArg?.type).toBe(TagTypeEnum.INTERNAL);
        });

        it('should insert each tag with ownerId = null', async () => {
            writeInternalTagFiles([
                { name: 'Tag Beta', description: 'Desc', color: 'PURPLE', lifecycleState: 'ACTIVE' }
            ]);
            const model = buildStubModel();

            await seedInternalTags(model, testDataDir);

            expect(lastCreateArg?.ownerId).toBeNull();
        });

        it('should insert each tag with createdById = SYSTEM_USER_ID', async () => {
            writeInternalTagFiles([
                {
                    name: 'Tag Gamma',
                    description: 'Desc',
                    color: 'YELLOW',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedInternalTags(model, testDataDir);

            expect(lastCreateArg?.createdById).toBe(SYSTEM_USER_ID);
        });

        it('should NOT include a slug field in the inserted row', async () => {
            writeInternalTagFiles([
                { name: 'Tag Delta', description: 'Desc', color: 'GREY', lifecycleState: 'ACTIVE' }
            ]);
            const model = buildStubModel();

            await seedInternalTags(model, testDataDir);

            expect('slug' in (lastCreateArg ?? {})).toBe(false);
        });

        it('should set lifecycleState from the JSON fixture', async () => {
            writeInternalTagFiles([
                {
                    name: 'Tag Epsilon',
                    description: 'Desc',
                    color: 'BROWN',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedInternalTags(model, testDataDir);

            expect(lastCreateArg?.lifecycleState).toBe('ACTIVE');
        });
    });

    describe('idempotency — when INTERNAL tags already exist', () => {
        it('should NOT call create for tags that are already in the DB', async () => {
            // Arrange: one tag file, stub always returns "found"
            writeInternalTagFiles([
                {
                    name: 'Revisar contenido',
                    description: 'Desc',
                    color: 'ORANGE',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            alwaysFound = true;
            findOneReturnValue = {
                id: 'existing-uuid',
                name: 'Revisar contenido',
                type: 'INTERNAL'
            };
            const model = buildStubModel();

            // Act
            await seedInternalTags(model, testDataDir);

            // Assert
            expect(createCallCount).toBe(0);
        });

        it('should resolve without error when all tags already exist', async () => {
            writeInternalTagFiles([
                {
                    name: 'Revisar contenido',
                    description: 'Desc',
                    color: 'ORANGE',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            alwaysFound = true;
            findOneReturnValue = {
                id: 'existing-uuid',
                name: 'Revisar contenido',
                type: 'INTERNAL'
            };
            const model = buildStubModel();

            await expect(seedInternalTags(model, testDataDir)).resolves.toBeUndefined();
        });

        it('should skip existing tags but create new ones (partial idempotency)', async () => {
            // Arrange: two tag files, one pre-seeded
            writeInternalTagFiles([
                { name: 'Ya existe', description: 'Desc', color: 'RED', lifecycleState: 'ACTIVE' },
                { name: 'No existe', description: 'Desc', color: 'BLUE', lifecycleState: 'ACTIVE' }
            ]);
            // Pre-seed "Ya existe" in the store
            store.push({ id: 'pre-existing', name: 'Ya existe', type: 'INTERNAL' });
            const model = buildStubModel();

            await seedInternalTags(model, testDataDir);

            // Only "No existe" should have been inserted
            expect(createCallCount).toBe(1);
            expect(lastCreateArg?.name).toBe('No existe');
        });

        it('should be safe to run twice (second run creates 0 rows)', async () => {
            writeInternalTagFiles([
                { name: 'Tag Uno', description: 'Desc', color: 'RED', lifecycleState: 'ACTIVE' },
                { name: 'Tag Dos', description: 'Desc', color: 'BLUE', lifecycleState: 'ACTIVE' }
            ]);
            const model = buildStubModel();

            // First run: creates 2 rows
            await seedInternalTags(model, testDataDir);
            expect(createCallCount).toBe(2);

            // Second run: store now has both tags — should create 0
            const countBefore = createCallCount;
            await seedInternalTags(model, testDataDir);
            expect(createCallCount).toBe(countBefore); // No new creates
        });
    });

    describe('counts matching the canonical tag-seeds.md list', () => {
        it('should create exactly 25 rows when seeding the real data directory', async () => {
            // Use the real data dir — no DB needed because we use a counting stub

            const realDataDir = resolve(import.meta.dirname, '../../src/data/tag');

            const model = buildStubModel();
            await seedInternalTags(model, realDataDir);

            expect(createCallCount).toBe(25);
        });
    });

    describe('error handling', () => {
        it('should propagate errors thrown by the DB create call', async () => {
            writeInternalTagFiles([
                { name: 'Tag Error', description: 'Desc', color: 'RED', lifecycleState: 'ACTIVE' }
            ]);
            createShouldThrow = new Error('DB connection lost');
            const model = buildStubModel();

            await expect(seedInternalTags(model, testDataDir)).rejects.toThrow(
                'DB connection lost'
            );
        });
    });
});
