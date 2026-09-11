/**
 * Addon Expiration .. Database Query Functions
 *
 * Extracted from addon-expiration.service.ts to keep that module under 500 lines.
 * Contains all Drizzle query functions and related JSONB parsing utilities for
 * expired and expiring addon purchases.
 *
 * @module services/addon-expiration.queries
 */

import type { QueryContext } from '@repo/db';
import { getDb } from '@repo/db';
import { billingAddonPurchases } from '@repo/db/schemas';
import { and, eq, gte, isNotNull, isNull, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import type { ServiceResult } from './addon.types.js';

// ─── Batch size constant (GAP-043-015) ────────────────────────────────────────

/**
 * Maximum number of addon purchases returned by a single expiry query.
 * Prevents unbounded memory usage in the cron job when many addons expire
 * at the same time. The cron job runs again on the next tick to continue.
 */
export const BATCH_SIZE = 100;

// ─── Re-exported types ────────────────────────────────────────────────────────

/**
 * Expired add-on purchase.
 * Represents an active add-on that has passed its expiration date.
 */
export interface ExpiredAddon {
    id: string;
    customerId: string;
    subscriptionId: string | null;
    addonSlug: string;
    purchasedAt: Date;
    expiresAt: Date;
    limitAdjustments: Array<{
        limitKey: string;
        increase: number;
        previousValue: number;
        newValue: number;
    }>;
    entitlementAdjustments: Array<{
        entitlementKey: string;
        granted: boolean;
    }>;
}

/**
 * Expiring add-on purchase.
 * Represents an active add-on that will expire within the specified time window.
 */
export interface ExpiringAddon {
    id: string;
    customerId: string;
    subscriptionId: string | null;
    addonSlug: string;
    purchasedAt: Date;
    expiresAt: Date;
    daysUntilExpiration: number;
    limitAdjustments: Array<{
        limitKey: string;
        increase: number;
        previousValue: number;
        newValue: number;
    }>;
    entitlementAdjustments: Array<{
        entitlementKey: string;
        granted: boolean;
    }>;
}

/**
 * Input for finding expiring add-ons.
 */
export interface FindExpiringAddonsInput {
    /** Number of days ahead to check for expiration (positive integer, max 365). */
    daysAhead: number;
}

// ─── Zod schemas for JSONB parsing ────────────────────────────────────────────

const LimitAdjustmentSchema = z.object({
    limitKey: z.string(),
    increase: z.number(),
    previousValue: z.number(),
    newValue: z.number()
});

const EntitlementAdjustmentSchema = z.object({
    entitlementKey: z.string(),
    granted: z.boolean()
});

const LimitAdjustmentsSchema = z.array(LimitAdjustmentSchema).nullable();
const EntitlementAdjustmentsSchema = z.array(EntitlementAdjustmentSchema).nullable();

/**
 * Zod schema for validating the `daysAhead` parameter.
 * Must be a positive integer no greater than 365.
 */
export const daysAheadSchema = z
    .number()
    .int({ message: 'daysAhead must be an integer' })
    .positive({ message: 'daysAhead must be a positive number' })
    .max(365, { message: 'daysAhead must not exceed 365' });

// ─── JSONB parsing helpers ────────────────────────────────────────────────────

/**
 * Safely parses JSONB limit adjustments from the database.
 * Returns an empty array if validation fails.
 *
 * @param raw - Raw value from the database JSONB column
 * @param _context - Purchase identifiers for structured log context (reserved for future use)
 * @returns Parsed limit adjustments or empty array on failure
 */
export function parseLimitAdjustments(
    raw: unknown,
    _context: { purchaseId: string; addonSlug: string }
): Array<{ limitKey: string; increase: number; previousValue: number; newValue: number }> {
    const result = LimitAdjustmentsSchema.safeParse(raw);
    if (result.success) {
        return result.data ?? [];
    }
    return [];
}

/**
 * Safely parses JSONB entitlement adjustments from the database.
 * Returns an empty array if validation fails.
 *
 * @param raw - Raw value from the database JSONB column
 * @param _context - Purchase identifiers for structured log context (reserved for future use)
 * @returns Parsed entitlement adjustments or empty array on failure
 */
export function parseEntitlementAdjustments(
    raw: unknown,
    _context: { purchaseId: string; addonSlug: string }
): Array<{ entitlementKey: string; granted: boolean }> {
    const result = EntitlementAdjustmentsSchema.safeParse(raw);
    if (result.success) {
        return result.data ?? [];
    }
    return [];
}

// ─── Query functions ──────────────────────────────────────────────────────────

/**
 * Queries `billing_addon_purchases` for records that are due to be revoked:
 * `status = 'active'`, `deleted_at IS NULL`, and EITHER
 *
 * - `expires_at IS NOT NULL AND expires_at <= now()` — a one-time add-on that
 *   ran out; or
 * - `cancel_at_period_end = true AND current_period_end IS NOT NULL AND
 *   current_period_end <= now()` — a RECURRING add-on the customer cancelled,
 *   whose already-paid period has now ended (HOS-847 PR 6).
 *
 * ### `cancel_at_period_end` is load-bearing, not decoration
 *
 * Expiring a row REVOKES the customer's entitlement and limit. A live recurring
 * add-on that is still being charged legitimately has a `current_period_end` in
 * the past whenever its renewal webhook is late — the charge lands, then the
 * period advances. Matching on the date ALONE would therefore revoke a paying
 * customer's add-on every time MercadoPago was slow. Only a row whose owner
 * asked for the cancellation may be swept, which is exactly what the flag says.
 *
 * A recurring row is never both: `expires_at` stays null on it, so the two
 * branches of the OR are disjoint in practice and a row is returned once.
 *
 * Limited to {@link BATCH_SIZE} rows per call (GAP-043-015). The cron job runs
 * again on the next tick to continue processing remaining rows.
 *
 * @remarks
 * **Obligation for PR 7's reconciler**: an `active` row with
 * `cancel_at_period_end = true` whose `current_period_end` is well past is a
 * benefit nobody is paying for. Its preapproval was already hard-cancelled at
 * cancellation time, so no charge will ever arrive to correct it, and this query
 * is the ONLY thing that looks at that pair. If the cron stops running, nothing
 * else notices.
 *
 * @param ctx - Optional query context. When `ctx.tx` is present, the query runs
 *   inside that transaction; otherwise the default connection is used.
 * @returns Service result with a list of expired add-ons, or an error descriptor.
 *
 * @example
 * ```ts
 * // Without transaction
 * const result = await findExpiredAddons();
 *
 * // Inside a transaction
 * const result = await findExpiredAddons(ctx);
 * if (result.success) {
 *   for (const addon of result.data) { ... }
 * }
 * ```
 */
export async function findExpiredAddons(
    ctx?: QueryContext
): Promise<ServiceResult<ExpiredAddon[]>> {
    try {
        const db = ctx?.tx ?? getDb();
        const now = new Date();

        const rawResults = await db
            .select()
            .from(billingAddonPurchases)
            .where(
                and(
                    eq(billingAddonPurchases.status, 'active'),
                    isNull(billingAddonPurchases.deletedAt),
                    or(
                        // One-time add-on that ran out.
                        and(
                            isNotNull(billingAddonPurchases.expiresAt),
                            lte(billingAddonPurchases.expiresAt, now)
                        ),
                        // HOS-847 PR 6: recurring add-on the customer cancelled,
                        // now past the period they paid for. The flag is what
                        // keeps a merely-late renewal out of this sweep.
                        and(
                            eq(billingAddonPurchases.cancelAtPeriodEnd, true),
                            isNotNull(billingAddonPurchases.currentPeriodEnd),
                            lte(billingAddonPurchases.currentPeriodEnd, now)
                        )
                    )
                )
            );

        // Apply batch size limit (GAP-043-015): cap at BATCH_SIZE to prevent
        // unbounded memory usage in the cron job. Remaining rows are processed
        // on the next cron tick.
        const expiredPurchases = rawResults.slice(0, BATCH_SIZE);

        const expiredAddons: ExpiredAddon[] = expiredPurchases.map((purchase) => {
            // HOS-847 PR 6: a soft-cancelled recurring row has a null
            // `expires_at`; its end date is `current_period_end`, which the WHERE
            // clause above guarantees is non-null on exactly those rows. The
            // final `new Date()` is unreachable for anything this query returns
            // and is kept only so the field stays non-nullable for consumers.
            const expiresAt = purchase.expiresAt ?? purchase.currentPeriodEnd ?? new Date();
            const parseContext = { purchaseId: purchase.id, addonSlug: purchase.addonSlug };

            return {
                id: purchase.id,
                customerId: purchase.customerId,
                subscriptionId: purchase.subscriptionId,
                addonSlug: purchase.addonSlug,
                purchasedAt: purchase.purchasedAt,
                expiresAt,
                limitAdjustments: parseLimitAdjustments(purchase.limitAdjustments, parseContext),
                entitlementAdjustments: parseEntitlementAdjustments(
                    purchase.entitlementAdjustments,
                    parseContext
                )
            };
        });

        return { success: true, data: expiredAddons };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: `Failed to find expired add-ons: ${errorMessage}`
            }
        };
    }
}

/**
 * Queries `billing_addon_purchases` for records where:
 * - `status = 'active'`
 * - `expires_at IS NOT NULL`
 * - `expires_at > now()`
 * - `expires_at <= now() + N days`
 * - `deleted_at IS NULL`
 *
 * Useful for sending notification reminders before expiration.
 * Limited to {@link BATCH_SIZE} rows per call (GAP-043-015).
 *
 * @param input - Configuration with `daysAhead` (validated by {@link daysAheadSchema}).
 * @param ctx - Optional query context. When `ctx.tx` is present, the query runs
 *   inside that transaction; otherwise the default connection is used.
 * @returns Service result with a list of expiring add-ons, or an error descriptor.
 */
export async function findExpiringAddons(
    input: FindExpiringAddonsInput,
    ctx?: QueryContext
): Promise<ServiceResult<ExpiringAddon[]>> {
    const validationResult = daysAheadSchema.safeParse(input.daysAhead);

    if (!validationResult.success) {
        const message = validationResult.error.issues[0]?.message ?? 'Invalid daysAhead value';
        return { success: false, error: { code: 'INVALID_INPUT', message } };
    }

    try {
        const db = ctx?.tx ?? getDb();
        const now = new Date();
        const futureDate = new Date(now.getTime() + input.daysAhead * 24 * 60 * 60 * 1000);

        const rawResults = await db
            .select()
            .from(billingAddonPurchases)
            .where(
                and(
                    eq(billingAddonPurchases.status, 'active'),
                    isNotNull(billingAddonPurchases.expiresAt),
                    gte(billingAddonPurchases.expiresAt, now),
                    lte(billingAddonPurchases.expiresAt, futureDate),
                    isNull(billingAddonPurchases.deletedAt)
                )
            );

        // Apply batch size limit (GAP-043-015)
        const expiringPurchases = rawResults.slice(0, BATCH_SIZE);

        const expiringAddons: ExpiringAddon[] = expiringPurchases.map((purchase) => {
            const expiresAt = purchase.expiresAt ?? new Date();
            const daysUntilExpiration = Math.ceil(
                (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
            );
            const parseContext = { purchaseId: purchase.id, addonSlug: purchase.addonSlug };

            return {
                id: purchase.id,
                customerId: purchase.customerId,
                subscriptionId: purchase.subscriptionId,
                addonSlug: purchase.addonSlug,
                purchasedAt: purchase.purchasedAt,
                expiresAt,
                daysUntilExpiration,
                limitAdjustments: parseLimitAdjustments(purchase.limitAdjustments, parseContext),
                entitlementAdjustments: parseEntitlementAdjustments(
                    purchase.entitlementAdjustments,
                    parseContext
                )
            };
        });

        return { success: true, data: expiringAddons };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: `Failed to find expiring add-ons: ${errorMessage}`
            }
        };
    }
}
