/**
 * @fileoverview
 * Data migration: 0076-hos-1054-allergen-features
 *
 * Dual-write counterpart (HOS-25) for HOS-1054. The baseline gains two new
 * gastronomy catalog rows under `src/data/feature/` —
 * `lactose_free_options` and `nut_free_options` — so a fresh DB gets them from
 * `required/features.seed.ts`. An already-seeded staging/prod DB never re-runs
 * that seeder, so this migration applies the same two rows there.
 *
 * Why only two rows: the three other aptos HOS-1054 names —
 * `gluten_free_options` (sin TACC), `vegan_options` and `vegetarian_options` —
 * ALREADY exist in the catalog with `applicableVerticals: ["gastronomy"]`, and
 * have since the commerce catalog expansion. HOS-1054 needed no new model for
 * them; what was missing was the pair below, plus the search filter (which is
 * code, not data).
 *
 * ## Idempotency
 *
 * Each row is created only when no `features` row with the same `slug` exists
 * (`features.slug` is UNIQUE). Re-running is a no-op that reports `skipped`.
 *
 * Row content is read from the very fixture files the baseline seeder reads
 * (via `loadJsonFiles`), so the two paths cannot drift: editing the JSON edits
 * both. The normalization mirrors `features.seed.ts` — drop `$schema`, `id` and
 * `lifecycleState` (server-managed), keep `slug`.
 *
 * ## `destructive` flag decision
 *
 * `false` — the migration only ever INSERTs a row that is missing. Nothing is
 * deleted, and no existing row is rewritten.
 */
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0076-hos-1054-allergen-features',
    group: 'required',
    destructive: false
} as const satisfies SeedMigrationModule['meta'];

/**
 * The fixture files this migration inserts. A FIXED list, not
 * `requiredManifest.features`: a later PR that adds another catalog row ships
 * its own migration rather than being swept into this one (same precedent as
 * `0012-hos-139-poi-categories.ts`).
 */
const ALLERGEN_FEATURE_FIXTURE_FILES = [
    '097-feature-lactose_free_options.json',
    '098-feature-nut_free_options.json'
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
 * Insert the two allergen/apto catalog rows if they are not already present.
 *
 * @param ctx - Migration context (db handle, models, helpers).
 * @returns Summary plus created/skipped counts.
 */
export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const featureModel = new ctx.models.FeatureModel();

    const fixtures = await loadJsonFiles<FeatureFixture>('src/data/feature', [
        ...ALLERGEN_FEATURE_FIXTURE_FILES
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
        summary: `HOS-1054 allergen features: ${created} created, ${skipped} already present`,
        counts: { featuresCreated: created, featuresSkipped: skipped }
    };
}
