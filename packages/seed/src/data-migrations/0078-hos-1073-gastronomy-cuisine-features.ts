/**
 * @fileoverview
 * Data migration: 0078-hos-1073-gastronomy-cuisine-features
 *
 * Dual-write counterpart (HOS-25) for HOS-1073. `gastronomies` had no way to
 * say WHAT a place cooks — `type` is the venue's CATEGORY (`RESTAURANT`,
 * `PARRILLA`, `CAFE`, ... a closed 9-value enum), not its cuisine style. A
 * parrilla can serve river fish or Italian-leaning dishes; the category alone
 * never says.
 *
 * The measured decision (see HOS-1073, mirroring HOS-1054 and HOS-1055's
 * verdict for this same epic): cuisine style admits several values at once
 * (a place can be "argentine" AND "river cuisine") and the list grows over
 * time, so it has the shape of catalog rows with an M:N relation — exactly
 * `features` + `r_gastronomy_feature`, which HOS-1072 already wired end to
 * end (model, API exposure, public-page rendering). No new table, column, or
 * enum: eight new `feature` rows scoped to `applicableVerticals: ["gastronomy"]`
 * are the entire change.
 *
 * The baseline gains these eight rows under `src/data/feature/` so a fresh DB
 * gets them from `required/features.seed.ts`. An already-seeded staging/prod
 * DB never re-runs that seeder, so this migration applies the same delta
 * there.
 *
 * ## Idempotency
 *
 * Each row is created only when no `features` row with the same `slug`
 * exists (`features.slug` is UNIQUE). Re-running is a no-op that reports
 * `skipped`.
 *
 * Row content is read from the very fixture files the baseline seeder reads
 * (via `loadJsonFiles`), so the two paths cannot drift: editing the JSON
 * edits both. The normalization mirrors `features.seed.ts` — drop `$schema`,
 * `id` and `lifecycleState` (server-managed), keep `slug`.
 *
 * ## `destructive` flag decision
 *
 * `false` — the migration only ever INSERTs a row that is missing. Nothing
 * is deleted, and no existing row is rewritten.
 */
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0078-hos-1073-gastronomy-cuisine-features',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The fixture files this migration inserts. A FIXED list, not
 * `requiredManifest.features`: a later PR that adds another cuisine (or any
 * other catalog row) ships its own migration rather than being swept into
 * this one (same precedent as `0012-hos-139-poi-categories.ts` and
 * `0076-hos-1054-allergen-features.ts`).
 */
const CUISINE_FEATURE_FIXTURE_FILES = [
    '099-feature-argentine_cuisine.json',
    '100-feature-river_cuisine.json',
    '101-feature-italian_cuisine.json',
    '102-feature-peruvian_cuisine.json',
    '103-feature-international_cuisine.json',
    '104-feature-asian_cuisine.json',
    '105-feature-mediterranean_cuisine.json',
    '106-feature-fusion_cuisine.json'
] as const;

/** Shape of a feature fixture file, as read off disk. */
interface FeatureFixture {
    readonly $schema?: string;
    readonly id?: string;
    readonly lifecycleState?: string;
    readonly slug: string;
    readonly [key: string]: unknown;
}

/**
 * Insert the eight cuisine-type catalog rows if they are not already
 * present.
 *
 * @param ctx - Migration context (db handle, models, helpers).
 * @returns Summary plus created/skipped counts.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const featureModel = new ctx.models.FeatureModel();

    const fixtures = await loadJsonFiles<FeatureFixture>('src/data/feature', [
        ...CUISINE_FEATURE_FIXTURE_FILES
    ]);

    let created = 0;
    let skipped = 0;

    for (const fixture of fixtures) {
        const existing = await featureModel.findOne({ slug: fixture.slug }, ctx.db);
        if (existing) {
            skipped += 1;
            continue;
        }

        // Same field exclusions as `required/features.seed.ts`: `$schema` is a
        // JSON-schema pointer, `id` is the fixture's filename-derived key (NOT
        // the DB uuid), and `lifecycleState` is server-managed.
        const { $schema: _schema, id: _id, lifecycleState: _lifecycleState, ...row } = fixture;

        await featureModel.create(row, ctx.db);
        created += 1;
    }

    return {
        summary: `HOS-1073 gastronomy cuisine features: ${created} created, ${skipped} already present`,
        counts: { featuresCreated: created, featuresSkipped: skipped }
    };
}
