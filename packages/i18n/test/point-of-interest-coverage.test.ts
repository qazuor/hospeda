/**
 * i18n coverage test for Points of Interest (HOS-113 T-030, R-6, AC-7).
 *
 * POIs carry NO `name` column (OQ-2) — display names resolve via
 * `destinations.poiNames.<slug>` and landmark-type labels via
 * `destinations.poiTypeLabels.<TYPE>`, both keyed by the exact seed
 * slug / enum value. This suite reads the REAL seeded POI fixtures
 * (`packages/seed/src/data/pointOfInterest/*.json`, via the real manifest)
 * and asserts every one has a non-empty i18n entry in ALL THREE locales —
 * it must fail loudly if a future seed addition forgets its i18n string
 * (the exact HOS-111 T-009 silent-slug-mismatch class of bug).
 *
 * NOTE ON IMPORT STYLE: this file deliberately uses static ES module
 * imports for every JSON fixture instead of `node:fs.readFileSync`.
 * `test/setup.ts` globally mocks `node:fs`/`node:path` for this package's
 * locale-loading tests (`readFileSync` returns a fixed 3-key stub for any
 * path containing `locales/es/`/`locales/en/`, and `'{}'` otherwise) — a
 * real `readFileSync` call in this file would silently read that stub
 * instead of the actual seed fixtures. Static JSON imports go through
 * Vite's own JSON-asset pipeline and are unaffected by that mock, exactly
 * like `tags-i18n.test.ts`'s cross-package imports.
 */
import { describe, expect, it } from 'vitest';
import poi001 from '../../seed/src/data/pointOfInterest/001-point-of-interest-autodromo_concepcion_del_uruguay.json';
import poi002 from '../../seed/src/data/pointOfInterest/002-point-of-interest-playa_banco_pelay.json';
import poi003 from '../../seed/src/data/pointOfInterest/003-point-of-interest-palacio_san_jose.json';
import poi004 from '../../seed/src/data/pointOfInterest/004-point-of-interest-basilica_inmaculada_concepcion.json';
import poi005 from '../../seed/src/data/pointOfInterest/005-point-of-interest-parque_unzue.json';
import poi006 from '../../seed/src/data/pointOfInterest/006-point-of-interest-isla_del_puerto.json';
import poi007 from '../../seed/src/data/pointOfInterest/007-point-of-interest-plaza_francisco_ramirez.json';
import poi008 from '../../seed/src/data/pointOfInterest/008-point-of-interest-mirador_costanera.json';
import poi009 from '../../seed/src/data/pointOfInterest/009-point-of-interest-complejo_termal_concordia.json';
import poi010 from '../../seed/src/data/pointOfInterest/010-point-of-interest-balneario_itape.json';
import poi011 from '../../seed/src/data/pointOfInterest/011-point-of-interest-parque_nacional_el_palmar.json';
import poi012 from '../../seed/src/data/pointOfInterest/012-point-of-interest-termas_de_federacion.json';
// The i18n package does not depend on @repo/seed at runtime; these imports
// are test-only and resolve the real seed fixtures + manifest via relative
// monorepo paths, mirroring the established precedent in
// tags-i18n.test.ts (which resolves @repo/schemas the same way).
import pointOfInterestManifest from '../../seed/src/manifest-required.json';
import destinationEn from '../src/locales/en/destination.json';
import destinationEs from '../src/locales/es/destination.json';
import destinationPt from '../src/locales/pt/destination.json';

/** Closed taxonomy mirrored from `PointOfInterestTypeEnum` (HOS-113 OQ-3). */
const ALL_POI_TYPES = [
    'BEACH',
    'STADIUM',
    'PARK',
    'MUSEUM',
    'PLAZA',
    'MONUMENT',
    'VIEWPOINT',
    'NATURAL',
    'OTHER'
] as const;

interface PointOfInterestFixture {
    id: string;
    slug: string;
    type: string;
}

/**
 * The 12 statically-imported fixtures, keyed by their manifest filename so
 * the "every manifest-listed file is actually imported here" check (below)
 * can catch a future fixture addition that forgot to also update this test.
 */
const IMPORTED_FIXTURES_BY_FILENAME: Record<string, PointOfInterestFixture> = {
    '001-point-of-interest-autodromo_concepcion_del_uruguay.json': poi001,
    '002-point-of-interest-playa_banco_pelay.json': poi002,
    '003-point-of-interest-palacio_san_jose.json': poi003,
    '004-point-of-interest-basilica_inmaculada_concepcion.json': poi004,
    '005-point-of-interest-parque_unzue.json': poi005,
    '006-point-of-interest-isla_del_puerto.json': poi006,
    '007-point-of-interest-plaza_francisco_ramirez.json': poi007,
    '008-point-of-interest-mirador_costanera.json': poi008,
    '009-point-of-interest-complejo_termal_concordia.json': poi009,
    '010-point-of-interest-balneario_itape.json': poi010,
    '011-point-of-interest-parque_nacional_el_palmar.json': poi011,
    '012-point-of-interest-termas_de_federacion.json': poi012
};

const manifestFiles: string[] =
    (pointOfInterestManifest as Record<string, string[]>).pointsOfInterest ?? [];

const LOCALES = [
    { code: 'es', poiNames: destinationEs.poiNames, poiTypeLabels: destinationEs.poiTypeLabels },
    { code: 'en', poiNames: destinationEn.poiNames, poiTypeLabels: destinationEn.poiTypeLabels },
    { code: 'pt', poiNames: destinationPt.poiNames, poiTypeLabels: destinationPt.poiTypeLabels }
] as const;

describe('Points of Interest i18n coverage (HOS-113 T-030, AC-7)', () => {
    it('should find at least 10 entries in manifest-required.json\'s "pointsOfInterest" array (sanity — T-025)', () => {
        expect(manifestFiles.length).toBeGreaterThanOrEqual(10);
    });

    it('should statically import every manifest-listed fixture in this test file (no silently-forgotten fixture)', () => {
        const missingImports = manifestFiles.filter((file) => !IMPORTED_FIXTURES_BY_FILENAME[file]);
        expect(missingImports, 'Manifest lists a fixture not imported by this test').toEqual([]);
    });

    const seededPois = manifestFiles
        .map((file) => IMPORTED_FIXTURES_BY_FILENAME[file])
        .filter((fixture): fixture is PointOfInterestFixture => Boolean(fixture));

    describe('poiNames.<slug> coverage', () => {
        for (const locale of LOCALES) {
            it(`every seeded POI slug should have a non-empty destinations.poiNames.<slug> entry in "${locale.code}"`, () => {
                const missing: string[] = [];
                for (const poi of seededPois) {
                    const value = (locale.poiNames as Record<string, string>)[poi.slug];
                    if (!value || value.trim() === '') {
                        missing.push(poi.slug);
                    }
                }
                expect(missing, `Missing/empty poiNames.<slug> in "${locale.code}"`).toEqual([]);
            });
        }
    });

    describe('poiTypeLabels.<TYPE> coverage', () => {
        for (const locale of LOCALES) {
            it(`all 9 PointOfInterestTypeEnum values should have a non-empty destinations.poiTypeLabels.<TYPE> entry in "${locale.code}"`, () => {
                const missing: string[] = [];
                for (const type of ALL_POI_TYPES) {
                    const value = (locale.poiTypeLabels as Record<string, string>)[type];
                    if (!value || value.trim() === '') {
                        missing.push(type);
                    }
                }
                expect(missing, `Missing/empty poiTypeLabels.<TYPE> in "${locale.code}"`).toEqual(
                    []
                );
            });
        }
    });

    describe('referential integrity — every seeded type actually belongs to the closed enum', () => {
        it('should never see a POI fixture type outside the 9 known enum values (would indicate a schema/seed drift)', () => {
            const unknownTypes = seededPois
                .map((poi) => poi.type)
                .filter((type) => !(ALL_POI_TYPES as readonly string[]).includes(type));
            expect(unknownTypes).toEqual([]);
        });
    });

    describe('slug/i18n-key discipline (SPEC-266 pattern, HOS-111 T-009 lesson)', () => {
        it('every seeded slug should match the i18n-key-safe regex (lowercase, digits, hyphen/underscore)', () => {
            const invalidSlugs = seededPois
                .map((poi) => poi.slug)
                .filter((slug) => !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug));
            expect(invalidSlugs).toEqual([]);
        });
    });
});
