/**
 * Factory/config-level tests for the `required` points-of-interest seed
 * (HOS-113 T-024).
 *
 * `src/required/**\/*.seed.ts` files are excluded from unit coverage
 * (vitest.config.ts) because `createSeedFactory` instantiates the real
 * service class directly and cannot run without a live database — there is
 * no existing `attractions.seed.test.ts` to mirror for that reason. This
 * suite instead follows the SAME real precedent already established by
 * `destinations.seed.test.ts` (HOS-25 T-025): it drives the exported PURE
 * helper functions (`normalizePointOfInterestSeedItem`,
 * `getPointOfInterestEntityInfo`) against the REAL fixture files, in the
 * REAL `manifest-required.json` order, without touching a database — plus
 * an explicit schema-validation pass standing in for "would be accepted by
 * `service.create()`" (which is what the real factory ultimately calls).
 *
 * A real-DB run (fresh-seed produces the POIs + destination relationships,
 * idempotent on re-run) is HOS-113 T-028's integration test, which this
 * file explicitly does not attempt to duplicate.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PointOfInterestCreateInputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    getPointOfInterestEntityInfo,
    normalizePointOfInterestSeedItem
} from '../../src/required/pointsOfInterest.seed.js';
import type { SeedContext } from '../../src/utils/seedContext.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_SRC_DIR = join(__dirname, '../../src');

/** Minimal shape of a POI fixture, for the fields these tests need. */
interface PointOfInterestFixture {
    $schema?: string;
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

/** Loads and parses a JSON fixture file relative to `src/data/<folder>`. */
function loadFixture<T>(relativePath: string, folder: string): T {
    const fullPath = join(SEED_SRC_DIR, 'data', folder, relativePath);
    return JSON.parse(readFileSync(fullPath, 'utf-8')) as T;
}

/** Reads the real `manifest-required.json` file list for `pointsOfInterest`. */
function readPointOfInterestManifestFiles(): string[] {
    const manifestPath = join(SEED_SRC_DIR, 'manifest-required.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, string[]>;
    const files = manifest.pointsOfInterest;
    if (!files || files.length === 0) {
        throw new Error('manifest-required.json has no entries for "pointsOfInterest"');
    }
    return files;
}

const dummyContext = {} as SeedContext;

describe('required points-of-interest seed (HOS-113 T-024)', () => {
    describe('manifest wiring (HOS-113 T-025)', () => {
        it('should list every fixture file present under src/data/pointOfInterest', () => {
            const files = readPointOfInterestManifestFiles();
            expect(files.length).toBeGreaterThanOrEqual(10);
            expect(files.length).toBeLessThanOrEqual(12 + 5); // sanity ceiling, not a hard cap
        });

        it('should load every manifest-listed file without error', () => {
            const files = readPointOfInterestManifestFiles();
            for (const file of files) {
                expect(() =>
                    loadFixture<PointOfInterestFixture>(file, 'pointOfInterest')
                ).not.toThrow();
            }
        });
    });

    describe('normalizePointOfInterestSeedItem', () => {
        it('should strip $schema, id, and lifecycleState', () => {
            const raw = {
                $schema: '../../schemas/point-of-interest.schema.json',
                id: '001-point-of-interest-test',
                slug: 'test_poi',
                lat: -32.48,
                long: -58.23,
                type: 'PARK',
                lifecycleState: 'ACTIVE'
            };

            const normalized = normalizePointOfInterestSeedItem(raw);

            expect(normalized).not.toHaveProperty('$schema');
            expect(normalized).not.toHaveProperty('id');
            expect(normalized).not.toHaveProperty('lifecycleState');
        });

        it('should KEEP slug — unlike attractions.seed.ts, POIs have no name column (OQ-2)', () => {
            const raw = {
                $schema: 'x',
                id: '001-x',
                slug: 'test_poi',
                lat: -32.48,
                long: -58.23,
                type: 'PARK'
            };

            const normalized = normalizePointOfInterestSeedItem(raw);

            expect(normalized.slug).toBe('test_poi');
        });

        it('should pass through domain fields unchanged (lat/long/type/description/icon/isFeatured/isBuiltin/displayWeight)', () => {
            const raw = {
                $schema: 'x',
                id: '001-x',
                slug: 'test_poi',
                lat: -32.48,
                long: -58.23,
                type: 'PARK',
                description: 'A test point of interest description',
                icon: 'park',
                isFeatured: true,
                isBuiltin: true,
                displayWeight: 60
            };

            const normalized = normalizePointOfInterestSeedItem(raw);

            expect(normalized).toEqual({
                slug: 'test_poi',
                lat: -32.48,
                long: -58.23,
                type: 'PARK',
                description: 'A test point of interest description',
                icon: 'park',
                isFeatured: true,
                isBuiltin: true,
                displayWeight: 60
            });
        });

        it('should be a pure function (repeated calls on the same input produce equal output)', () => {
            const raw = {
                $schema: 'x',
                id: '001-x',
                slug: 'test_poi',
                lat: -32.48,
                long: -58.23,
                type: 'PARK'
            };

            expect(normalizePointOfInterestSeedItem(raw)).toEqual(
                normalizePointOfInterestSeedItem(raw)
            );
        });
    });

    describe('getPointOfInterestEntityInfo', () => {
        it('should format using slug and type (no name field, OQ-2)', () => {
            const info = getPointOfInterestEntityInfo(
                { slug: 'playa_banco_pelay', type: 'BEACH', isBuiltin: true },
                dummyContext
            );
            expect(info).toContain('playa_banco_pelay');
            expect(info).toContain('BEACH');
        });

        it('should not include a builtin icon for a non-builtin item', () => {
            const withIcon = getPointOfInterestEntityInfo(
                { slug: 'x', type: 'OTHER', isBuiltin: true },
                dummyContext
            );
            const withoutIcon = getPointOfInterestEntityInfo(
                { slug: 'x', type: 'OTHER', isBuiltin: false },
                dummyContext
            );
            expect(withIcon).not.toBe(withoutIcon);
        });
    });

    describe('real fixtures validate against PointOfInterestCreateInputSchema', () => {
        const files = readPointOfInterestManifestFiles();
        const fixtures = files.map((file) =>
            loadFixture<PointOfInterestFixture>(file, 'pointOfInterest')
        );

        it('should have at least 10 fixtures (AC-3 / T-023 curated set)', () => {
            expect(fixtures.length).toBeGreaterThanOrEqual(10);
        });

        it('should cover all 9 PointOfInterestTypeEnum values across the fixture set', () => {
            const ALL_TYPES = [
                'BEACH',
                'STADIUM',
                'PARK',
                'MUSEUM',
                'PLAZA',
                'MONUMENT',
                'VIEWPOINT',
                'NATURAL',
                'OTHER'
            ];
            const seenTypes = new Set(fixtures.map((f) => f.type));
            for (const type of ALL_TYPES) {
                expect(seenTypes.has(type)).toBe(true);
            }
        });

        it('should have NO name field on any fixture (OQ-2 — display via i18n by slug)', () => {
            for (const fixture of fixtures) {
                expect(fixture).not.toHaveProperty('name');
            }
        });

        it('should have a unique slug per fixture', () => {
            const slugs = fixtures.map((f) => f.slug);
            expect(new Set(slugs).size).toBe(slugs.length);
        });

        it('every normalized fixture should safe-parse against PointOfInterestCreateInputSchema', () => {
            for (const fixture of fixtures) {
                const normalized = normalizePointOfInterestSeedItem(
                    fixture as unknown as Record<string, unknown>
                );
                const result = PointOfInterestCreateInputSchema.safeParse(normalized);
                if (!result.success) {
                    throw new Error(
                        `Fixture "${fixture.id}" failed schema validation: ${JSON.stringify(result.error.issues)}`
                    );
                }
                expect(result.success).toBe(true);
            }
        });
    });

    describe('HOS-142 AC-5 — pointOfInterestCatalog must never bloat --required', () => {
        function readRequiredManifest(): Record<string, string[]> {
            const manifestPath = join(SEED_SRC_DIR, 'manifest-required.json');
            return JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, string[]>;
        }

        it('requiredManifest.pointsOfInterest must have exactly its pre-HOS-142 length of 12', () => {
            const manifest = readRequiredManifest();
            expect(manifest.pointsOfInterest).toHaveLength(12);
        });

        it('requiredManifest.pointOfInterestCatalog must exist as its own, separate key', () => {
            const manifest = readRequiredManifest();
            expect(manifest.pointOfInterestCatalog).toBeDefined();
            expect(Array.isArray(manifest.pointOfInterestCatalog)).toBe(true);
        });

        it('pointsOfInterest and pointOfInterestCatalog must never declare the same filename twice', () => {
            const manifest = readRequiredManifest();
            const required = manifest.pointsOfInterest ?? [];
            const catalog = manifest.pointOfInterestCatalog ?? [];
            const overlap = required.filter((f) => catalog.includes(f));
            expect(overlap).toEqual([]);
        });
    });
});
