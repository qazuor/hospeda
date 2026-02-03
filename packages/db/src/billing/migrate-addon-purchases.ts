/**
 * Addon Purchases Data Migration Script
 *
 * Migrates addon purchase data from subscription.metadata.addonAdjustments JSON
 * to the billing_addon_purchases table.
 *
 * This script:
 * - Reads all subscriptions with addonAdjustments metadata
 * - Creates corresponding rows in billing_addon_purchases
 * - Handles duplicates gracefully (idempotent)
 * - Supports dry-run mode for safety
 *
 * @example
 * ```bash
 * # Dry run (no changes)
 * pnpm tsx src/billing/migrate-addon-purchases.ts --dry-run
 *
 * # Execute migration
 * pnpm tsx src/billing/migrate-addon-purchases.ts
 * ```
 */

import { ALL_ADDONS, type AddonDefinition } from '@repo/billing';
import { createLogger } from '@repo/logger';
import { sql } from 'drizzle-orm';
import { getDb } from '../client.ts';
import { billingAddonPurchases } from '../schemas/index.ts';
import { billingSubscriptions } from './schemas.ts';

/**
 * Logger for migration operations
 */
const logger = createLogger('db:migration:addon-purchases');

/**
 * Get addon definition by slug
 */
function getAddonBySlug(slug: string): AddonDefinition | undefined {
    return ALL_ADDONS.find((addon) => addon.slug === slug);
}

/**
 * Addon adjustment stored in subscription metadata
 */
interface AddonAdjustment {
    addonSlug: string;
    entitlement?: string;
    limitKey?: string;
    limitIncrease?: number;
    appliedAt: string;
}

/**
 * Limit adjustment for billing_addon_purchases
 */
interface LimitAdjustment {
    limitKey: string;
    increase: number;
    previousValue: number;
    newValue: number;
}

/**
 * Entitlement adjustment for billing_addon_purchases
 */
interface EntitlementAdjustment {
    entitlementKey: string;
    granted: boolean;
}

/**
 * Migration statistics
 */
interface MigrationStats {
    subscriptionsProcessed: number;
    addonsFound: number;
    addonsMigrated: number;
    addonsSkipped: number;
    errors: Array<{ subscriptionId: string; error: string }>;
}

/**
 * Migration options
 */
interface MigrationOptions {
    dryRun?: boolean;
    verbose?: boolean;
}

/**
 * Migrates addon purchases from subscription metadata to billing_addon_purchases table
 *
 * @param input - Migration options
 * @returns Migration statistics
 *
 * @example
 * ```typescript
 * // Dry run
 * const stats = await migrateAddonPurchases({ dryRun: true });
 * console.log(`Would migrate ${stats.addonsMigrated} addon purchases`);
 *
 * // Execute migration
 * const stats = await migrateAddonPurchases({ dryRun: false, verbose: true });
 * console.log(`Migrated ${stats.addonsMigrated} addon purchases`);
 * ```
 */
export async function migrateAddonPurchases(input: MigrationOptions = {}): Promise<MigrationStats> {
    const { dryRun = false, verbose = false } = input;

    const stats: MigrationStats = {
        subscriptionsProcessed: 0,
        addonsFound: 0,
        addonsMigrated: 0,
        addonsSkipped: 0,
        errors: []
    };

    const db = getDb();

    try {
        // Fetch all subscriptions
        const subscriptions = await db
            .select({
                id: billingSubscriptions.id,
                customerId: billingSubscriptions.customerId,
                metadata: billingSubscriptions.metadata
            })
            .from(billingSubscriptions);

        logger.info(
            { count: subscriptions.length, dryRun },
            `Found ${subscriptions.length} total subscriptions`
        );

        // Process each subscription
        for (const subscription of subscriptions) {
            stats.subscriptionsProcessed++;

            try {
                // Extract addonAdjustments from metadata
                const metadata = subscription.metadata as Record<string, unknown> | null;
                const addonAdjustmentsJson = metadata?.addonAdjustments as string | undefined;

                if (!addonAdjustmentsJson) {
                    if (verbose) {
                        logger.debug(
                            { subscriptionId: subscription.id },
                            'No addonAdjustments found'
                        );
                    }
                    continue;
                }

                // Parse JSON
                let adjustments: AddonAdjustment[] = [];
                try {
                    adjustments = JSON.parse(addonAdjustmentsJson);
                    if (!Array.isArray(adjustments)) {
                        throw new Error('addonAdjustments is not an array');
                    }
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    stats.errors.push({
                        subscriptionId: subscription.id,
                        error: `Failed to parse addonAdjustments: ${errorMessage}`
                    });
                    logger.error(
                        { subscriptionId: subscription.id, error: errorMessage },
                        'Invalid JSON in addonAdjustments'
                    );
                    continue;
                }

                if (verbose) {
                    logger.debug(
                        { subscriptionId: subscription.id, count: adjustments.length },
                        `Found ${adjustments.length} addon adjustments`
                    );
                }

                stats.addonsFound += adjustments.length;

                // Process each adjustment
                for (const adjustment of adjustments) {
                    try {
                        // Get addon definition to calculate expires_at
                        const addonDef = getAddonBySlug(adjustment.addonSlug);

                        // Build limit adjustments array
                        const limitAdjustments: LimitAdjustment[] = [];
                        if (adjustment.limitKey && adjustment.limitIncrease) {
                            limitAdjustments.push({
                                limitKey: adjustment.limitKey,
                                increase: adjustment.limitIncrease,
                                previousValue: 0, // Unknown from old data
                                newValue: adjustment.limitIncrease // Approximation
                            });
                        }

                        // Build entitlement adjustments array
                        const entitlementAdjustments: EntitlementAdjustment[] = [];
                        if (adjustment.entitlement) {
                            entitlementAdjustments.push({
                                entitlementKey: adjustment.entitlement,
                                granted: true
                            });
                        }

                        // Calculate expires_at from addon config
                        let expiresAt: Date | null = null;
                        if (addonDef?.durationDays) {
                            const purchasedAt = new Date(adjustment.appliedAt);
                            expiresAt = new Date(purchasedAt);
                            expiresAt.setDate(expiresAt.getDate() + addonDef.durationDays);
                        }

                        if (dryRun) {
                            // Dry run: just log what would be inserted
                            if (verbose) {
                                logger.info(
                                    {
                                        customerId: subscription.customerId,
                                        subscriptionId: subscription.id,
                                        addonSlug: adjustment.addonSlug,
                                        status: 'active',
                                        purchasedAt: adjustment.appliedAt,
                                        expiresAt,
                                        limitAdjustments,
                                        entitlementAdjustments
                                    },
                                    '[DRY RUN] Would insert addon purchase'
                                );
                            }
                            stats.addonsMigrated++;
                        } else {
                            // Check if this addon purchase already exists
                            const existing = await db
                                .select({ id: billingAddonPurchases.id })
                                .from(billingAddonPurchases)
                                .where(
                                    sql`${billingAddonPurchases.customerId} = ${subscription.customerId}
                                        AND ${billingAddonPurchases.subscriptionId} = ${subscription.id}
                                        AND ${billingAddonPurchases.addonSlug} = ${adjustment.addonSlug}
                                        AND ${billingAddonPurchases.purchasedAt} = ${adjustment.appliedAt}`
                                )
                                .limit(1);

                            if (existing.length > 0) {
                                if (verbose) {
                                    logger.debug(
                                        {
                                            subscriptionId: subscription.id,
                                            addonSlug: adjustment.addonSlug
                                        },
                                        'Already exists, skipping'
                                    );
                                }
                                stats.addonsSkipped++;
                                continue;
                            }

                            // Insert new addon purchase
                            await db.insert(billingAddonPurchases).values({
                                customerId: subscription.customerId,
                                subscriptionId: subscription.id,
                                addonSlug: adjustment.addonSlug,
                                status: 'active',
                                purchasedAt: new Date(adjustment.appliedAt),
                                expiresAt,
                                limitAdjustments,
                                entitlementAdjustments,
                                metadata: { migratedFrom: 'subscription_metadata' }
                            });

                            if (verbose) {
                                logger.info(
                                    {
                                        subscriptionId: subscription.id,
                                        addonSlug: adjustment.addonSlug,
                                        expiresAt
                                    },
                                    'Migrated successfully'
                                );
                            }
                            stats.addonsMigrated++;
                        }
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        stats.errors.push({
                            subscriptionId: subscription.id,
                            error: `Failed to migrate addon ${adjustment.addonSlug}: ${errorMessage}`
                        });
                        logger.error(
                            {
                                subscriptionId: subscription.id,
                                addonSlug: adjustment.addonSlug,
                                error: errorMessage
                            },
                            'Failed to migrate addon'
                        );
                    }
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                stats.errors.push({
                    subscriptionId: subscription.id,
                    error: `Failed to process subscription: ${errorMessage}`
                });
                logger.error(
                    { subscriptionId: subscription.id, error: errorMessage },
                    'Failed to process subscription'
                );
            }
        }

        logger.info(
            {
                subscriptionsProcessed: stats.subscriptionsProcessed,
                addonsFound: stats.addonsFound,
                addonsMigrated: stats.addonsMigrated,
                addonsSkipped: stats.addonsSkipped,
                errors: stats.errors.length
            },
            'Migration completed'
        );

        return stats;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error({ error: errorMessage }, 'Migration failed');
        throw error;
    }
}

/**
 * CLI entry point
 */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const verbose = args.includes('--verbose') || args.includes('-v');

    try {
        const stats = await migrateAddonPurchases({ dryRun, verbose });

        if (stats.errors.length > 0) {
            for (const _error of stats.errors) {
            }
        }

        if (dryRun) {
        }

        process.exit(stats.errors.length > 0 ? 1 : 0);
    } catch (error) {
        console.error('');
        console.error('FATAL ERROR:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// Run CLI if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    void main();
}
