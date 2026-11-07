/**
 * HOS-2059 -- data-migration 0147 and the seed baseline agree (dual-write,
 * HOS-25). A fresh DB gets the curated catalog from the JSON fixtures; an
 * already-seeded DB gets it from 0147. This reads both off disk and fails if
 * they drift. The DB behaviour of `up()` is pinned in
 * `hos2059-catalog-curation.integration.test.ts`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AmenityCreateInputSchema, FeatureCreateInputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    AMENITY_RETYPES,
    CATALOG_MERGES,
    FEATURE_SLUG_RENAMES,
    FEATURE_VERTICAL_WIDENINGS,
    meta,
    NEW_AMENITY_FIXTURE_FILES,
    NEW_FEATURE_FIXTURE_FILES
} from '../../src/data-migrations/0147-hos-2059-catalog-curation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '../../src');
const I18N = join(__dirname, '../../../i18n/src/locales');

interface Fixture {
    readonly slug: string;
    readonly type?: string;
    readonly applicableVerticals: readonly string[];
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf-8')) as T;

const readDir = (dir: string): ReadonlyMap<string, Fixture> =>
    new Map(
        readdirSync(join(SRC, 'data', dir))
            .filter((file) => file.endsWith('.json'))
            .map((file) => {
                const fixture = readJson<Fixture>(join(SRC, 'data', dir, file));
                return [fixture.slug, fixture] as const;
            })
    );

const amenities = readDir('amenity');
const features = readDir('feature');
const catalogOf = (kind: 'amenity' | 'feature') => (kind === 'amenity' ? amenities : features);
const manifest = readJson<{ amenities: string[]; features: string[] }>(
    join(SRC, 'manifest-required.json')
);

describe('0147-hos-2059-catalog-curation', () => {
    it('is a destructive required migration that needs the HOS-2058 scope and category columns', () => {
        expect(meta).toEqual({
            name: '0147-hos-2059-catalog-curation',
            group: 'required',
            destructive: true,
            requiresColumns: [
                { table: 'r_accommodation_amenity', column: 'scope' },
                { table: 'features', column: 'category' }
            ]
        });
    });

    it('inserts 60 amenity and 6 feature fixtures that exist and are in the manifest', () => {
        expect(NEW_AMENITY_FIXTURE_FILES).toHaveLength(60);
        expect(NEW_FEATURE_FIXTURE_FILES).toHaveLength(6);
        for (const file of NEW_AMENITY_FIXTURE_FILES) {
            expect(manifest.amenities, file).toContain(file);
            expect(() => readFileSync(join(SRC, 'data/amenity', file)), file).not.toThrow();
        }
        for (const file of NEW_FEATURE_FIXTURE_FILES) {
            expect(manifest.features, file).toContain(file);
            expect(() => readFileSync(join(SRC, 'data/feature', file)), file).not.toThrow();
        }
    });

    it('every new fixture passes the service create schema the fresh-DB seed uses', () => {
        // The fresh-DB seed creates rows through the service, which validates
        // them; 0147 inserts directly. A 9-character description passed 0147
        // and broke the E2E seed (`toaster`), so the service schema is the bar.
        for (const file of NEW_AMENITY_FIXTURE_FILES) {
            const {
                id: _id,
                $schema: _schema,
                ...fixture
            } = readJson<Record<string, unknown>>(join(SRC, 'data/amenity', file));
            const result = AmenityCreateInputSchema.safeParse(fixture);
            expect(result.success, `${file}: ${result.error?.message}`).toBe(true);
        }
        for (const file of NEW_FEATURE_FIXTURE_FILES) {
            const {
                id: _id,
                $schema: _schema,
                ...fixture
            } = readJson<Record<string, unknown>>(join(SRC, 'data/feature', file));
            const result = FeatureCreateInputSchema.safeParse(fixture);
            expect(result.success, `${file}: ${result.error?.message}`).toBe(true);
        }
    });

    it('numbers new rows after the HOS-1787 epic (amenity 113, feature 108)', () => {
        const number = (file: string) => Number(file.split('-')[0]);
        expect(Math.min(...NEW_AMENITY_FIXTURE_FILES.map(number))).toBe(114);
        expect(Math.min(...NEW_FEATURE_FIXTURE_FILES.map(number))).toBe(109);
    });

    it('the baseline carries every retype', () => {
        for (const retype of AMENITY_RETYPES) {
            expect(amenities.get(retype.slug)?.type, retype.slug).toBe(retype.to);
        }
    });

    it('the baseline carries the slug rename', () => {
        for (const rename of FEATURE_SLUG_RENAMES) {
            expect(features.has(rename.from), rename.from).toBe(false);
            expect(features.has(rename.to), rename.to).toBe(true);
        }
    });

    it('the baseline carries the vertical widening', () => {
        for (const widening of FEATURE_VERTICAL_WIDENINGS) {
            expect(features.get(widening.slug)?.applicableVerticals).toEqual(widening.verticals);
        }
    });

    it('every retired row is gone from the baseline, and every survivor is in it', () => {
        for (const merge of CATALOG_MERGES) {
            expect(catalogOf(merge.source.kind).has(merge.source.slug), merge.source.slug).toBe(
                false
            );
            expect(catalogOf(merge.target.kind).has(merge.target.slug), merge.target.slug).toBe(
                true
            );
        }
    });

    it('every survivor covers the verticals of the row merged into it', () => {
        // A merge only moves what the source linked; widening is declared in
        // FEATURE_VERTICAL_WIDENINGS. This catches a survivor that silently
        // drops a vertical (the venue/experience editors filter by it).
        const retiredVerticals: Readonly<Record<string, readonly string[]>> = {
            'amenity:panoramic_view': ['accommodation', 'venue', 'experience'],
            'feature:disability_accessible': ['accommodation', 'venue', 'experience']
        };
        for (const merge of CATALOG_MERGES) {
            const verticals = retiredVerticals[`${merge.source.kind}:${merge.source.slug}`] ?? [
                'accommodation'
            ];
            const survivor = catalogOf(merge.target.kind).get(merge.target.slug);
            for (const vertical of verticals) {
                expect(survivor?.applicableVerticals, merge.target.slug).toContain(vertical);
            }
        }
    });

    it('never touches the HOS-1787 night items', () => {
        const touched = [
            ...CATALOG_MERGES.flatMap((merge) => [merge.source.slug, merge.target.slug]),
            ...AMENITY_RETYPES.map((retype) => retype.slug)
        ];
        for (const slug of ['dance_floor', 'vip_area', 'cloakroom', 'dj_sets', 'karaoke']) {
            expect(touched).not.toContain(slug);
        }
    });

    it.each(['es', 'en', 'pt'])('every catalog slug has a %s label', (locale) => {
        const names = readJson<{
            amenityNames: Record<string, string>;
            featureNames: Record<string, string>;
        }>(join(I18N, locale, 'accommodations.json'));
        for (const slug of amenities.keys()) {
            expect(names.amenityNames[slug], `amenity ${slug}`).toBeTruthy();
        }
        for (const slug of features.keys()) {
            expect(names.featureNames[slug], `feature ${slug}`).toBeTruthy();
        }
        for (const merge of CATALOG_MERGES) {
            const table = merge.source.kind === 'amenity' ? 'amenityNames' : 'featureNames';
            if (catalogOf(merge.source.kind).has(merge.source.slug)) continue;
            expect(names[table][merge.source.slug], `retired ${merge.source.slug}`).toBeUndefined();
        }
    });
});
