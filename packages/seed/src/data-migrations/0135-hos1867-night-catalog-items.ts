/**
 * @fileoverview
 * Data migration: 0135-hos1867-night-catalog-items
 *
 * ## Why
 *
 * The night-life vertical needs catalog rows it did not have: a dance floor, a
 * VIP area and a cloakroom as amenities, plus DJ sets and karaoke as features.
 * `live_music`, `happy_hour` and `bar_service` already existed; this migration
 * only delivers the five new rows (DEC-FAC-066, HOS-1867). The baseline gains
 * the same five fixtures under `src/data/{amenity,feature}/` so a fresh
 * database gets them from the required seeders, and this migration applies the
 * identical delta to an environment that was seeded before they existed.
 *
 * ## Idempotency
 *
 * Each row is created only when no row with the same `slug` is usable.
 * `amenities.slug` and `features.slug` are both UNIQUE, and `findOne` does NOT
 * filter soft-deleted rows, so an existing row is only treated as present when
 * it is alive AND already carries every vertical the fixture declares.
 *
 * A row that exists but does not satisfy that — soft-deleted, or alive without
 * one of the fixture's verticals — makes this migration THROW naming the slug
 * and the reason. Skipping it silently would leave the catalog item missing
 * while the ledger records the migration as applied forever; failing rolls the
 * transaction back and leaves the migration pending for a human to resolve.
 *
 * Row content is read from the same fixture files the baseline seeders read
 * (via `loadJsonFiles`), so the two paths cannot drift. The normalization
 * mirrors `required/amenities.seed.ts` and `required/features.seed.ts`:
 * amenities drop `$schema`, `id` and `name`; features additionally drop
 * `lifecycleState` (server-managed).
 *
 * ## `destructive` flag decision
 *
 * `false` — the migration only ever INSERTs a row that is missing. Nothing is
 * deleted, and no existing row is rewritten.
 */
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0135-hos1867-night-catalog-items',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The amenity fixtures this migration inserts. A FIXED list, not
 * `requiredManifest.amenities`: a later ticket that adds another catalog row
 * ships its own migration rather than being swept into this one (same
 * precedent as `0078-hos-1073-gastronomy-cuisine-features.ts`).
 */
const NIGHT_AMENITY_FIXTURE_FILES = [
    '111-amenity-entertainment-dance-floor.json',
    '112-amenity-services-vip-area.json',
    '113-amenity-services-cloakroom.json'
] as const;

/** The feature fixtures this migration inserts. Also a fixed list. */
const NIGHT_FEATURE_FIXTURE_FILES = [
    '107-feature-dj_sets.json',
    '108-feature-karaoke.json'
] as const;

/** Shape of an amenity fixture file, as read off disk. */
interface AmenityFixture {
    readonly $schema?: string;
    readonly id?: string;
    readonly name?: unknown;
    readonly slug: string;
    readonly [key: string]: unknown;
}

/** Shape of a feature fixture file, as read off disk. */
interface FeatureFixture {
    readonly $schema?: string;
    readonly id?: string;
    readonly name?: unknown;
    readonly lifecycleState?: string;
    readonly slug: string;
    readonly [key: string]: unknown;
}

/** The subset of a stored row this migration needs to classify it. */
interface ExistingCatalogRow {
    readonly deletedAt?: Date | string | null;
    readonly applicableVerticals?: readonly string[];
}

/**
 * Explains why an existing row cannot satisfy the fixture, or returns `null`
 * when it can (alive and already carrying every fixture vertical).
 *
 * The comparison is against the fixture's own verticals, never a hard-coded
 * vertical literal, so the fixture remains the single source of truth.
 */
function describeConflict(
    kind: 'amenity' | 'feature',
    slug: string,
    fixtureVerticals: readonly string[],
    existing: ExistingCatalogRow
): string | null {
    if (existing.deletedAt) {
        return `${kind} '${slug}' already exists but is soft-deleted; refusing to skip it`;
    }

    const storedVerticals = existing.applicableVerticals ?? [];
    const missing = fixtureVerticals.filter((vertical) => !storedVerticals.includes(vertical));
    if (missing.length > 0) {
        return `${kind} '${slug}' already exists without the fixture vertical(s): ${missing.join(', ')}`;
    }

    return null;
}

/**
 * Insert the five night-life catalog rows if they are not already present.
 *
 * @param ctx - Migration context (db handle, models, helpers).
 * @returns Summary plus created/skipped counts.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const amenityModel = new ctx.models.AmenityModel();
    const featureModel = new ctx.models.FeatureModel();

    const amenityFixtures = await loadJsonFiles<AmenityFixture>('src/data/amenity', [
        ...NIGHT_AMENITY_FIXTURE_FILES
    ]);
    const featureFixtures = await loadJsonFiles<FeatureFixture>('src/data/feature', [
        ...NIGHT_FEATURE_FIXTURE_FILES
    ]);

    let amenitiesCreated = 0;
    let amenitiesSkipped = 0;
    let featuresCreated = 0;
    let featuresSkipped = 0;

    for (const fixture of amenityFixtures) {
        const existing = (await amenityModel.findOne(
            { slug: fixture.slug },
            ctx.db
        )) as ExistingCatalogRow | null;

        if (existing) {
            const conflict = describeConflict(
                'amenity',
                fixture.slug,
                (fixture.applicableVerticals as readonly string[] | undefined) ?? [],
                existing
            );
            if (conflict) {
                throw new Error(`HOS-1867 ${conflict}`);
            }
            amenitiesSkipped += 1;
            continue;
        }

        // Same field exclusions as `required/amenities.seed.ts`: `$schema` is a
        // JSON-schema pointer, `id` is the fixture's filename-derived key (NOT
        // the DB uuid), and `name` no longer exists in the catalog schema.
        const { $schema: _schema, id: _id, name: _name, ...row } = fixture;
        await amenityModel.create(row, ctx.db);
        amenitiesCreated += 1;
    }

    for (const fixture of featureFixtures) {
        const existing = (await featureModel.findOne(
            { slug: fixture.slug },
            ctx.db
        )) as ExistingCatalogRow | null;

        if (existing) {
            const conflict = describeConflict(
                'feature',
                fixture.slug,
                (fixture.applicableVerticals as readonly string[] | undefined) ?? [],
                existing
            );
            if (conflict) {
                throw new Error(`HOS-1867 ${conflict}`);
            }
            featuresSkipped += 1;
            continue;
        }

        // Same field exclusions as `required/features.seed.ts`: drop `$schema`,
        // `id`, `name` and the server-managed `lifecycleState`.
        const {
            $schema: _schema,
            id: _id,
            name: _name,
            lifecycleState: _lifecycleState,
            ...row
        } = fixture;
        await featureModel.create(row, ctx.db);
        featuresCreated += 1;
    }

    return {
        summary: `HOS-1867 night catalog items: ${amenitiesCreated} amenities created, ${amenitiesSkipped} skipped; ${featuresCreated} features created, ${featuresSkipped} skipped`,
        counts: {
            amenitiesCreated,
            amenitiesSkipped,
            featuresCreated,
            featuresSkipped
        }
    };
}
