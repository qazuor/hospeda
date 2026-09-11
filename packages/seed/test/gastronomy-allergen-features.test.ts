/**
 * HOS-1054 — the aptos of a gastronomy carta are catalog rows, and this guard
 * keeps them that way.
 *
 * ## Why a guard and not five assertions in a service test
 *
 * The aptos («sin TACC», «vegano», «vegetariano», «sin lactosa», «sin frutos
 * secos») have no column, no enum and no entitlement key. They are five rows of
 * `src/data/feature/` scoped to the `gastronomy` vertical, whose SLUG is also
 * their i18n key. Nothing in the type system connects those three facts, so a
 * rename of one slug, a dropped `applicableVerticals`, a missing manifest entry
 * or an untranslated locale all fail the same silent way: the apto simply stops
 * being offered, and a celiac reads its absence as "this place did not say".
 *
 * ## What this asserts, and what it cannot
 *
 * It reads the fixture JSON, the required manifest and the three locale files
 * off disk and checks they agree. It does NOT run the seeder, touch a database,
 * or prove the rows reach a deployed environment — the dual-write data-migration
 * (`0076-hos-1054-allergen-features.ts`) covers already-seeded environments and
 * `scripts/check-seed-dual-write.sh` is what enforces that it exists.
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
 * The aptos, and the fixture file each one lives in.
 *
 * A FIXED list on purpose: the point of the guard is that removing an apto has
 * to be a deliberate edit here, seen in review, rather than a fixture quietly
 * disappearing from a folder nobody enumerates.
 */
const APTO_FIXTURES = [
    { slug: 'gluten_free_options', file: '081-feature-gluten_free_options.json' },
    { slug: 'vegan_options', file: '082-feature-vegan_options.json' },
    { slug: 'vegetarian_options', file: '083-feature-vegetarian_options.json' },
    { slug: 'lactose_free_options', file: '097-feature-lactose_free_options.json' },
    { slug: 'nut_free_options', file: '098-feature-nut_free_options.json' }
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

describe('gastronomy aptos are catalog rows (HOS-1054)', () => {
    it.each(APTO_FIXTURES)('$slug: the fixture file declares that exact slug', ({ slug, file }) => {
        expect(readFixture(file).slug).toBe(slug);
    });

    it.each(APTO_FIXTURES)('$slug: is scoped to the gastronomy vertical', ({ file }) => {
        // Without this the apto would be offered on accommodations and
        // experiences too, where "sin TACC" means nothing.
        expect(readFixture(file).applicableVerticals).toContain('gastronomy');
    });

    it.each(APTO_FIXTURES)('$slug: is ACTIVE, so the owner can actually tick it', ({ file }) => {
        expect(readFixture(file).lifecycleState).toBe('ACTIVE');
    });

    it.each(APTO_FIXTURES)('$slug: is listed in the required manifest', ({ file }) => {
        // A fixture absent from the manifest is never read by the seeder: the
        // file exists, the row does not.
        expect(requiredManifest.features).toContain(file);
    });

    it.each(APTO_FIXTURES)('$slug: has a real label in es, en and pt', ({ slug }) => {
        for (const locale of LOCALES) {
            const label = readFeatureNames(locale)[slug];
            expect(label, `${locale} label for ${slug}`).toBeTruthy();
            // The slug rendered raw is what the UI falls back to when the key is
            // missing, so a label equal to the slug is an absent translation
            // wearing a present one's clothes.
            expect(label).not.toBe(slug);
        }
    });

    it('the two new aptos each ship a data-migration counterpart file name', () => {
        // Not a substitute for `check-seed-dual-write.sh` (which diffs the PR),
        // just a local reminder that these two rows are the ones a live
        // environment needs delivered, and that the migration is named for them.
        const migration = readFileSync(
            join(SEED_SRC_DIR, 'data-migrations/0076-hos-1054-allergen-features.ts'),
            'utf-8'
        );
        expect(migration).toContain('097-feature-lactose_free_options.json');
        expect(migration).toContain('098-feature-nut_free_options.json');
    });
});
