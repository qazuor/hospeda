/**
 * @fileoverview
 * Data migration: 0192-hos-2614-spanish-plan-names
 *
 * Owner decision (2026-11-25, HOS-2614): every plan name is Spanish and follows
 * the "vertical + level" pattern. Only `plan.name` changes. Slugs, roles and
 * ids are untouched.
 *
 * ## Dual-write
 *
 * The code catalog (`scripts/production-catalog/catalog.ts`) carries the new
 * names. Migration 0144 stays immutable and still writes the old ones, so this
 * migration is what brings every database (fresh and live) to the new names;
 * hence `contentOnly`, so a baseline stamp never marks it applied unrun.
 *
 * ## Idempotency
 *
 * Each row is matched by `(vertical, slug)` AND by its exact old name. A row an
 * admin already renamed by hand is left alone, and a second run matches zero
 * rows. `destructive: false`: reverting is the same UPDATE with the pair
 * swapped.
 */
import { sql } from '@repo/db';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0192-hos-2614-spanish-plan-names',
    group: 'required',
    destructive: false,
    contentOnly: true,
    requiresColumns: [
        { table: 'plan', column: 'name' },
        { table: 'plan', column: 'slug' },
        { table: 'plan', column: 'vertical' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/** One rename, keyed by the stable `(vertical, slug)` pair. */
interface PlanRename {
    readonly vertical: string;
    readonly slug: string;
    readonly from: string;
    readonly to: string;
}

/** The decided old to new names (HOS-2614). */
export const PLAN_RENAMES: readonly PlanRename[] = [
    { vertical: 'accommodation', slug: 'owner-basico', from: 'Basic', to: 'Alojamiento Básico' },
    {
        vertical: 'accommodation',
        slug: 'owner-pro',
        from: 'Professional',
        to: 'Alojamiento Profesional'
    },
    {
        vertical: 'accommodation',
        slug: 'owner-premium',
        from: 'Premium',
        to: 'Alojamiento Premium'
    },
    { vertical: 'tourist', slug: 'tourist-vip', from: 'VIP', to: 'Turista VIP' },
    { vertical: 'partner', slug: 'partner-silver', from: 'Partner Silver', to: 'Partner Plata' },
    { vertical: 'partner', slug: 'partner-gold', from: 'Partner Gold', to: 'Partner Oro' },
    {
        vertical: 'accommodation',
        slug: 'trial',
        from: 'Accommodation Trial',
        to: 'Alojamiento Prueba'
    },
    {
        vertical: 'accommodation',
        slug: 'pre-trial',
        from: 'Accommodation Pre Trial',
        to: 'Alojamiento Antes de la prueba'
    },
    {
        vertical: 'accommodation',
        slug: 'floor',
        from: 'Accommodation Floor',
        to: 'Alojamiento Gratis'
    },
    { vertical: 'venue', slug: 'trial', from: 'Comer y salir Trial', to: 'Comer y salir Prueba' },
    {
        vertical: 'venue',
        slug: 'pre-trial',
        from: 'Comer y salir Pre Trial',
        to: 'Comer y salir Antes de la prueba'
    },
    { vertical: 'venue', slug: 'floor', from: 'Comer y salir Floor', to: 'Comer y salir Gratis' },
    { vertical: 'experience', slug: 'trial', from: 'Experience Trial', to: 'Experiencias Prueba' },
    {
        vertical: 'experience',
        slug: 'pre-trial',
        from: 'Experience Pre Trial',
        to: 'Experiencias Antes de la prueba'
    },
    { vertical: 'experience', slug: 'floor', from: 'Experience Floor', to: 'Experiencias Gratis' },
    { vertical: 'tourist', slug: 'trial', from: 'Tourist Trial', to: 'Turista Prueba' },
    {
        vertical: 'tourist',
        slug: 'pre-trial',
        from: 'Tourist Pre Trial',
        to: 'Turista Antes de la prueba'
    },
    { vertical: 'tourist', slug: 'floor', from: 'Turista Free', to: 'Turista Gratis' },
    { vertical: 'partner', slug: 'trial', from: 'Partner Trial', to: 'Partner Prueba' },
    {
        vertical: 'partner',
        slug: 'pre-trial',
        from: 'Partner Pre Trial',
        to: 'Partner Antes de la prueba'
    },
    { vertical: 'partner', slug: 'floor', from: 'Partner Floor', to: 'Partner Gratis' }
];

/** Renames each plan still carrying its 0144 name. */
export async function up({ db }: SeedMigrationCtx): Promise<SeedMigrationResult> {
    let renamed = 0;
    for (const rename of PLAN_RENAMES) {
        const result = await db.execute(sql`
            update plan
            set name = ${rename.to}
            where vertical = ${rename.vertical}
              and slug = ${rename.slug}
              and name = ${rename.from}
        `);
        renamed += Number((result as unknown as { rowCount?: number }).rowCount ?? 0);
    }
    return {
        summary: `HOS-2614: renamed ${renamed} of ${PLAN_RENAMES.length} plans to Spanish names.`,
        counts: { renamed, expected: PLAN_RENAMES.length }
    };
}
