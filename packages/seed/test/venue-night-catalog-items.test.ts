/**
 * HOS-1867 — the night-life catalog items (dance floor, VIP area, cloakroom,
 * DJ sets, karaoke) are catalog rows, and this guard keeps them that way.
 *
 * ## Why a guard and not five assertions in a service test
 *
 * These items have no column, no enum and no entitlement key: they are rows of
 * `src/data/amenity/` and `src/data/feature/` scoped to the `venue` vertical,
 * whose SLUG is also their i18n key. Nothing in the type system connects those
 * facts, so a dropped `applicableVerticals`, a missing manifest entry, an
 * untranslated locale or an icon absent from the web map all fail the same
 * silent way: the item stops being offered, and a visitor reads its absence as
 * "this place did not say".
 *
 * ## What this asserts, and what it cannot
 *
 * It reads the fixture JSON, the required manifest, the locale files and the
 * web icon map off disk and checks they agree. It does NOT run the seeder,
 * touch a database, or prove the rows reach a deployed environment — the
 * dual-write data-migration (`0135-hos1867-night-catalog-items.ts`) covers
 * already-seeded environments and `scripts/check-seed-dual-write.sh` is what
 * enforces that it exists.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import requiredManifest from '../src/manifest-required.json';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_SRC_DIR = join(__dirname, '../src');
const I18N_LOCALES_DIR = join(__dirname, '../../i18n/src/locales');
const REPO_ROOT = join(__dirname, '../../..');

type CatalogKind = 'amenity' | 'feature';

/**
 * The five night-life items, and the fixture file each one lives in.
 *
 * A FIXED list on purpose: removing an item has to be a deliberate edit here,
 * seen in review, rather than a fixture quietly disappearing from a folder
 * nobody enumerates.
 */
const NIGHT_FIXTURES = [
    { kind: 'amenity', slug: 'dance_floor', file: '111-amenity-entertainment-dance-floor.json' },
    { kind: 'amenity', slug: 'vip_area', file: '112-amenity-services-vip-area.json' },
    { kind: 'amenity', slug: 'cloakroom', file: '113-amenity-services-cloakroom.json' },
    { kind: 'feature', slug: 'dj_sets', file: '107-feature-dj_sets.json' },
    { kind: 'feature', slug: 'karaoke', file: '108-feature-karaoke.json' }
] as const;

const NIGHT_FEATURES = NIGHT_FIXTURES.filter((item) => item.kind === 'feature');

/** The vertical this whole ticket is scoped to. */
const VENUE = 'venue';

/** The locales every user-facing string must exist in. */
const LOCALES = ['es', 'en', 'pt'] as const;

interface CatalogFixture {
    readonly slug?: string;
    readonly applicableVerticals?: readonly string[];
    readonly lifecycleState?: string;
    readonly icon?: string;
    readonly category?: string;
}

const fixturePath = (kind: CatalogKind, file: string): string =>
    join(SEED_SRC_DIR, 'data', kind, file);

const readFixture = (kind: CatalogKind, file: string): CatalogFixture =>
    JSON.parse(readFileSync(fixturePath(kind, file), 'utf-8'));

const namesKey = (kind: CatalogKind): 'amenityNames' | 'featureNames' =>
    kind === 'amenity' ? 'amenityNames' : 'featureNames';

const readNames = (locale: string, kind: CatalogKind): Record<string, string> => {
    const raw = JSON.parse(
        readFileSync(join(I18N_LOCALES_DIR, locale, 'accommodations.json'), 'utf-8')
    ) as Record<string, Record<string, string> | undefined>;
    return raw[namesKey(kind)] ?? {};
};

/**
 * The `WEB_ICON_MAP` object body, read as text.
 *
 * Reading the source as text (instead of importing it) keeps this unit test
 * free of the web app's React/component graph. The body is sliced out so an
 * import at the top of the file cannot satisfy the check by itself — an icon
 * that is imported but never mapped resolves to `undefined` at runtime.
 */
const WEB_ICON_MAP_BODY = (() => {
    const source = readFileSync(join(REPO_ROOT, 'apps/web/src/lib/icon-map.ts'), 'utf-8');
    const start = source.indexOf('export const WEB_ICON_MAP');
    const end = source.indexOf('\n};', start);
    if (start === -1 || end === -1) {
        throw new Error('Could not locate the WEB_ICON_MAP object in apps/web/src/lib/icon-map.ts');
    }
    return source.slice(start, end);
})();

const hasWebIconKey = (icon: string): boolean =>
    new RegExp(`^\\s{4}${icon},?\\s*$`, 'm').test(WEB_ICON_MAP_BODY);

/** Every slug declared by the fixtures of one catalog. */
const readCatalogSlugs = (kind: CatalogKind): Set<string> =>
    new Set(
        readdirSync(join(SEED_SRC_DIR, 'data', kind))
            .filter((fileName) => fileName.endsWith('.json'))
            .map(
                (fileName) =>
                    (
                        JSON.parse(
                            readFileSync(join(SEED_SRC_DIR, 'data', kind, fileName), 'utf-8')
                        ) as {
                            slug: string;
                        }
                    ).slug
            )
    );

describe('night-life catalog items are catalog rows (HOS-1867)', () => {
    it.each(NIGHT_FIXTURES)('$slug: the fixture file declares that exact slug', ({
        kind,
        slug,
        file
    }) => {
        expect(readFixture(kind, file).slug).toBe(slug);
    });

    it.each(NIGHT_FIXTURES)('$slug: applies to the venue vertical and nothing else', ({
        kind,
        file
    }) => {
        // `toEqual`, not `toContain`: an item silently offered on
        // accommodations or experiences is the same defect in the other
        // direction.
        expect(readFixture(kind, file).applicableVerticals).toEqual([VENUE]);
    });

    it.each(NIGHT_FEATURES)('$slug: is ACTIVE, so the owner can actually tick it', ({ file }) => {
        expect(readFixture('feature', file).lifecycleState).toBe('ACTIVE');
    });

    it.each(NIGHT_FEATURES)('$slug: is filed under the ACTIVITIES category (HOS-2058)', ({
        file
    }) => {
        // HOS-2058 left these two out of its backfill on purpose; the epic
        // assigns them, and `0135` carries the same value to live databases.
        expect(readFixture('feature', file).category).toBe('ACTIVITIES');
    });

    it.each(NIGHT_FIXTURES)('$slug: is listed in its required manifest', ({ kind, file }) => {
        // A fixture absent from the manifest is never read by the seeder: the
        // file exists, the row does not.
        const manifestFiles =
            kind === 'amenity' ? requiredManifest.amenities : requiredManifest.features;
        expect(manifestFiles).toContain(file);
    });

    it.each(NIGHT_FIXTURES)('$slug: has a real label in es, en and pt', ({ kind, slug }) => {
        for (const locale of LOCALES) {
            const label = readNames(locale, kind)[slug];
            expect(label, `${locale} label for ${slug}`).toBeTruthy();
            // The slug rendered raw is what the UI falls back to when the key
            // is missing, so a label equal to the slug is an absent translation
            // wearing a present one's clothes.
            expect(label).not.toBe(slug);
        }
    });

    it.each(NIGHT_FIXTURES)('$slug: ships an icon the web app can actually resolve', ({
        kind,
        file
    }) => {
        const icon = readFixture(kind, file).icon;
        expect(icon, `${file} icon`).toBeTruthy();
        // An icon absent from the web map resolves to `undefined`: the item
        // renders without a glyph and nothing fails.
        expect(
            hasWebIconKey(icon as string),
            `${icon} is not a key of WEB_ICON_MAP in apps/web/src/lib/icon-map.ts`
        ).toBe(true);
    });

    it('the five rows ship in the 0135 data-migration counterpart', () => {
        // Not a substitute for `check-seed-dual-write.sh` (which diffs the PR),
        // just a local reminder that these five rows are the ones a live
        // environment needs delivered, and that the migration names them.
        const migration = readFileSync(
            join(SEED_SRC_DIR, 'data-migrations/0135-hos1867-night-catalog-items.ts'),
            'utf-8'
        );
        for (const { file } of NIGHT_FIXTURES) {
            expect(migration).toContain(file);
        }
    });

    it('no new slug collides with a slug already used by the other catalog', () => {
        const amenitySlugs = readCatalogSlugs('amenity');
        const featureSlugs = readCatalogSlugs('feature');

        for (const { kind, slug } of NIGHT_FIXTURES) {
            const otherCatalog = kind === 'amenity' ? featureSlugs : amenitySlugs;
            expect(
                otherCatalog.has(slug),
                `${slug} is also used by the ${kind === 'amenity' ? 'feature' : 'amenity'} catalog`
            ).toBe(false);
        }
    });
});
