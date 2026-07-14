/**
 * @fileoverview
 * Unit tests for `seedPointOfInterestCatalogRelations` (HOS-142 fresh-DB
 * destination relation wiring), using INJECTED model stubs (via the
 * function's optional `deps` parameter) rather than `vi.mock('@repo/db')`.
 *
 * `vi.mock('@repo/db', ...)` does not reliably intercept classes imported by
 * a `src/` module under this repo's `vite-tsconfig-paths` + `pool: 'forks'`
 * vitest config — verified by reproducing the identical "Database not
 * initialized" failure against the already-merged sibling
 * `pointOfInterestCatalogCategories.ts` when driven the same way. Dependency
 * injection (see `pointOfInterestCatalogRelations.ts`'s own "Testability"
 * JSDoc note) sidesteps that limitation without touching the vitest config
 * or the sibling file.
 *
 * The relation data itself is loaded FOR REAL via `loadDestinationRelations`
 * (the SAME loader `0013-hos-142-poi-catalog-expansion.ts` uses), so this
 * test's expected counts (914 PRIMARY + 646 NEARBY = 1560 total entries;
 * 1556 new creates once the 13 pre-existing HOS-113 pairs are accounted
 * for) verify AC-2's claim that the fresh seed-time path and the live-env
 * dual-write migration converge on identical relation counts.
 *
 * @module test/pointOfInterestCatalog/pointOfInterestCatalogRelations
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    type PointOfInterestCatalogRelationsDeps,
    seedPointOfInterestCatalogRelations
} from '../../src/pointOfInterestCatalog/pointOfInterestCatalogRelations.js';
import {
    loadDestinationRelations,
    type RawDestinationRelation
} from '../../src/utils/loadDestinationRelations.js';

vi.mock('../../src/utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        success: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

import { logger } from '../../src/utils/logger.js';

const mockLoggerInfo = logger.info as ReturnType<typeof vi.fn>;

interface PoiRow {
    id: string;
    slug: string;
}

interface DestinationRow {
    id: string;
    slug: string;
}

interface RelationRow {
    destinationId: string;
    pointOfInterestId: string;
    relation: string;
}

/**
 * The 13 destination-POI pairs `destinations.seed.ts`'s
 * `pointOfInterestRelationBuilder` already creates on a fresh DB, for the
 * ORIGINAL 12 HOS-113 POIs (implicit `relation: PRIMARY`, pre-HOS-140) —
 * i.e. the state this step's idempotency check encounters BEFORE it runs.
 * Same 13 pairs `0013-hos-142-poi-catalog-expansion.ts`'s test uses.
 */
const PRE_EXISTING_PRIMARY_PAIRS: ReadonlyArray<{ destinationSlug: string; poiSlug: string }> = [
    { destinationSlug: 'colon', poiSlug: 'balneario_itape' },
    { destinationSlug: 'colon', poiSlug: 'parque_nacional_el_palmar' },
    { destinationSlug: 'concordia', poiSlug: 'complejo_termal_concordia' },
    { destinationSlug: 'federacion', poiSlug: 'termas_de_federacion' },
    { destinationSlug: 'liebig', poiSlug: 'playa_banco_pelay' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'autodromo_concepcion_del_uruguay' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'playa_banco_pelay' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'basilica_inmaculada_concepcion' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'parque_unzue' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'isla_del_puerto' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'plaza_francisco_ramirez' },
    { destinationSlug: 'concepcion-del-uruguay', poiSlug: 'mirador_costanera' },
    { destinationSlug: 'caseros', poiSlug: 'palacio_san_jose' }
];

/** Total destination-POI relation entries in the real pipeline output (914 PRIMARY + 646 NEARBY). */
const EXPECTED_TOTAL_RELATION_ENTRIES = 1560;

/** Of the 13 pre-existing pairs, 3 agree with the pipeline's `relation` value (pure no-op skip). */
const EXPECTED_PRE_EXISTING_MATCHING_PAIRS = 3;

/**
 * The other 1 pre-existing pair disagrees (`colon`/`parque_nacional_el_palmar`,
 * existing `PRIMARY` vs. the pipeline's `NEARBY` — `ubajay` is now PRIMARY).
 */
const EXPECTED_PRE_EXISTING_CONFLICTING_PAIRS = 1;

const EXPECTED_NEW_RELATIONS =
    EXPECTED_TOTAL_RELATION_ENTRIES -
    EXPECTED_PRE_EXISTING_MATCHING_PAIRS -
    EXPECTED_PRE_EXISTING_CONFLICTING_PAIRS;

function buildDestinationModelStub(store: Map<string, DestinationRow>) {
    return {
        async findOne(where: { slug: string }) {
            return store.get(where.slug) ?? null;
        }
    };
}

function buildPoiModelStub(store: Map<string, PoiRow>) {
    return {
        async findOne(where: { slug: string }) {
            return store.get(where.slug) ?? null;
        }
    };
}

function buildRelationModelStub(store: Map<string, RelationRow>) {
    return {
        async findOne(where: { destinationId: string; pointOfInterestId: string }) {
            return store.get(`${where.destinationId}:${where.pointOfInterestId}`) ?? null;
        },
        async create(data: RelationRow) {
            store.set(`${data.destinationId}:${data.pointOfInterestId}`, data);
            return data;
        }
    };
}

/**
 * Seeds the destination + POI stores with every slug the REAL pipeline data
 * references — simulating the fresh-DB state right after `--required` (the
 * 12 original POIs + 22 destinations) and `seedPointOfInterestCatalog` (the
 * 908 catalog POIs) have already run, but BEFORE this relations step runs.
 */
function seedDestinationAndPoiStores(
    relations: readonly RawDestinationRelation[],
    destinationStore: Map<string, DestinationRow>,
    poiStore: Map<string, PoiRow>
): void {
    for (const slug of new Set(relations.map((r) => r.destinationSlug))) {
        destinationStore.set(slug, { id: `dest-${slug}`, slug });
    }
    for (const slug of new Set(relations.map((r) => r.poiSlug))) {
        poiStore.set(slug, { id: `poi-${slug}`, slug });
    }
}

/** Seeds the relation store with the 13 pairs `destinations.seed.ts` already created. */
function seedPreExistingRelations(relationStore: Map<string, RelationRow>): void {
    for (const { destinationSlug, poiSlug } of PRE_EXISTING_PRIMARY_PAIRS) {
        const destinationId = `dest-${destinationSlug}`;
        const pointOfInterestId = `poi-${poiSlug}`;
        relationStore.set(`${destinationId}:${pointOfInterestId}`, {
            destinationId,
            pointOfInterestId,
            relation: 'PRIMARY'
        });
    }
}

/** Extracts the final summary line logged via `logger.info`. */
function findSummaryLogLine(): string | undefined {
    return mockLoggerInfo.mock.calls
        .map(([msg]) => msg as string)
        .find((msg) => msg.startsWith('POI catalog destination relations:'));
}

describe('seedPointOfInterestCatalogRelations (HOS-142 fresh-DB relations step)', () => {
    let realRelations: RawDestinationRelation[];
    let destinationStore: Map<string, DestinationRow>;
    let poiStore: Map<string, PoiRow>;
    let relationStore: Map<string, RelationRow>;
    let deps: PointOfInterestCatalogRelationsDeps;

    beforeAll(async () => {
        realRelations = await loadDestinationRelations();
    });

    beforeEach(() => {
        mockLoggerInfo.mockClear();
        destinationStore = new Map();
        poiStore = new Map();
        relationStore = new Map();
        seedDestinationAndPoiStores(realRelations, destinationStore, poiStore);
        seedPreExistingRelations(relationStore);
        deps = {
            destinationModel: buildDestinationModelStub(destinationStore),
            poiModel: buildPoiModelStub(poiStore),
            relationModel: buildRelationModelStub(relationStore)
        };
    });

    it('sanity: the real pipeline data has the expected shape at authoring time', () => {
        expect(realRelations).toHaveLength(EXPECTED_TOTAL_RELATION_ENTRIES);
        expect(realRelations.filter((r) => r.relation === 'PRIMARY')).toHaveLength(914);
        expect(realRelations.filter((r) => r.relation === 'NEARBY')).toHaveLength(646);
    });

    it('creates every new relation and converges on the SAME counts 0013 produces for the live-env path (AC-2)', async () => {
        // Arrange
        const sizeBefore = relationStore.size;
        expect(sizeBefore).toBe(PRE_EXISTING_PRIMARY_PAIRS.length);

        // Act
        await seedPointOfInterestCatalogRelations(deps);

        // Assert — exactly the new relations were added; nothing else.
        expect(relationStore.size).toBe(sizeBefore + EXPECTED_NEW_RELATIONS);

        // Assert — the logged summary reports the exact same breakdown 0013's
        // test asserts for the live-env dual-write path.
        expect(findSummaryLogLine()).toBe(
            `POI catalog destination relations: ${EXPECTED_NEW_RELATIONS} created, ` +
                `${EXPECTED_PRE_EXISTING_MATCHING_PAIRS} already existed, ` +
                `${EXPECTED_PRE_EXISTING_CONFLICTING_PAIRS} conflicting, ` +
                '0 destinations not found, 0 POIs not found'
        );
    });

    it('is idempotent: a second run creates nothing new', async () => {
        // Arrange — run once to populate the store.
        await seedPointOfInterestCatalogRelations(deps);
        const sizeAfterFirstRun = relationStore.size;
        mockLoggerInfo.mockClear();

        // Act — run again against the SAME store.
        await seedPointOfInterestCatalogRelations(deps);

        // Assert — no new rows, and the summary reports 0 created.
        expect(relationStore.size).toBe(sizeAfterFirstRun);
        expect(findSummaryLogLine()).toBe(
            `POI catalog destination relations: 0 created, ` +
                `${EXPECTED_PRE_EXISTING_MATCHING_PAIRS + EXPECTED_NEW_RELATIONS} already existed, ` +
                `${EXPECTED_PRE_EXISTING_CONFLICTING_PAIRS} conflicting, ` +
                '0 destinations not found, 0 POIs not found'
        );
    });

    it('never overwrites the pre-existing conflicting row (colon/parque_nacional_el_palmar stays PRIMARY)', async () => {
        // Arrange
        const key = 'dest-colon:poi-parque_nacional_el_palmar';
        expect(relationStore.get(key)?.relation).toBe('PRIMARY');

        // Act
        await seedPointOfInterestCatalogRelations(deps);

        // Assert — untouched, even though the pipeline says this pair should be NEARBY.
        expect(relationStore.get(key)?.relation).toBe('PRIMARY');
        // And the NEW, correct PRIMARY row was created for ubajay instead.
        expect(relationStore.get('dest-ubajay:poi-parque_nacional_el_palmar')).toEqual({
            destinationId: 'dest-ubajay',
            pointOfInterestId: 'poi-parque_nacional_el_palmar',
            relation: 'PRIMARY'
        });
    });

    it('creates two independent rows for the same catalog POI when it is PRIMARY for one destination and NEARBY for another (actividades_nauticas)', async () => {
        // Act
        await seedPointOfInterestCatalogRelations(deps);

        // Assert
        const poiId = 'poi-actividades_nauticas';
        expect(relationStore.get(`dest-santa-ana:${poiId}`)?.relation).toBe('PRIMARY');
        expect(relationStore.get(`dest-chajari:${poiId}`)?.relation).toBe('NEARBY');
        expect(relationStore.get(`dest-federacion:${poiId}`)?.relation).toBe('NEARBY');
    });

    it('counts a destination as not-found (and skips its relations) when its slug is missing from the DB', async () => {
        // Arrange
        destinationStore.delete('santa-ana');

        // Act
        await seedPointOfInterestCatalogRelations(deps);

        // Assert
        const summary = findSummaryLogLine();
        expect(summary).toMatch(/[1-9]\d* destinations not found/);
    });

    it('counts a POI as not-found (and skips its relations) when its slug is missing from the DB', async () => {
        // Arrange
        poiStore.delete('actividades_nauticas');

        // Act
        await seedPointOfInterestCatalogRelations(deps);

        // Assert
        expect(findSummaryLogLine()).toMatch(/[1-9]\d* POIs not found/);
    });
});
