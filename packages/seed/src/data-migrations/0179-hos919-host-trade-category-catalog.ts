/**
 * @fileoverview
 * Data migration: 0179-hos919-host-trade-category-catalog
 *
 * Dual-write counterpart (HOS-25) of the HOS-919 baseline seed. The structural
 * migration `0229_hos919_provider_trade_categories.sql` creates the catalog
 * tables and the join; the baseline (`required/hostTradeCategories.seed.ts`
 * plus `src/data/hostTradeCategory*`) fills them on a FRESH database. This
 * migration brings an already-seeded staging/production database to the same
 * end state. It is ONE migration with three ordered steps (spec 5.4):
 *
 * 1. **Catalog upsert.** Inserts the 5 groups, then the 29 categories, by
 *    slug. Rows are built by the same normalizers the baseline seeder uses, so
 *    a category gets the same slug-derived deterministic id either way. An
 *    existing slug (even one an admin renamed, deactivated or soft-deleted) is
 *    never touched: `ON CONFLICT (slug) DO NOTHING`.
 * 2. **Legacy backfill.** Reads the legacy single-category columns
 *    (`host_trades.category`, `alliance_leads.category`) and writes the new
 *    shape: one `r_host_trade_category` row per mapped slug, and
 *    `alliance_leads.category_slugs` for leads not yet converted. The map is
 *    spec 5.5 ({@link LEGACY_CATEGORY_TO_SLUGS}). An unknown legacy value is
 *    logged and skipped; it never aborts the run.
 * 3. **Permission grants.** The five `hostTradeCategory.*` permissions go to
 *    `SUPER_ADMIN` and `ADMIN` (see {@link GRANTS}), mirroring who holds
 *    `HOST_TRADE_*` write permissions today.
 *
 * ## Why `requiresColumns`
 *
 * Step 2 READS columns the contract release (N+1) drops. The runner applies the
 * whole pending schema batch before any data-migration, so shipping the drop in
 * the same release would let this migration read nothing, move zero rows and be
 * ledgered applied forever (HOS-433). Declaring the columns makes the runner
 * refuse instead (it only refuses when the table still holds rows, so a fresh
 * database is unaffected).
 *
 * The legacy columns are read with raw SQL on purpose: once the Drizzle schema
 * stops describing them (N+1) this file must still compile.
 *
 * ## Idempotency
 *
 * Every write is `ON CONFLICT DO NOTHING` or guarded by "not yet converted", so
 * a second run changes nothing. `destructive: false`: nothing is deleted or
 * overwritten.
 */
import {
    allianceLeads,
    eq,
    hostTradeCategories,
    hostTradeCategoryGroups,
    type InsertHostTradeCategory,
    type InsertHostTradeCategoryGroup,
    rHostTradeCategory,
    rolePermission,
    sql
} from '@repo/db';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import requiredManifest from '../manifest-required.json';
import {
    normalizeHostTradeCategoryGroupSeedItem,
    normalizeHostTradeCategorySeedItem
} from '../required/hostTradeCategories.seed.js';
import { loadJsonFiles } from '../utils/loadJsonFile.js';
import { logger } from '../utils/logger.js';
import type { SeedMigrationCtx, SeedMigrationModule, SeedMigrationResult } from './types.js';

export const meta = {
    name: '0179-hos919-host-trade-category-catalog',
    group: 'required',
    destructive: false,
    requiresColumns: [
        { table: 'host_trades', column: 'category' },
        { table: 'alliance_leads', column: 'category' }
    ]
} as const satisfies SeedMigrationModule['meta'];

/**
 * Old `HostTradeCategoryEnum` value to the catalog slug(s) it becomes (spec
 * 5.5). `GAS` maps to installation only; `PILETA_JARDIN` splits in two.
 *
 * Exported so the test can pin it against the legacy enum and the baseline.
 */
export const LEGACY_CATEGORY_TO_SLUGS: Readonly<Record<string, readonly string[]>> = {
    CERRAJERIA: ['cerrajeria'],
    PLOMERIA: ['plomeria'],
    ELECTRICIDAD: ['electricidad'],
    GAS: ['gas-instalacion'],
    CLIMATIZACION: ['climatizacion'],
    LIMPIEZA: ['limpieza-domicilio'],
    FLETES: ['fletes'],
    VIDRIERIA: ['vidrieria'],
    CARPINTERIA: ['carpinteria'],
    PILETA_JARDIN: ['piletas', 'parque-jardineria'],
    PLAGAS: ['control-plagas'],
    INTERNET: ['internet-tv'],
    ALBANILERIA: ['albanileria']
};

/** The five catalog permissions granted to the admin roles. */
const CATEGORY_PERMISSIONS: readonly PermissionEnum[] = [
    PermissionEnum.HOST_TRADE_CATEGORY_VIEW,
    PermissionEnum.HOST_TRADE_CATEGORY_CREATE,
    PermissionEnum.HOST_TRADE_CATEGORY_UPDATE,
    PermissionEnum.HOST_TRADE_CATEGORY_DELETE,
    PermissionEnum.HOST_TRADE_CATEGORY_RESTORE
];

/**
 * `(role, permission)` pairs this migration ensures exist. Exported so the test
 * can compare it with `ROLE_PERMISSIONS` (the baseline) in both directions.
 */
export const GRANTS: ReadonlyArray<{ role: RoleEnum; permission: PermissionEnum }> = [
    ...CATEGORY_PERMISSIONS.map((permission) => ({ role: RoleEnum.SUPER_ADMIN, permission })),
    ...CATEGORY_PERMISSIONS.map((permission) => ({ role: RoleEnum.ADMIN, permission }))
];

/** Row shape of the legacy reads. */
interface LegacyRow {
    readonly id: string;
    readonly category: string;
}

/** Step 1: inserts missing groups and categories. Returns the created counts. */
async function upsertCatalog(
    ctx: SeedMigrationCtx
): Promise<{ groupsCreated: number; categoriesCreated: number }> {
    const groupFixtures = await loadJsonFiles<Record<string, unknown>>('hostTradeCategoryGroup', [
        ...requiredManifest.hostTradeCategoryGroups
    ]);
    const categoryFixtures = await loadJsonFiles<Record<string, unknown>>('hostTradeCategory', [
        ...requiredManifest.hostTradeCategories
    ]);

    let groupsCreated = 0;
    for (const fixture of groupFixtures) {
        const inserted = await ctx.db
            .insert(hostTradeCategoryGroups)
            .values(
                normalizeHostTradeCategoryGroupSeedItem(fixture) as InsertHostTradeCategoryGroup
            )
            .onConflictDoNothing({ target: hostTradeCategoryGroups.slug })
            .returning({ id: hostTradeCategoryGroups.id });
        groupsCreated += inserted.length;
    }

    let categoriesCreated = 0;
    for (const fixture of categoryFixtures) {
        const inserted = await ctx.db
            .insert(hostTradeCategories)
            .values(normalizeHostTradeCategorySeedItem(fixture) as InsertHostTradeCategory)
            .onConflictDoNothing({ target: hostTradeCategories.slug })
            .returning({ id: hostTradeCategories.id });
        categoriesCreated += inserted.length;
    }

    return { groupsCreated, categoriesCreated };
}

/** Resolves slug -> real category id from the table (never assumes the derived id). */
async function loadCategoryIdBySlug(ctx: SeedMigrationCtx): Promise<Map<string, string>> {
    const rows = await ctx.db
        .select({ id: hostTradeCategories.id, slug: hostTradeCategories.slug })
        .from(hostTradeCategories);
    return new Map(rows.map((row) => [row.slug, row.id]));
}

/** Step 2a: one join row per mapped slug of every provider with a legacy category. */
async function backfillTradeLinks(
    ctx: SeedMigrationCtx,
    categoryIdBySlug: ReadonlyMap<string, string>
): Promise<{ tradeLinksCreated: number; unknownLegacyValues: number }> {
    const result = await ctx.db.execute(
        sql`SELECT id, category::text AS category FROM host_trades WHERE category IS NOT NULL`
    );

    let tradeLinksCreated = 0;
    let unknownLegacyValues = 0;
    for (const row of result.rows as unknown as LegacyRow[]) {
        const slugs = LEGACY_CATEGORY_TO_SLUGS[row.category];
        if (!slugs) {
            unknownLegacyValues += 1;
            logger.warn(
                `[0179] host_trades ${row.id}: unknown legacy category "${row.category}", skipped`
            );
            continue;
        }
        const links = slugs.flatMap((slug) => {
            const categoryId = categoryIdBySlug.get(slug);
            return categoryId ? [{ hostTradeId: row.id, categoryId }] : [];
        });
        if (links.length === 0) continue;
        const inserted = await ctx.db
            .insert(rHostTradeCategory)
            .values(links)
            .onConflictDoNothing()
            .returning({ categoryId: rHostTradeCategory.categoryId });
        tradeLinksCreated += inserted.length;
    }
    return { tradeLinksCreated, unknownLegacyValues };
}

/** Step 2b: converts leads that still only carry the legacy category. */
async function backfillLeadSlugs(
    ctx: SeedMigrationCtx
): Promise<{ leadsConverted: number; unknownLegacyValues: number }> {
    const result = await ctx.db.execute(
        sql`SELECT id, category FROM alliance_leads
            WHERE category IS NOT NULL
              AND (category_slugs IS NULL OR cardinality(category_slugs) = 0)`
    );

    let leadsConverted = 0;
    let unknownLegacyValues = 0;
    for (const row of result.rows as unknown as LegacyRow[]) {
        const slugs = LEGACY_CATEGORY_TO_SLUGS[row.category];
        if (!slugs) {
            unknownLegacyValues += 1;
            logger.warn(
                `[0179] alliance_leads ${row.id}: unknown legacy category "${row.category}", skipped`
            );
            continue;
        }
        await ctx.db
            .update(allianceLeads)
            .set({ categorySlugs: [...slugs] })
            .where(eq(allianceLeads.id, row.id));
        leadsConverted += 1;
    }
    return { leadsConverted, unknownLegacyValues };
}

/** Step 3: grants the catalog permissions. Returns how many rows were new. */
async function grantPermissions(ctx: SeedMigrationCtx): Promise<number> {
    const inserted = await ctx.db
        .insert(rolePermission)
        .values([...GRANTS])
        .onConflictDoNothing()
        .returning();
    return inserted.length;
}

export async function up(ctx: SeedMigrationCtx): Promise<SeedMigrationResult> {
    const catalog = await upsertCatalog(ctx);
    const categoryIdBySlug = await loadCategoryIdBySlug(ctx);
    const trades = await backfillTradeLinks(ctx, categoryIdBySlug);
    const leads = await backfillLeadSlugs(ctx);
    const permissionsGranted = await grantPermissions(ctx);

    const unknownLegacyValues = trades.unknownLegacyValues + leads.unknownLegacyValues;

    return {
        summary: `HOS-919 provider trade categories: ${catalog.groupsCreated} groups and ${catalog.categoriesCreated} categories created, ${trades.tradeLinksCreated} provider links and ${leads.leadsConverted} leads converted (${unknownLegacyValues} unknown legacy values skipped), ${permissionsGranted} permission grants added.`,
        counts: {
            groupsCreated: catalog.groupsCreated,
            categoriesCreated: catalog.categoriesCreated,
            tradeLinksCreated: trades.tradeLinksCreated,
            leadsConverted: leads.leadsConverted,
            unknownLegacyValues,
            permissionsGranted
        }
    };
}
