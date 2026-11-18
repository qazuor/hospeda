/**
 * @fileoverview
 * Data migration: 0182-hos2336-partner-types-catalog
 *
 * Dual-write counterpart (HOS-25) of the HOS-2336 baseline seed. The structural
 * migration `0231_hos2336_partner_types_catalog.sql` creates `partner_types`
 * and the nullable `partners.type_id`; the baseline
 * (`required/partnerTypes.seed.ts` plus `src/data/partnerType/*`) fills the
 * catalog on a FRESH database, and the example partner fixtures now name their
 * type by slug. This migration brings an already-seeded staging/production
 * database to the same end state. It is ONE migration with three ordered steps
 * (spec 5.3, step 2):
 *
 * 1. **Catalog upsert.** Inserts the 5 types (Comercio, ONG, Institución,
 *    Medio, Persona) by slug, built by the same normalizer the baseline seeder
 *    uses, so a type gets the same slug-derived deterministic id either way.
 *    An existing slug (even one an admin renamed, deactivated or soft-deleted)
 *    is never touched: `ON CONFLICT (slug) DO NOTHING`.
 * 2. **Permission grants.** The five `partnerType.*` permissions go to
 *    `SUPER_ADMIN` and `ADMIN` (see {@link GRANTS}).
 * 3. **Backfill.** Sets `partners.type_id` from the legacy `partners.type` for
 *    every row not converted yet. The three legacy values are their own slugs
 *    (`business`, `ngo`, `institution`). An unknown legacy value is logged and
 *    skipped; it never aborts the run.
 *
 * ## Why `requiresColumns`
 *
 * Step 3 READS `partners.type`, which the contract release (N+1) drops. The
 * runner applies the whole pending schema batch before any data-migration, so
 * shipping the drop in the same release would let this migration read
 * nothing, move zero rows and be ledgered applied forever (HOS-433). Declaring
 * the column makes the runner refuse instead (it only refuses when the table
 * still holds rows, so a fresh database is unaffected).
 *
 * The legacy column is read with raw SQL on purpose: once the Drizzle schema
 * stops describing it (N+1) this file must still compile.
 *
 * ## Idempotency
 *
 * Every write is `ON CONFLICT DO NOTHING` or guarded by `type_id IS NULL`, so a
 * second run changes nothing. `destructive: false`: nothing is deleted or
 * overwritten.
 */
import { type InsertPartnerType, partnerTypes, rolePermission, sql } from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import requiredManifest from '../manifest-required.json';
import { normalizePartnerTypeSeedItem } from '../required/partnerTypes.seed.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import { logger } from '../utils/logger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0182-hos2336-partner-types-catalog',
    group: 'required',
    destructive: false,
    requiresColumns: [{ table: 'partners', column: 'type' }]
} as const satisfies SeedMigrationModule['meta'];

/** The five catalog permissions granted to the admin roles. */
const PARTNER_TYPE_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.PARTNER_TYPE_VIEW,
    PermissionEnum.PARTNER_TYPE_CREATE,
    PermissionEnum.PARTNER_TYPE_UPDATE,
    PermissionEnum.PARTNER_TYPE_DELETE,
    PermissionEnum.PARTNER_TYPE_RESTORE
];

/**
 * `(role, permission)` pairs this migration ensures exist. Exported so the test
 * can compare it with `ROLE_PERMISSIONS` (the baseline) in both directions.
 */
export const GRANTS: ReadonlyArray<{ role: RoleEnum; permission: PermissionEnum }> = [
    ...PARTNER_TYPE_PERMISSIONS.map((permission) => ({ role: RoleEnum.SUPER_ADMIN, permission })),
    ...PARTNER_TYPE_PERMISSIONS.map((permission) => ({ role: RoleEnum.ADMIN, permission }))
];

/**
 * Legacy `partner_type_enum` value -> catalog slug. Identity for the three
 * values the enum ever held; exported so the test can pin it against the enum.
 */
export const LEGACY_PARTNER_TYPE_TO_SLUG: Readonly<Record<string, string>> = {
    business: 'business',
    ngo: 'ngo',
    institution: 'institution'
};

/** Row shape of the legacy read. */
interface LegacyRow {
    readonly id: string;
    readonly type: string;
}

/** Step 1: inserts missing types. Returns how many were created. */
async function upsertCatalog(ctx: SeedMigrationCtx): Promise<number> {
    const fixtures = await loadJsonFiles<Record<string, unknown>>('partnerType', [
        ...requiredManifest.partnerTypes
    ]);
    let created = 0;
    for (const fixture of fixtures) {
        const inserted = await ctx.db
            .insert(partnerTypes)
            .values(normalizePartnerTypeSeedItem(fixture) as InsertPartnerType)
            .onConflictDoNothing({ target: partnerTypes.slug })
            .returning({ id: partnerTypes.id });
        created += inserted.length;
    }
    return created;
}

/** Step 2: grants the catalog permissions. Returns how many rows were new. */
async function grantPermissions(ctx: SeedMigrationCtx): Promise<number> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values([...GRANTS])
        .onConflictDoNothing()
        .returning();
    return inserted.length;
}

/** Step 3: sets `type_id` on every partner that only carries the legacy type. */
async function backfillPartnerTypeIds(
    ctx: SeedMigrationCtx
): Promise<{ partnersConverted: number; unknownLegacyValues: number }> {
    const types = await ctx.db
        .select({ id: partnerTypes.id, slug: partnerTypes.slug })
        .from(partnerTypes);
    // Resolved from the table, never assumed from the derived id: an existing
    // row keeps whatever id it was created with.
    const typeIdBySlug = new Map(types.map((row) => [row.slug, row.id]));

    const result = await ctx.db.execute(
        sql`SELECT id, type::text AS type FROM partners WHERE type_id IS NULL AND type IS NOT NULL`
    );

    let partnersConverted = 0;
    let unknownLegacyValues = 0;
    for (const row of result.rows as unknown as LegacyRow[]) {
        const slug = LEGACY_PARTNER_TYPE_TO_SLUG[row.type];
        const typeId = slug ? typeIdBySlug.get(slug) : undefined;
        if (!typeId) {
            unknownLegacyValues += 1;
            logger.warn(`[0182] partners ${row.id}: unknown legacy type "${row.type}", skipped`);
            continue;
        }
        const updated = await ctx.db.execute(
            sql`UPDATE partners SET type_id = ${typeId} WHERE id = ${row.id} AND type_id IS NULL RETURNING id`
        );
        partnersConverted += updated.rows.length;
    }
    return { partnersConverted, unknownLegacyValues };
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const typesCreated = await upsertCatalog(ctx);
    const permissionsGranted = await grantPermissions(ctx);
    const backfill = await backfillPartnerTypeIds(ctx);

    return {
        summary: `HOS-2336 partner types: ${typesCreated} types created, ${permissionsGranted} permission grants added, ${backfill.partnersConverted} partners converted (${backfill.unknownLegacyValues} unknown legacy values skipped).`,
        counts: {
            typesCreated,
            permissionsGranted,
            partnersConverted: backfill.partnersConverted,
            unknownLegacyValues: backfill.unknownLegacyValues
        }
    };
}
