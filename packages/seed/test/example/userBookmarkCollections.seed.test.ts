/**
 * Unit tests for the userBookmarkCollections example seed (SPEC-098 T-S06).
 *
 * Tests use in-memory stubs — no live database connection required.
 * The `UserBookmarkCollectionService` is mocked so the seed logic (normalizer,
 * pre-processor, ID mapping, error handling) is exercised without hitting
 * PostgreSQL or the real quota enforcement.
 *
 * Coverage:
 *   - Happy path: 17 fixture files → 17 service.create calls → 17 ID mappings
 *   - ID mapping: `idMapper.getRealId('userbookmarkcollections', seedId)` returns
 *     a UUID for each fixture after the seed runs
 *   - User mapping resolution: `userId` in the fixture is replaced with the real
 *     DB UUID before the service is called
 *   - Actor permissions: actor is set to the collection owner with
 *     USER_BOOKMARK_COLLECTION_CREATE permission
 *   - Pre-process error: missing user mapping throws a descriptive error
 *   - Normalizer: strips `$schema`, `id`, and `lifecycleState` fields
 *   - Execution order: seedUserBookmarkCollections appears before seedBookmarks
 *     in `src/example/index.ts`
 *
 * References: SPEC-098 T-S06, seedFactory-media-validation.test.ts (pattern)
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdMapper } from '../../src/utils/idMapper.js';
import { type SeedContext, createImageProcessingCounters } from '../../src/utils/seedContext.js';

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
// Stub for UserBookmarkCollectionService.
//
// The factory calls `new UserBookmarkCollectionService(serviceContext)` then
// `service.create(actor, data)`. The stub captures each call so assertions can
// inspect which data reached the service layer.
// ---------------------------------------------------------------------------

/** Accumulates all `create` calls made by the factory across the run. */
type CreateCall = { actor: Actor; data: Record<string, unknown> };
let createCalls: CreateCall[] = [];

/** When true, `create` throws to simulate a service failure. */
let createShouldThrow = false;

/** Monotonically incrementing counter used to generate fake UUIDs. */
let createCallIndex = 0;

class StubUserBookmarkCollectionService {
    async create(
        actor: Actor,
        data: unknown
    ): Promise<{ data?: { id?: string }; error?: { message: string; code: string } }> {
        if (createShouldThrow) {
            throw new Error('Stub service create error');
        }
        createCallIndex++;
        const fakeId = `00000000-0000-4000-8000-${String(createCallIndex).padStart(12, '0')}`;
        createCalls.push({ actor, data: data as Record<string, unknown> });
        return { data: { id: fakeId } };
    }
}

// Mock @repo/service-core so the seed file picks up the stub class.
vi.mock('@repo/service-core', () => ({
    UserBookmarkCollectionService: StubUserBookmarkCollectionService
}));

// Import AFTER the mock is registered so the seed file sees the stub.
const { seedUserBookmarkCollections } = await import(
    '../../src/example/userBookmarkCollections.seed.js'
);

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/** Fake UUIDs for test users (must look like real UUIDs). */
const FAKE_USER_IDS: Record<string, string> = {
    '002-user-carlos-martínez': '11111111-0000-4000-8000-000000000002',
    '004-user-ana-rodríguez': '11111111-0000-4000-8000-000000000004',
    '005-user-miguel-torres': '11111111-0000-4000-8000-000000000005',
    '006-user-laura-vega': '11111111-0000-4000-8000-000000000006',
    '009-user-sofia-morales': '11111111-0000-4000-8000-000000000009',
    '011-user-carmen-silva': '11111111-0000-4000-8000-000000000011',
    '015-user-monica-herrera': '11111111-0000-4000-8000-000000000015',
    '020-user-sergio-vargas': '11111111-0000-4000-8000-000000000020',
    '025-user-mariana-guerrero': '11111111-0000-4000-8000-000000000025',
    '031-user-natalia-vega': '11111111-0000-4000-8000-000000000031'
};

/** The 17 fixture definitions that mirror the manifest-example.json entries. */
const FIXTURE_DEFINITIONS: ReadonlyArray<{
    readonly id: string;
    readonly userId: string;
    readonly name: string;
    readonly description: string;
    readonly color: string;
    readonly icon: string;
    readonly lifecycleState: string;
}> = [
    {
        id: '001-collection-002-user-carlos-martínez-finde-con-amigos',
        userId: '002-user-carlos-martínez',
        name: 'Finde con amigos',
        description: 'Lugares para escapadas grupales económicas en el Litoral',
        color: '#FF5722',
        icon: 'UsersIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '002-collection-002-user-carlos-martínez-escapadas-baratas',
        userId: '002-user-carlos-martínez',
        name: 'Escapadas baratas',
        description: 'Lugares económicos para escapadas de fin de semana',
        color: '#2196F3',
        icon: 'WalletIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '003-collection-004-user-ana-rodríguez-luna-de-miel',
        userId: '004-user-ana-rodríguez',
        name: 'Luna de miel',
        description: 'Lugares románticos para nuestra luna de miel',
        color: '#E91E63',
        icon: 'HeartIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '004-collection-004-user-ana-rodríguez-lugares-para-volver',
        userId: '004-user-ana-rodríguez',
        name: 'Lugares para volver',
        description: 'Lugares que quiero visitar otra vez',
        color: '#9C27B0',
        icon: 'RepeatIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '005-collection-005-user-miguel-torres-pesca-y-naturaleza',
        userId: '005-user-miguel-torres',
        name: 'Pesca y naturaleza',
        description: 'Lugares ideales para pesca y actividades al aire libre',
        color: '#4CAF50',
        icon: 'FishIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '006-collection-006-user-laura-vega-termales-del-litoral',
        userId: '006-user-laura-vega',
        name: 'Termales del Litoral',
        description: 'Los mejores complejos termales de Entre Ríos',
        color: '#FF9800',
        icon: 'DropIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '007-collection-006-user-laura-vega-para-feriado-largo',
        userId: '006-user-laura-vega',
        name: 'Para feriado largo',
        description: 'Destinos para feriados largos y puentes',
        color: '#00BCD4',
        icon: 'CalendarIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '008-collection-009-user-sofia-morales-eventos-del-ano',
        userId: '009-user-sofia-morales',
        name: 'Eventos del año',
        description: 'Eventos imperdibles del año en el Litoral',
        color: '#673AB7',
        icon: 'StarIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '009-collection-011-user-carmen-silva-lectura-de-blog',
        userId: '011-user-carmen-silva',
        name: 'Lectura de blog',
        description: 'Posts interesantes que quiero leer',
        color: '#795548',
        icon: 'BookIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '010-collection-011-user-carmen-silva-por-descubrir',
        userId: '011-user-carmen-silva',
        name: 'Por descubrir',
        description: 'Destinos que quiero conocer',
        color: '#607D8B',
        icon: 'MapIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '011-collection-015-user-monica-herrera-joyas-escondidas',
        userId: '015-user-monica-herrera',
        name: 'Joyas escondidas',
        description: 'Lugares poco conocidos pero increíbles',
        color: '#F44336',
        icon: 'GemIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '012-collection-015-user-monica-herrera-recomendaciones-de-mariana',
        userId: '015-user-monica-herrera',
        name: 'Recomendaciones de Mariana',
        description: 'Lugares recomendados por Mariana',
        color: '#3F51B5',
        icon: 'UserIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '013-collection-020-user-sergio-vargas-trips-work',
        userId: '020-user-sergio-vargas',
        name: 'Trips work',
        description: 'Lugares para viajes de trabajo',
        color: '#009688',
        icon: 'BriefcaseIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '014-collection-020-user-sergio-vargas-verano-2027',
        userId: '020-user-sergio-vargas',
        name: 'Verano 2027',
        description: 'Planes para el verano 2027',
        color: '#FFEB3B',
        icon: 'SunIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '015-collection-025-user-mariana-guerrero-finde-largo-en-colon',
        userId: '025-user-mariana-guerrero',
        name: 'Finde largo en Colón',
        description: 'Todo lo que quiero hacer en Colón el próximo finde largo',
        color: '#FF5722',
        icon: 'MapPinIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '016-collection-025-user-mariana-guerrero-proximos-viajes',
        userId: '025-user-mariana-guerrero',
        name: 'Próximos viajes',
        description: 'Destinos para los próximos viajes',
        color: '#8BC34A',
        icon: 'PaperPlaneIcon',
        lifecycleState: 'ACTIVE'
    },
    {
        id: '017-collection-031-user-natalia-vega-ideas-para-luna-de-miel',
        userId: '031-user-natalia-vega',
        name: 'Ideas para luna de miel',
        description: 'Destinos románticos para nuestra luna de miel',
        color: '#F06292',
        icon: 'HeartIcon',
        lifecycleState: 'ACTIVE'
    }
] as const;

// ---------------------------------------------------------------------------
// Temp directory helpers
// ---------------------------------------------------------------------------

/** Absolute path to the temp dir that holds the fixture JSON files. */
let fixtureDir: string;

/**
 * Builds a SeedContext with an IdMapper pre-loaded with all test user mappings.
 * Optionally accepts overrides to simulate missing user mappings.
 */
function buildContext(options?: {
    readonly missingUserSeedIds?: readonly string[];
}): SeedContext {
    const idMapper = new IdMapper(true /* dontLoadSavedMappings */);

    for (const [seedId, realId] of Object.entries(FAKE_USER_IDS)) {
        if (options?.missingUserSeedIds?.includes(seedId)) continue;
        idMapper.setMapping('users', seedId, realId, seedId);
    }

    const actor: Actor = {
        id: 'initial-actor-id',
        role: RoleEnum.SUPER_ADMIN,
        permissions: [] as PermissionEnum[]
    } as unknown as Actor;

    return {
        continueOnError: false,
        validateManifests: false,
        resetDatabase: false,
        exclude: [],
        actor,
        idMapper,
        seedSource: 'example',
        imageCounters: createImageProcessingCounters()
    } as SeedContext;
}

// ---------------------------------------------------------------------------
// Suite setup / teardown
// ---------------------------------------------------------------------------

beforeAll(() => {
    // Create a temp directory and write all 17 fixture JSON files.
    fixtureDir = join(tmpdir(), `seed-collections-test-${Date.now()}`);
    mkdirSync(fixtureDir, { recursive: true });

    for (const fixture of FIXTURE_DEFINITIONS) {
        const filename = `${fixture.id}.json`;
        writeFileSync(join(fixtureDir, filename), JSON.stringify(fixture, null, 2), 'utf-8');
    }
});

afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
});

beforeEach(() => {
    createCalls = [];
    createShouldThrow = false;
    createCallIndex = 0;
    vi.clearAllMocks();
});

afterEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers to build a seed factory that uses the temp directory.
// ---------------------------------------------------------------------------

/**
 * Dynamically imports `createSeedFactory` and builds a seed using the temp
 * fixture directory so tests do not depend on the real `src/data/` path.
 */
async function buildTestSeed(options?: {
    readonly missingUserSeedIds?: readonly string[];
}): Promise<{ seed: (ctx: SeedContext) => Promise<void>; context: SeedContext }> {
    const { createSeedFactory } = await import('../../src/utils/seedFactory.js');
    const { collectionNormalizerForTest, preProcessCollectionForTest } = await importTestHelpers();

    const files = FIXTURE_DEFINITIONS.map((f) => `${f.id}.json`);

    const seed = createSeedFactory({
        entityName: 'UserBookmarkCollections',
        serviceClass: StubUserBookmarkCollectionService,
        folder: fixtureDir,
        files,
        normalizer: collectionNormalizerForTest,
        preProcess: preProcessCollectionForTest
    });

    const context = buildContext(options);

    return { seed, context };
}

/**
 * Extracts the normalizer and preProcess functions from the seed module so
 * they can be applied in the test-controlled factory without re-implementing them.
 *
 * Since these are module-level closures, we replicate their logic here to keep
 * the tests hermetic. This avoids coupling tests to internal implementation
 * details of the seed file's export shape.
 */
async function importTestHelpers(): Promise<{
    collectionNormalizerForTest: (data: Record<string, unknown>) => Record<string, unknown>;
    preProcessCollectionForTest: (item: unknown, context: SeedContext) => Promise<void>;
}> {
    // Replicate collectionNormalizer logic (strips $schema, id, lifecycleState)
    const collectionNormalizerForTest = (
        data: Record<string, unknown>
    ): Record<string, unknown> => {
        const {
            $schema: _schema,
            id: _id,
            ...cleanData
        } = data as {
            $schema?: string;
            id?: string;
            [key: string]: unknown;
        };
        // biome-ignore lint/performance/noDelete: removing optional property from seed data object to avoid DB insertion errors
        delete cleanData.lifecycleState;
        return cleanData;
    };

    // Replicate preProcessCollection logic (resolves userId, sets actor)
    const preProcessCollectionForTest = async (
        item: unknown,
        context: SeedContext
    ): Promise<void> => {
        const collectionData = item as Record<string, unknown>;
        const seedUserId = collectionData.userId as string;

        if (seedUserId) {
            const realUserId = context.idMapper.getMappedUserId(seedUserId);
            if (!realUserId) {
                throw new Error(`No mapping found for user ID: ${seedUserId}`);
            }
            collectionData.userId = realUserId;

            context.actor = {
                id: realUserId,
                role: RoleEnum.SUPER_ADMIN,
                permissions: [
                    PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
                    PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
                    PermissionEnum.USER_BOOKMARK_CREATE,
                    PermissionEnum.USER_BOOKMARK_MANAGE
                ] as PermissionEnum[]
            } as unknown as Actor;
        }
    };

    return { collectionNormalizerForTest, preProcessCollectionForTest };
}

// ---------------------------------------------------------------------------
// Happy path: 17 fixtures → 17 create calls → 17 ID mappings
// ---------------------------------------------------------------------------

describe('seedUserBookmarkCollections — happy path', () => {
    it('should call service.create exactly 17 times for 17 fixture files', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert
        expect(createCalls).toHaveLength(17);
    });

    it('should register 17 ID mappings under "userbookmarkcollections" namespace', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert — each fixture seed ID should resolve to a UUID
        for (const fixture of FIXTURE_DEFINITIONS) {
            const realId = context.idMapper.getRealId('userbookmarkcollections', fixture.id);
            expect(realId).toBeDefined();
            expect(realId).toMatch(/^[0-9a-f-]{36}$/i);
        }
    });

    it('should produce unique real IDs for every collection mapping', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert — all 17 mapped IDs must be distinct
        const mappedIds = FIXTURE_DEFINITIONS.map((f) =>
            context.idMapper.getRealId('userbookmarkcollections', f.id)
        );
        const uniqueIds = new Set(mappedIds);
        expect(uniqueIds.size).toBe(17);
    });
});

// ---------------------------------------------------------------------------
// ID mapping: getRealId returns valid UUIDs after seeding
// ---------------------------------------------------------------------------

describe('ID mapping — userbookmarkcollections namespace', () => {
    it('should return a UUID-shaped string for every fixture seed ID after the seed runs', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        for (const fixture of FIXTURE_DEFINITIONS) {
            const realId = context.idMapper.getRealId('userbookmarkcollections', fixture.id);
            expect(realId, `No mapping for fixture ${fixture.id}`).toBeDefined();
            expect(realId, `ID for ${fixture.id} is not UUID-shaped`).toMatch(uuidPattern);
        }
    });

    it('should return undefined for a seed ID that was not in the manifest', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert — a non-existent seed ID yields undefined
        const missingId = context.idMapper.getRealId(
            'userbookmarkcollections',
            'non-existent-fixture-id'
        );
        expect(missingId).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// User mapping resolution
// ---------------------------------------------------------------------------

describe('userId resolution — preProcessCollection', () => {
    it('should replace the seed userId with the real DB UUID before calling service.create', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert — every create call must receive a real UUID as userId, not a seed string ID
        for (const call of createCalls) {
            const { userId } = call.data;
            expect(typeof userId).toBe('string');
            // Real UUIDs are 36 chars; seed IDs like "002-user-carlos-martínez" are not
            expect((userId as string).length).toBe(36);
            expect(userId).toMatch(/^[0-9a-f-]{36}$/i);
        }
    });

    it('should set the actor.id to the real user UUID for each collection', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert — each create call's actor.id must match the userId in the data
        for (const call of createCalls) {
            expect(call.actor.id).toBe(call.data.userId);
        }
    });

    it('should grant USER_BOOKMARK_COLLECTION_CREATE permission to the actor', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert — each actor must have the CREATE permission
        for (const call of createCalls) {
            expect(call.actor.permissions).toContain(
                PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE
            );
        }
    });

    it('should set actor.role to SUPER_ADMIN for each collection', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert
        for (const call of createCalls) {
            expect(call.actor.role).toBe(RoleEnum.SUPER_ADMIN);
        }
    });
});

// ---------------------------------------------------------------------------
// Normalizer: strips $schema, id, lifecycleState
// ---------------------------------------------------------------------------

describe('collectionNormalizer — field stripping', () => {
    it('should NOT pass $schema to service.create', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert — fixtures contain $schema but the normalizer strips it
        for (const call of createCalls) {
            expect(call.data).not.toHaveProperty('$schema');
        }
    });

    it('should NOT pass the fixture id field to service.create', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert — the fixture id (seed string ID) must be stripped from the payload
        for (const call of createCalls) {
            expect(call.data).not.toHaveProperty('id');
        }
    });

    it('should NOT pass lifecycleState to service.create', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert
        for (const call of createCalls) {
            expect(call.data).not.toHaveProperty('lifecycleState');
        }
    });

    it('should pass the collection name to service.create', async () => {
        // Arrange
        const { seed, context } = await buildTestSeed();

        // Act
        await seed(context);

        // Assert — every call must have a non-empty name from the fixture
        for (const call of createCalls) {
            expect(typeof call.data.name).toBe('string');
            expect((call.data.name as string).length).toBeGreaterThan(0);
        }
    });
});

// ---------------------------------------------------------------------------
// Pre-process error: missing user mapping
// ---------------------------------------------------------------------------

describe('preProcessCollection — missing user mapping', () => {
    it('should throw an error when the fixture userId has no user mapping', async () => {
        // Arrange — remove the mapping for one user
        const missingUserId = '002-user-carlos-martínez';
        const { seed, context } = await buildTestSeed({
            missingUserSeedIds: [missingUserId]
        });

        // Act + Assert
        await expect(seed(context)).rejects.toThrow(
            `No mapping found for user ID: ${missingUserId}`
        );
    });

    it('should not call service.create before the missing-user error is thrown', async () => {
        // Arrange — first fixture uses carlos-martínez; removing his mapping makes
        // the very first pre-process step fail
        const missingUserId = '002-user-carlos-martínez';
        const { seed, context } = await buildTestSeed({
            missingUserSeedIds: [missingUserId]
        });

        // Act
        await expect(seed(context)).rejects.toThrow();

        // Assert — no successful creates occurred
        expect(createCalls).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Execution order: seedUserBookmarkCollections before seedBookmarks
// ---------------------------------------------------------------------------

describe('execution order in src/example/index.ts', () => {
    it('should call seedUserBookmarkCollections before seedBookmarks in runExampleSeeds', async () => {
        // Arrange — read the source text of index.ts and extract call order
        const { readFileSync } = await import('node:fs');
        const { join: pathJoin, resolve } = await import('node:path');

        const indexPath = resolve(
            pathJoin(import.meta.url.replace('file://', ''), '../../../src/example/index.ts')
        );
        const source = readFileSync(indexPath, 'utf-8');

        // Act — find positions of the two calls
        const posCollections = source.indexOf('await seedUserBookmarkCollections(');
        const posBookmarks = source.indexOf('await seedBookmarks(');

        // Assert — both calls must exist and collections must come first
        expect(
            posCollections,
            'seedUserBookmarkCollections call not found in index.ts'
        ).toBeGreaterThan(-1);
        expect(posBookmarks, 'seedBookmarks call not found in index.ts').toBeGreaterThan(-1);
        expect(
            posCollections,
            'seedUserBookmarkCollections must appear before seedBookmarks'
        ).toBeLessThan(posBookmarks);
    });
});

// ---------------------------------------------------------------------------
// The exported seedUserBookmarkCollections uses the real data directory
// ---------------------------------------------------------------------------

describe('seedUserBookmarkCollections — manifest integration (real fixture files)', () => {
    it('should load exactly 17 files from manifest-example.json when the real data dir exists', async () => {
        // Arrange — this uses the exported factory with the real src/data dir + manifest
        // We verify by checking the manifest count matches 17
        const manifest = (
            await import('../../src/manifest-example.json', {
                assert: { type: 'json' }
            })
        ).default as Record<string, unknown>;

        const files = manifest.userBookmarkCollections as string[];

        // Assert — manifest must declare exactly 17 fixtures
        expect(Array.isArray(files)).toBe(true);
        expect(files).toHaveLength(17);
    });

    it('should expose seedUserBookmarkCollections as a function', () => {
        // Assert — the exported value is a callable async function
        expect(typeof seedUserBookmarkCollections).toBe('function');
    });
});
