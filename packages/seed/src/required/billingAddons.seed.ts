import type { AddonDefinition } from '@repo/billing';
import { ALL_ADDONS } from '@repo/billing';
import { type DrizzleClient, billingAddons, eq, getDb } from '@repo/db';
import { STATUS_ICONS } from '../utils/icons.js';
import { logger } from '../utils/logger.js';
import type { SeedContext } from '../utils/seedContext.js';
import { summaryTracker } from '../utils/summaryTracker.js';

// ---------------------------------------------------------------------------
// Internal helpers (injectable db for testability)
// ---------------------------------------------------------------------------

/**
 * Result of {@link ensureAddon} so callers know whether the row was newly
 * created or skipped (already existed by name).
 *
 * `status`:
 * - `'created'` — the row did not exist and was inserted.
 * - `'skipped'` — a row with the same `name` already exists; no insert was made.
 */
interface EnsureAddonResult {
    readonly status: 'created' | 'skipped';
}

/**
 * Ensures a `billing_addons` row exists for the given add-on definition.
 *
 * Idempotent: checks for an existing row by `name` (the addon display name,
 * which is the stable human handle for the catalog). When found, skips without
 * inserting. When absent, inserts a new row.
 *
 * Column layout written here must match exactly what
 * `addon-catalog.mapper.ts:mapRowToAddonDefinition` reads:
 * - `name`                 → `addon.name` (display name, idempotency key)
 * - `description`          → `addon.description`
 * - `active`               → `addon.isActive`
 * - `unitAmount`           → `addon.priceArs` (ARS cents)
 * - `currency`             → always `'ARS'`
 * - `billingInterval`      → `'one_time'` when `billingType === 'one_time'`, otherwise `'month'`
 * - `billingIntervalCount` → always `1`
 * - `entitlements`         → `[addon.grantsEntitlement]` (empty array when null)
 * - `limits`               → `{ [affectsLimitKey]: limitIncrease }` (empty object when null)
 * - `livemode`             → `true` in production, `false` in dev/test
 * - `metadata.slug`        → `addon.slug` (mapper reads this as primary identifier)
 * - `metadata.durationDays`→ `addon.durationDays`
 * - `metadata.targetCategories` → `addon.targetCategories`
 * - `metadata.sortOrder`   → `addon.sortOrder`
 *
 * `db` is injectable for tests; production callers omit it and the default
 * `getDb()` resolves the runtime client.
 *
 * @param addon - Add-on definition from the billing catalog
 * @param livemode - Whether to write livemode=true (production) or false (dev/test)
 * @param db - Drizzle client (injectable for tests)
 * @returns Result indicating whether the row was created or skipped
 */
async function ensureAddon(
    addon: AddonDefinition,
    livemode: boolean,
    db: DrizzleClient = getDb()
): Promise<EnsureAddonResult> {
    // Check if add-on already exists by name (idempotency key)
    const existing = await db
        .select()
        .from(billingAddons)
        .where(eq(billingAddons.name, addon.name))
        .limit(1);

    if (existing.length > 0) {
        return { status: 'skipped' };
    }

    // Build entitlements array from granted entitlement
    const entitlements: string[] = addon.grantsEntitlement ? [addon.grantsEntitlement] : [];

    // Build limits object from affected limit key
    const limits: Record<string, number> =
        addon.affectsLimitKey && addon.limitIncrease !== null
            ? { [addon.affectsLimitKey]: addon.limitIncrease }
            : {};

    await db.insert(billingAddons).values({
        name: addon.name,
        description: addon.description,
        active: addon.isActive,
        unitAmount: addon.priceArs,
        currency: 'ARS',
        billingInterval: addon.billingType === 'one_time' ? 'one_time' : 'month',
        billingIntervalCount: 1,
        entitlements,
        limits,
        livemode,
        metadata: {
            slug: addon.slug,
            durationDays: addon.durationDays,
            targetCategories: addon.targetCategories,
            sortOrder: addon.sortOrder
        }
    });

    return { status: 'created' };
}

// ---------------------------------------------------------------------------
// Public seed function
// ---------------------------------------------------------------------------

/**
 * Seed billing add-ons from configuration
 *
 * Populates the billing_addons table with all add-on definitions including:
 * - One-time add-ons (Visibility boost 7d, 30d)
 * - Recurring add-ons (Extra photos, accommodations, properties)
 *
 * This seed:
 * - Creates add-on records with pricing and metadata
 * - Stores entitlement/limit configurations in metadata
 * - Is idempotent (skips existing add-ons by name)
 * - Tracks seeding progress and errors
 *
 * Dependencies:
 * - billingEntitlements must be seeded first (if add-on grants entitlement)
 * - billingLimits must be seeded first (if add-on affects limit)
 *
 * @param context - Seed context (unused but kept for consistency)
 *
 * @example
 * ```typescript
 * await seedBillingAddons(context);
 * // Seeds 5 add-ons into billing_addons table
 * ```
 */
export async function seedBillingAddons(_context: SeedContext): Promise<void> {
    const entityName = 'Billing Add-ons';
    const separator = '─'.repeat(80);

    logger.info('');
    logger.info(`${separator}`);
    logger.info(`${STATUS_ICONS.Seed}  Seeding ${entityName}`);
    logger.info(`${separator}`);

    try {
        const isProduction = process.env.NODE_ENV === 'production';

        let seedCount = 0;
        let skipCount = 0;

        for (const addon of ALL_ADDONS) {
            try {
                const result = await ensureAddon(addon, isProduction);

                if (result.status === 'skipped') {
                    logger.info(
                        `${STATUS_ICONS.Skip}  Skipping "${addon.name}" (${addon.slug}) - already exists`
                    );
                    skipCount++;
                } else {
                    const typeLabel = addon.billingType === 'one_time' ? 'one-time' : 'recurring';
                    const priceLabel = `ARS ${(addon.priceArs / 100).toLocaleString('es-AR')}`;

                    logger.success({
                        msg: `${STATUS_ICONS.Success}  Created add-on: "${addon.name}" (${addon.slug}) - ${typeLabel}, ${priceLabel}`
                    });
                    seedCount++;
                    summaryTracker.trackSuccess(entityName);
                }
            } catch (error) {
                logger.error(
                    `${STATUS_ICONS.Error}  Failed to create add-on "${addon.name}": ${error instanceof Error ? error.message : String(error)}`
                );
                summaryTracker.trackError(
                    entityName,
                    addon.name,
                    error instanceof Error ? error.message : String(error)
                );
            }
        }

        logger.info(`${separator}`);
        logger.info(
            `${STATUS_ICONS.Info}  Summary: ${seedCount} created, ${skipCount} skipped, ${ALL_ADDONS.length} total`
        );
    } catch (error) {
        logger.error(`${STATUS_ICONS.Error}  Fatal error seeding ${entityName}`);
        logger.error(`   ${error instanceof Error ? error.message : String(error)}`);
        throw error;
    }
}

/**
 * Internals exposed for unit tests only.
 *
 * @internal
 */
export const _internals = {
    ensureAddon
};
