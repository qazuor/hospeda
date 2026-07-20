/**
 * Factory/config-level tests for the `--poi-catalog` seed group (HOS-142).
 *
 * Mirrors `test/required/pointsOfInterest.seed.test.ts`'s approach: drives
 * the REAL fixture files (via the REAL `manifest-required.json`
 * `pointOfInterestCatalog` key) through `normalizePointOfInterestSeedItem`
 * and an explicit `PointOfInterestCreateInputSchema` validation pass, without
 * touching a database (`createSeedFactory` instantiates the real service
 * class directly and cannot run without a live database).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PointOfInterestCreateInputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { normalizePointOfInterestSeedItem } from '../../src/required/pointsOfInterest.seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_SRC_DIR = join(__dirname, '../../src');

/** Minimal shape of a POI catalog fixture, for the fields these tests need. */
interface PointOfInterestCatalogFixture {
    readonly $schema?: string;
    readonly id: string;
    readonly slug: string;
    readonly lat: number | null;
    readonly long: number | null;
    readonly type: string;
    readonly categories?: ReadonlyArray<{ readonly slug: string; readonly isPrimary: boolean }>;
    readonly [key: string]: unknown;
}

/** Loads and parses a JSON fixture file relative to `src/data/pointOfInterest`. */
function loadFixture(relativePath: string): PointOfInterestCatalogFixture {
    const fullPath = join(SEED_SRC_DIR, 'data', 'pointOfInterest', relativePath);
    return JSON.parse(readFileSync(fullPath, 'utf-8')) as PointOfInterestCatalogFixture;
}

/** Reads the real `manifest-required.json` file list for `pointOfInterestCatalog`. */
function readCatalogManifestFiles(): string[] {
    const manifestPath = join(SEED_SRC_DIR, 'manifest-required.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, string[]>;
    const files = manifest.pointOfInterestCatalog;
    if (!files) {
        throw new Error('manifest-required.json has no entry for "pointOfInterestCatalog"');
    }
    return files;
}

describe('--poi-catalog seed group (HOS-142)', () => {
    const files = readCatalogManifestFiles();

    it('manifest lists exactly 830 fixtures (908 post-HOS-142 rows minus 78 removed by the poi-curation-safe-subset pass)', () => {
        expect(files).toHaveLength(830);
    });

    it('loads every manifest-listed file without error', () => {
        for (const file of files) {
            expect(() => loadFixture(file)).not.toThrow();
        }
    });

    describe('real fixtures', () => {
        const fixtures = files.map(loadFixture);

        it('every fixture has a unique slug', () => {
            const slugs = fixtures.map((f) => f.slug);
            expect(new Set(slugs).size).toBe(slugs.length);
        });

        it('every fixture has at least one category assignment (HOS-139 M2M)', () => {
            for (const fixture of fixtures) {
                expect(fixture.categories?.length ?? 0).toBeGreaterThan(0);
            }
        });

        it('every fixture has exactly one primary category', () => {
            for (const fixture of fixtures) {
                const primaryCount = (fixture.categories ?? []).filter((c) => c.isPrimary).length;
                expect(primaryCount).toBe(1);
            }
        });

        it('every normalized fixture safe-parses against PointOfInterestCreateInputSchema', () => {
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

        it('nameI18n.es is always populated; en/pt may be null (NG-6 — not invented)', () => {
            for (const fixture of fixtures) {
                const nameI18n = fixture.nameI18n as
                    | { es: string; en: string | null; pt: string | null }
                    | undefined;
                expect(nameI18n?.es).toBeTruthy();
                expect(nameI18n?.en === null || typeof nameI18n?.en === 'string').toBe(true);
                expect(nameI18n?.pt === null || typeof nameI18n?.pt === 'string').toBe(true);
            }
        });

        it('no fixture carries a raw verifiedAt string (sanitized to null at import time)', () => {
            for (const fixture of fixtures) {
                expect(typeof fixture.verifiedAt).not.toBe('string');
            }
        });

        it('no fixture exceeds the source field 200-char max', () => {
            for (const fixture of fixtures) {
                if (typeof fixture.source === 'string') {
                    expect(fixture.source.length).toBeLessThanOrEqual(200);
                }
            }
        });
    });
});
