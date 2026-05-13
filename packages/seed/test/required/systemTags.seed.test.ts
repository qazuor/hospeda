import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
/**
 * Unit tests for the SYSTEM tags seed (SPEC-086 R-3).
 *
 * The seed accepts an optional `TagModelPort` override and an optional `dataDirOverride`,
 * so all tests use in-memory stubs and a temporary directory with synthetic JSON files —
 * no live database connection required.
 *
 * Pattern mirrors `test/required/systemUser.seed.test.ts` and
 * `test/required/internalTags.seed.test.ts`.
 *
 * References: AC-F20, R-3, tag-seeds.md
 */
import { resolve } from 'node:path';
import { join } from 'node:path';
import { TagTypeEnum } from '@repo/schemas';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TagModelPort } from '../../src/required/systemTags.seed.js';
import { seedSystemTags } from '../../src/required/systemTags.seed.js';

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
// Synthetic data directory with a small set of system-*.json files.
// ---------------------------------------------------------------------------

/** Absolute path to the temp dir created for each test suite run. */
let testDataDir: string;

/**
 * Writes the provided tag definitions as `system-NNN-{slug}.json` files
 * in the test data directory.
 */
function writeSystemTagFiles(
    tags: Array<{ name: string; description: string; color: string; lifecycleState: string }>
): void {
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        const num = String(i + 1).padStart(3, '0');
        const slug = (tag?.name ?? 'unknown').toLowerCase().replace(/\s+/g, '-');
        const filename = `system-${num}-${slug}.json`;
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
    testDataDir = join(tmpdir(), `hospeda-seed-system-tags-test-${Date.now()}`);
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

describe('seedSystemTags (SPEC-086 R-3)', () => {
    describe('when SYSTEM tags do not yet exist', () => {
        it('should call create once per JSON file found in the data directory', async () => {
            writeSystemTagFiles([
                {
                    name: 'Favorito',
                    description: 'Marca favorita',
                    color: 'YELLOW',
                    lifecycleState: 'ACTIVE'
                },
                {
                    name: 'Importante',
                    description: 'Atención especial',
                    color: 'ORANGE',
                    lifecycleState: 'ACTIVE'
                },
                {
                    name: 'Urgente',
                    description: 'Acción rápida',
                    color: 'RED',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedSystemTags(model, testDataDir);

            expect(createCallCount).toBe(3);
        });

        it('should insert each tag with type = SYSTEM', async () => {
            writeSystemTagFiles([
                { name: 'Favorito', description: 'Desc', color: 'YELLOW', lifecycleState: 'ACTIVE' }
            ]);
            const model = buildStubModel();

            await seedSystemTags(model, testDataDir);

            expect(lastCreateArg?.type).toBe(TagTypeEnum.SYSTEM);
        });

        it('should insert each tag with ownerId = null', async () => {
            writeSystemTagFiles([
                {
                    name: 'Importante',
                    description: 'Desc',
                    color: 'ORANGE',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedSystemTags(model, testDataDir);

            expect(lastCreateArg?.ownerId).toBeNull();
        });

        it('should insert each tag with createdById = SYSTEM_USER_ID', async () => {
            writeSystemTagFiles([
                {
                    name: 'Completado',
                    description: 'Desc',
                    color: 'GREEN',
                    lifecycleState: 'ACTIVE'
                }
            ]);
            const model = buildStubModel();

            await seedSystemTags(model, testDataDir);

            expect(lastCreateArg?.createdById).toBe(SYSTEM_USER_ID);
        });

        it('should NOT include a slug field in the inserted row', async () => {
            writeSystemTagFiles([
                { name: 'Borrador', description: 'Desc', color: 'GREY', lifecycleState: 'ACTIVE' }
            ]);
            const model = buildStubModel();

            await seedSystemTags(model, testDataDir);

            expect('slug' in (lastCreateArg ?? {})).toBe(false);
        });

        it('should set lifecycleState from the JSON fixture', async () => {
            writeSystemTagFiles([
                { name: 'Publicado', description: 'Desc', color: 'GREEN', lifecycleState: 'ACTIVE' }
            ]);
            const model = buildStubModel();

            await seedSystemTags(model, testDataDir);

            expect(lastCreateArg?.lifecycleState).toBe('ACTIVE');
        });
    });

    describe('idempotency — when SYSTEM tags already exist', () => {
        it('should NOT call create for tags that are already in the DB', async () => {
            writeSystemTagFiles([
                { name: 'Favorito', description: 'Desc', color: 'YELLOW', lifecycleState: 'ACTIVE' }
            ]);
            alwaysFound = true;
            findOneReturnValue = { id: 'existing-uuid', name: 'Favorito', type: 'SYSTEM' };
            const model = buildStubModel();

            await seedSystemTags(model, testDataDir);

            expect(createCallCount).toBe(0);
        });

        it('should resolve without error when all tags already exist', async () => {
            writeSystemTagFiles([
                { name: 'Favorito', description: 'Desc', color: 'YELLOW', lifecycleState: 'ACTIVE' }
            ]);
            alwaysFound = true;
            findOneReturnValue = { id: 'existing-uuid', name: 'Favorito', type: 'SYSTEM' };
            const model = buildStubModel();

            await expect(seedSystemTags(model, testDataDir)).resolves.toBeUndefined();
        });

        it('should skip existing tags but create new ones (partial idempotency)', async () => {
            writeSystemTagFiles([
                { name: 'Ya existe', description: 'Desc', color: 'RED', lifecycleState: 'ACTIVE' },
                { name: 'No existe', description: 'Desc', color: 'BLUE', lifecycleState: 'ACTIVE' }
            ]);
            store.push({ id: 'pre-existing', name: 'Ya existe', type: 'SYSTEM' });
            const model = buildStubModel();

            await seedSystemTags(model, testDataDir);

            expect(createCallCount).toBe(1);
            expect(lastCreateArg?.name).toBe('No existe');
        });

        it('should be safe to run twice (second run creates 0 rows)', async () => {
            writeSystemTagFiles([
                { name: 'Tag Uno', description: 'Desc', color: 'RED', lifecycleState: 'ACTIVE' },
                { name: 'Tag Dos', description: 'Desc', color: 'BLUE', lifecycleState: 'ACTIVE' }
            ]);
            const model = buildStubModel();

            await seedSystemTags(model, testDataDir);
            expect(createCallCount).toBe(2);

            const countBefore = createCallCount;
            await seedSystemTags(model, testDataDir);
            expect(createCallCount).toBe(countBefore);
        });
    });

    describe('counts matching the canonical tag-seeds.md list', () => {
        it('should create exactly 30 rows when seeding the real data directory', async () => {
            const realDataDir = resolve(import.meta.dirname, '../../src/data/tag');

            const model = buildStubModel();
            await seedSystemTags(model, realDataDir);

            expect(createCallCount).toBe(30);
        });
    });

    describe('error handling', () => {
        it('should propagate errors thrown by the DB create call', async () => {
            writeSystemTagFiles([
                { name: 'Tag Error', description: 'Desc', color: 'RED', lifecycleState: 'ACTIVE' }
            ]);
            createShouldThrow = new Error('DB connection lost');
            const model = buildStubModel();

            await expect(seedSystemTags(model, testDataDir)).rejects.toThrow('DB connection lost');
        });
    });
});
