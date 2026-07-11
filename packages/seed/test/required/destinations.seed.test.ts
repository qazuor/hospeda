/**
 * Determinism + hierarchy-computation tests for the `required` destinations
 * seed factory wired with deterministic ids (HOS-25 T-025).
 *
 * These tests stay at the "factory/config level" (per the same convention as
 * `test/example/determinism.test.ts` from HOS-25 T-016): they drive the real,
 * exported `preProcessDestination` function against the REAL fixture files,
 * in the REAL `manifest-required.json` order, without running the full seed
 * pipeline against a database. This exercises the actual hierarchy-resolution
 * logic (not a re-implementation of it in the test), including its reuse of
 * `computeHierarchyLevel`/`computeHierarchyPath`/`computeHierarchyPathIds`/
 * `isValidParentChildRelation` from `@repo/service-core`.
 *
 * A full reseed-stability integration test (actually running the seed twice
 * against a real/ephemeral database and comparing persisted rows) belongs to
 * HOS-25 T-022, which this test file explicitly does not attempt to
 * duplicate.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DestinationFaqModel, DestinationModel } from '@repo/db';
import type { DestinationType } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import {
    getDestinationFaqFixtureId,
    getDestinationFixtureId,
    preProcessDestination
} from '../../src/required/destinations.seed.js';
import { deterministicFixtureId } from '../../src/utils/deterministicFixtureId.js';
import type { SeedContext } from '../../src/utils/seedContext.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_SRC_DIR = join(__dirname, '../../src');

/** Minimal shape of a destination fixture, for the fields these tests need. */
interface DestinationFixture {
    id: string;
    slug: string;
    destinationType: DestinationType;
    parentDestinationId?: string;
    faqs?: Array<{ question: string; answer: string; category?: string }>;
}

/** Loads and parses a JSON fixture file relative to `src/data/<entity>`. */
function loadFixture<T>(relativePath: string, folder: string): T {
    const fullPath = join(SEED_SRC_DIR, 'data', folder, relativePath);
    return JSON.parse(readFileSync(fullPath, 'utf-8')) as T;
}

/** Reads the real `manifest-required.json` file list for `destinations`. */
function readDestinationManifestFiles(): string[] {
    const manifestPath = join(SEED_SRC_DIR, 'manifest-required.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, string[]>;
    const files = manifest.destinations;
    if (!files || files.length === 0) {
        throw new Error('manifest-required.json has no entries for "destinations"');
    }
    return files;
}

/** A minimal `SeedContext` stub — `preProcessDestination`'s `_context` param is unused. */
const dummyContext = {} as SeedContext;

describe('required seed determinism + hierarchy computation (HOS-25 T-025)', () => {
    describe('getDestinationFixtureId', () => {
        const files = readDestinationManifestFiles();
        const fixtures = files.map((file) => loadFixture<DestinationFixture>(file, 'destination'));

        it('should return the same id across repeated calls for the same fixture', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            expect(getDestinationFixtureId(fixture)).toBe(getDestinationFixtureId(fixture));
        });

        it('should match the documented seed-key convention exactly', () => {
            const fixture = fixtures[0];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            const expected = deterministicFixtureId({ seedKey: `destination:${fixture.id}` });
            expect(getDestinationFixtureId(fixture)).toBe(expected);
        });

        it('should produce a unique id for every real destination fixture', () => {
            const ids = fixtures.map((fixture) => getDestinationFixtureId(fixture));
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('should be independent of process/module re-evaluation (pure function of seedKey)', () => {
            const fixture = fixtures[10];
            expect(fixture).toBeDefined();
            if (!fixture) return;

            const idFromOriginalObject = getDestinationFixtureId(fixture);
            const idFromClonedObject = getDestinationFixtureId({ id: fixture.id });

            expect(idFromClonedObject).toBe(idFromOriginalObject);
        });
    });

    describe('getDestinationFaqFixtureId', () => {
        it('should return the same id across repeated calls for the same (destinationSeedKey, index) pair', () => {
            const input = { destinationSeedKey: 'destination:011-destination-x', index: 0 };
            expect(getDestinationFaqFixtureId(input)).toBe(getDestinationFaqFixtureId(input));
        });

        it('should match the documented composite seed-key convention exactly', () => {
            const input = { destinationSeedKey: 'destination:011-destination-x', index: 2 };
            const expected = deterministicFixtureId({
                seedKey: `destinationFaq:${input.destinationSeedKey}:${input.index}`
            });
            expect(getDestinationFaqFixtureId(input)).toBe(expected);
        });

        it('should produce distinct ids for different FAQ indices under the same destination', () => {
            const destinationSeedKey = 'destination:011-destination-x';
            const ids = [0, 1, 2, 3].map((index) =>
                getDestinationFaqFixtureId({ destinationSeedKey, index })
            );
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('should produce stable, unique ids for every FAQ across all real destination fixtures with FAQs', () => {
            const files = readDestinationManifestFiles();
            const fixtures = files.map((file) =>
                loadFixture<DestinationFixture>(file, 'destination')
            );
            const withFaqs = fixtures.filter((fixture) => (fixture.faqs?.length ?? 0) > 0);

            // Sanity: the real dataset must actually exercise this path (SPEC-158's
            // 22 CITY destinations each carry 5-7 FAQs).
            expect(withFaqs.length).toBeGreaterThan(0);

            const allFaqIds: string[] = [];
            for (const fixture of withFaqs) {
                const destinationSeedKey = `destination:${fixture.id}`;
                const faqs = fixture.faqs ?? [];
                for (let index = 0; index < faqs.length; index++) {
                    const id = getDestinationFaqFixtureId({ destinationSeedKey, index });
                    expect(getDestinationFaqFixtureId({ destinationSeedKey, index })).toBe(id);
                    allFaqIds.push(id);
                }
            }

            expect(new Set(allFaqIds).size).toBe(allFaqIds.length);
        });
    });

    describe('preProcessDestination hierarchy computation (real fixtures, real manifest order)', () => {
        const files = readDestinationManifestFiles();
        const fixturesById = new Map<string, DestinationFixture>();
        // Working copies, processed in-place by preProcessDestination — mirrors
        // exactly what the seed factory does at runtime (mutates `item`).
        const processed: DestinationFixture[] = [];

        beforeAll(async () => {
            for (const file of files) {
                const fixture = loadFixture<DestinationFixture>(file, 'destination');
                fixturesById.set(fixture.id, fixture);
                await preProcessDestination(fixture, dummyContext);
                processed.push(fixture);
            }
        });

        it('should assign level=0, an empty pathIds, and a root path to the top-level COUNTRY', () => {
            const argentina = processed.find((d) => d.destinationType === 'COUNTRY');
            expect(argentina).toBeDefined();
            if (!argentina) return;

            const withHierarchy = argentina as unknown as {
                level: number;
                path: string;
                pathIds: string;
            };
            expect(withHierarchy.level).toBe(0);
            expect(withHierarchy.pathIds).toBe('');
            expect(withHierarchy.path).toBe(`/${argentina.slug}`);
        });

        it("should resolve parentDestinationId to the parent's deterministic UUID (not the seed id)", () => {
            const child = processed.find((d) => d.parentDestinationId !== undefined);
            expect(child).toBeDefined();
            if (!child?.parentDestinationId) return;

            // After preProcessDestination runs, parentDestinationId must be a
            // real deterministic UUID string, never the original seed-id
            // string (which always starts with a numeric prefix like
            // "103-destination-...").
            expect(child.parentDestinationId).not.toMatch(/^\d/);
            expect(child.parentDestinationId).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
            );
        });

        it('should increment level by exactly 1 per hierarchy step down to a CITY leaf', () => {
            const city = processed.find((d) => d.destinationType === 'CITY');
            expect(city).toBeDefined();
            if (!city) return;

            const withLevel = city as unknown as { level: number };
            // COUNTRY(0) -> REGION(1) -> PROVINCE(2) -> DEPARTMENT(3) -> CITY(4)
            expect(withLevel.level).toBe(4);
        });

        it('should build pathIds as the deterministic-UUID ancestor chain, root-to-parent', () => {
            const city = processed.find((d) => d.id === '011-destination-concepcion-del-uruguay');
            expect(city).toBeDefined();
            if (!city) return;

            const argentina = fixturesById.get('100-destination-argentina');
            const litoral = fixturesById.get('101-destination-litoral');
            const entreRios = fixturesById.get('102-destination-entre-rios');
            const departamento = fixturesById.get('103-destination-departamento-uruguay');
            expect(argentina && litoral && entreRios && departamento).toBeTruthy();
            if (!argentina || !litoral || !entreRios || !departamento) return;

            const expectedPathIds = [
                getDestinationFixtureId(argentina),
                getDestinationFixtureId(litoral),
                getDestinationFixtureId(entreRios),
                getDestinationFixtureId(departamento)
            ].join('/');

            const withPathIds = city as unknown as { pathIds: string };
            expect(withPathIds.pathIds).toBe(expectedPathIds);
        });

        it('should build a slash-separated path mirroring the full ancestor slug chain', () => {
            const city = processed.find((d) => d.id === '011-destination-concepcion-del-uruguay');
            expect(city).toBeDefined();
            if (!city) return;

            const withPath = city as unknown as { path: string };
            expect(withPath.path).toBe(
                '/argentina/litoral/entre-rios/departamento-uruguay/concepcion-del-uruguay'
            );
        });

        it('should produce a unique `path` for every real destination fixture (matches the DB unique constraint)', () => {
            const paths = processed.map((d) => (d as unknown as { path: string }).path);
            expect(new Set(paths).size).toBe(paths.length);
        });

        it('should throw when a child references a parent that has not been processed yet', async () => {
            const orphan: DestinationFixture = {
                id: '999-destination-orphan-test',
                slug: 'orphan-test',
                destinationType: 'CITY',
                parentDestinationId: '999-destination-nonexistent-parent'
            };

            await expect(preProcessDestination(orphan, dummyContext)).rejects.toThrow(
                /has not been processed yet/i
            );
        });

        it('should throw on an invalid parent-child type relationship', async () => {
            // A CITY cannot be the parent of a REGION (wrong direction/level).
            const invalidChild: DestinationFixture = {
                id: '998-destination-invalid-child-test',
                slug: 'invalid-child-test',
                destinationType: 'REGION',
                parentDestinationId: '011-destination-concepcion-del-uruguay'
            };

            await expect(preProcessDestination(invalidChild, dummyContext)).rejects.toThrow(
                /invalid parent-child relationship/i
            );
        });
    });

    describe('wired modelClass shape (static contract)', () => {
        // `SeedFactoryConfig.deterministicId.modelClass` requires a `SeedModelConstructor`
        // (`new () => { create(data): Promise<unknown> }`). This is enforced at compile
        // time by `pnpm typecheck` for `destinations.seed.ts` — this assertion just
        // documents that the concrete `@repo/db` model classes wired there
        // (`DestinationModel`, `DestinationFaqModel`) satisfy that shape.
        it('should expose a no-arg constructor and a create() method', () => {
            expect(typeof new DestinationModel().create).toBe('function');
            expect(typeof new DestinationFaqModel().create).toBe('function');
        });
    });

    describe('destination-POI relationship fixtures (HOS-113 T-026)', () => {
        interface DestinationFixtureWithPoi extends DestinationFixture {
            pointOfInterestIds?: string[];
        }

        /** Reads the real manifest-listed POI seed ids (T-023/T-025). */
        function readPointOfInterestSeedIds(): Set<string> {
            const manifestPath = join(SEED_SRC_DIR, 'manifest-required.json');
            const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<
                string,
                string[]
            >;
            const files = manifest.pointsOfInterest ?? [];
            const ids = files.map((file) => {
                const fixture = loadFixture<{ id: string }>(file, 'pointOfInterest');
                return fixture.id;
            });
            return new Set(ids);
        }

        it('should have pointOfInterestIds on at least 3 destination fixtures', () => {
            const files = readDestinationManifestFiles();
            const withPoi = files
                .map((file) => loadFixture<DestinationFixtureWithPoi>(file, 'destination'))
                .filter((fixture) => (fixture.pointOfInterestIds?.length ?? 0) > 0);

            expect(withPoi.length).toBeGreaterThanOrEqual(3);
        });

        it('should reference only POI seed ids that actually exist in the pointsOfInterest manifest (no silent slug mismatch)', () => {
            const poiSeedIds = readPointOfInterestSeedIds();
            const files = readDestinationManifestFiles();
            const destinationsWithPoi = files
                .map((file) => loadFixture<DestinationFixtureWithPoi>(file, 'destination'))
                .filter((fixture) => (fixture.pointOfInterestIds?.length ?? 0) > 0);

            for (const destination of destinationsWithPoi) {
                for (const poiSeedId of destination.pointOfInterestIds ?? []) {
                    expect(poiSeedIds.has(poiSeedId)).toBe(true);
                }
            }
        });

        it('should map at least one POI to 2+ destinations (M2M coverage, OQ-1)', () => {
            const files = readDestinationManifestFiles();
            const destinationsWithPoi = files
                .map((file) => loadFixture<DestinationFixtureWithPoi>(file, 'destination'))
                .filter((fixture) => (fixture.pointOfInterestIds?.length ?? 0) > 0);

            const destinationCountByPoi = new Map<string, number>();
            for (const destination of destinationsWithPoi) {
                for (const poiSeedId of destination.pointOfInterestIds ?? []) {
                    destinationCountByPoi.set(
                        poiSeedId,
                        (destinationCountByPoi.get(poiSeedId) ?? 0) + 1
                    );
                }
            }

            const multiDestinationPois = [...destinationCountByPoi.entries()].filter(
                ([, count]) => count >= 2
            );
            expect(multiDestinationPois.length).toBeGreaterThanOrEqual(1);
        });

        it('should map "playa_banco_pelay" to both concepcion-del-uruguay and liebig specifically', () => {
            const cdu = loadFixture<DestinationFixtureWithPoi>(
                '011-destination-concepcion-del-uruguay.json',
                'destination'
            );
            const liebig = loadFixture<DestinationFixtureWithPoi>(
                '007-destination-liebig.json',
                'destination'
            );

            const bancoPelaySeedId = '002-point-of-interest-playa_banco_pelay';
            expect(cdu.pointOfInterestIds).toContain(bancoPelaySeedId);
            expect(liebig.pointOfInterestIds).toContain(bancoPelaySeedId);
        });
    });
});
