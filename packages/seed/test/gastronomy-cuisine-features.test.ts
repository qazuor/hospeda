/**
 * HOS-1073 — a gastronomy listing's cuisine style («cocina italiana»,
 * «cocina de río», ...) is catalog rows, and this guard keeps them that way.
 *
 * ## Why a guard and not five assertions in a service test
 *
 * `gastronomies.type` is the venue's CATEGORY (`RESTAURANT`, `PARRILLA`,
 * `CAFE`, ... a closed 9-value enum) — it never said what a place cooks. The
 * measured decision (mirroring HOS-1054's aptos, same epic) is that cuisine
 * style has no column, no enum and no entitlement key: it is eight rows of
 * `src/data/feature/` scoped to the `gastronomy` vertical, whose SLUG is also
 * their i18n key. Nothing in the type system connects those three facts, so a
 * rename of one slug, a dropped `applicableVerticals`, a missing manifest
 * entry or an untranslated locale all fail the same silent way: the cuisine
 * simply stops being offered, and a diner reads its absence as "this place
 * did not say".
 *
 * ## What this asserts, and what it cannot
 *
 * It reads the fixture JSON, the required manifest and the three locale
 * files off disk and checks they agree. It does NOT run the seeder, touch a
 * database, or prove the rows reach a deployed environment — the dual-write
 * data-migration (`0078-hos-1073-gastronomy-cuisine-features.ts`) covers
 * already-seeded environments and `scripts/check-seed-dual-write.sh` is what
 * enforces that it exists.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import requiredManifest from '../src/manifest-required.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_SRC_DIR = join(__dirname, '../src');
const I18N_LOCALES_DIR = join(__dirname, '../../i18n/src/locales');

/**
 * The cuisine styles, and the fixture file each one lives in.
 *
 * A FIXED list on purpose: the point of the guard is that removing a cuisine
 * has to be a deliberate edit here, seen in review, rather than a fixture
 * quietly disappearing from a folder nobody enumerates.
 */
const CUISINE_FIXTURES = [
    { slug: 'argentine_cuisine', file: '099-feature-argentine_cuisine.json' },
    { slug: 'river_cuisine', file: '100-feature-river_cuisine.json' },
    { slug: 'italian_cuisine', file: '101-feature-italian_cuisine.json' },
    { slug: 'peruvian_cuisine', file: '102-feature-peruvian_cuisine.json' },
    { slug: 'international_cuisine', file: '103-feature-international_cuisine.json' },
    { slug: 'asian_cuisine', file: '104-feature-asian_cuisine.json' },
    { slug: 'mediterranean_cuisine', file: '105-feature-mediterranean_cuisine.json' },
    { slug: 'fusion_cuisine', file: '106-feature-fusion_cuisine.json' }
] as const;

/** The locales every user-facing string must exist in. */
const LOCALES = ['es', 'en', 'pt'] as const;

interface FeatureFixture {
    readonly slug?: string;
    readonly applicableVerticals?: readonly string[];
    readonly lifecycleState?: string;
    readonly icon?: string;
}

const readFixture = (file: string): FeatureFixture =>
    JSON.parse(readFileSync(join(SEED_SRC_DIR, 'data/feature', file), 'utf-8'));

const readFeatureNames = (locale: string): Record<string, string> => {
    const raw = JSON.parse(
        readFileSync(join(I18N_LOCALES_DIR, locale, 'accommodations.json'), 'utf-8')
    ) as { featureNames?: Record<string, string> };
    return raw.featureNames ?? {};
};

describe('gastronomy cuisine styles are catalog rows (HOS-1073)', () => {
    it.each(CUISINE_FIXTURES)('$slug: the fixture file declares that exact slug', ({
        slug,
        file
    }) => {
        expect(readFixture(file).slug).toBe(slug);
    });

    it.each(CUISINE_FIXTURES)('$slug: is scoped to the gastronomy vertical', ({ file }) => {
        // Without this the cuisine style would be offered on accommodations
        // and experiences too, where it means nothing.
        expect(readFixture(file).applicableVerticals).toContain('gastronomy');
    });

    it.each(CUISINE_FIXTURES)('$slug: is ACTIVE, so the owner can actually tick it', ({ file }) => {
        expect(readFixture(file).lifecycleState).toBe('ACTIVE');
    });

    it.each(CUISINE_FIXTURES)('$slug: is listed in the required manifest', ({ file }) => {
        // A fixture absent from the manifest is never read by the seeder: the
        // file exists, the row does not.
        expect(requiredManifest.features).toContain(file);
    });

    it.each(CUISINE_FIXTURES)('$slug: has a real label in es, en and pt', ({ slug }) => {
        for (const locale of LOCALES) {
            const label = readFeatureNames(locale)[slug];
            expect(label, `${locale} label for ${slug}`).toBeTruthy();
            // The slug rendered raw is what the UI falls back to when the key
            // is missing, so a label equal to the slug is an absent
            // translation wearing a present one's clothes.
            expect(label).not.toBe(slug);
        }
    });

    it('the eight cuisine rows each ship a data-migration counterpart file name', () => {
        // Not a substitute for `check-seed-dual-write.sh` (which diffs the
        // PR), just a local reminder that these eight rows are the ones a
        // live environment needs delivered, and that the migration is named
        // for them.
        const migration = readFileSync(
            join(SEED_SRC_DIR, 'data-migrations/0078-hos-1073-gastronomy-cuisine-features.ts'),
            'utf-8'
        );
        for (const { file } of CUISINE_FIXTURES) {
            expect(migration).toContain(file);
        }
    });
});
