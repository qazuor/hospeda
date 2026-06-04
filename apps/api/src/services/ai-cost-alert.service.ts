/**
 * AI Cost Threshold Alert Service (SPEC-173 T-025).
 *
 * Provides a factory function that creates the `onThresholdAlert` hook wired
 * into `checkCostCeiling`.  The returned hook is fire-and-forget from the
 * engine's perspective: it is called synchronously by the engine but internally
 * enqueues async work so it never blocks the AI call and never throws.
 *
 * ## De-duplication
 *
 * The hook queries `billing_notification_log` for an existing record with the
 * same `idempotencyKey` (monthly granularity: `ai_cost_alert:<scope>:<feature>:<pct>:<period>`).
 * If a record is found, the notification is skipped silently.  This ensures
 * at-most-one alert per (scope × feature × thresholdPct × period) combination,
 * satisfying AC-8 of SPEC-173 T-025.
 *
 * ## AC-4 isolation
 *
 * This file lives in `apps/api`, NOT in `packages/ai-core`.  The ai-core
 * package declares only the hook type (`ThresholdAlertHook`) and invokes it;
 * this file owns the send + de-dup implementation that pulls from
 * `@repo/notifications` and `@repo/db`.
 *
 * Decision (owner-approved 2026-06-04): dedicated `AI_COST_THRESHOLD_ALERT`
 * NotificationType instead of reusing `ADMIN_SYSTEM_EVENT`.
 *
 * @module services/ai-cost-alert
 */

import type { ThresholdAlertHook, ThresholdAlertInput } from '@repo/ai-core';
import { billingNotificationLog, getDb } from '@repo/db';
import { NotificationType } from '@repo/notifications';
import { and, eq, sql } from 'drizzle-orm';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';
import { sendNotification } from '../utils/notification-helper.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Builds the monthly-granularity idempotency key for a cost threshold alert.
 *
 * Format: `ai_cost_alert:<scope>:<featureOrGlobal>:<thresholdPct>:<period>`
 *
 * Examples:
 * - `ai_cost_alert:global:global:80:2026-06`
 * - `ai_cost_alert:feature:chat:50:2026-06`
 *
 * @param input - The threshold alert input from the ai-core hook.
 * @returns Idempotency key string.
 */
function buildIdempotencyKey(input: ThresholdAlertInput): string {
    const featureSegment = input.scope === 'feature' ? (input.feature ?? 'unknown') : 'global';
    return `ai_cost_alert:${input.scope}:${featureSegment}:${input.thresholdPct}:${input.period}`;
}

/**
 * Checks whether an alert with the given idempotency key has already been sent
 * by querying `billing_notification_log`.
 *
 * Returns `true` when a record is found (de-dup hit); `false` otherwise.
 * On query failure, returns `false` (allow-through on error to avoid missing
 * a critical alert).
 *
 * @param idempotencyKey - The key to look up in the notification log.
 * @returns Whether the notification was already sent.
 */
async function wasAlertSent(idempotencyKey: string): Promise<boolean> {
    try {
        const db = getDb();
        const existing = await db
            .select({ id: billingNotificationLog.id })
            .from(billingNotificationLog)
            .where(
                and(
                    eq(billingNotificationLog.type, NotificationType.AI_COST_THRESHOLD_ALERT),
                    eq(
                        sql<string>`${billingNotificationLog.metadata}->>'idempotencyKey'`,
                        idempotencyKey
                    )
                )
            )
            .limit(1);

        return existing.length > 0;
    } catch (error) {
        apiLogger.warn(
            {
                idempotencyKey,
                error: error instanceof Error ? error.message : String(error)
            },
            'ai-cost-alert: failed to check notification log, allowing send to avoid missing alert'
        );
        return false;
    }
}

/**
 * Handles a single threshold alert: de-duplicates via `billing_notification_log`
 * and sends to all configured admin emails.
 *
 * Failures are caught and logged — this function must never throw.
 *
 * @param input - The threshold alert input received from ai-core.
 */
async function handleAlert(input: ThresholdAlertInput): Promise<void> {
    try {
        const idempotencyKey = buildIdempotencyKey(input);

        // 1. De-dup check: skip if already sent for this (scope × pct × period).
        const alreadySent = await wasAlertSent(idempotencyKey);
        if (alreadySent) {
            apiLogger.debug(
                { idempotencyKey },
                'ai-cost-alert: skipping duplicate threshold alert (already sent this month)'
            );
            return;
        }

        // 2. Resolve admin email list from env.
        const rawEmails = env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS ?? '';
        const adminEmails = rawEmails
            .split(',')
            .map((e) => e.trim())
            .filter((e) => e.length > 0);

        if (adminEmails.length === 0) {
            apiLogger.debug(
                { idempotencyKey },
                'ai-cost-alert: no HOSPEDA_ADMIN_NOTIFICATION_EMAILS configured, skipping alert'
            );
            return;
        }

        // 3. Send to each admin email (fire-and-forget per recipient).
        for (const recipientEmail of adminEmails) {
            await sendNotification({
                type: NotificationType.AI_COST_THRESHOLD_ALERT,
                recipientEmail,
                recipientName: 'Admin',
                userId: null,
                idempotencyKey,
                scope: input.scope,
                feature: input.feature,
                thresholdPct: input.thresholdPct,
                spentMicroUsd: input.spentMicroUsd,
                ceilingMicroUsd: input.ceilingMicroUsd,
                period: input.period
            }).catch((notifError) => {
                apiLogger.warn(
                    {
                        idempotencyKey,
                        recipientEmail,
                        error: notifError instanceof Error ? notifError.message : String(notifError)
                    },
                    'ai-cost-alert: failed to send threshold alert notification (non-fatal)'
                );
            });
        }

        apiLogger.info(
            {
                idempotencyKey,
                scope: input.scope,
                feature: input.feature,
                thresholdPct: input.thresholdPct,
                period: input.period,
                recipientCount: adminEmails.length
            },
            'ai-cost-alert: threshold alert sent to admin recipients'
        );
    } catch (error) {
        // Best-effort: swallow all errors so the engine call is never affected.
        apiLogger.error(
            {
                scope: input.scope,
                feature: input.feature,
                thresholdPct: input.thresholdPct,
                period: input.period,
                error: error instanceof Error ? error.message : String(error)
            },
            'ai-cost-alert: unexpected error in handleAlert (non-fatal, swallowed)'
        );
    }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates the fire-and-forget `onThresholdAlert` hook to pass into
 * `checkCostCeiling`.
 *
 * The returned function is SYNCHRONOUS from the engine's perspective (matches
 * the `ThresholdAlertHook` contract).  Internally it enqueues async work via
 * `void handleAlert(input)` and never throws.
 *
 * ## Usage
 *
 * ```ts
 * // In the T-019 engine wiring:
 * const alertHook = createAiCostThresholdAlertHook();
 *
 * await checkCostCeiling({
 *   feature,
 *   now: requestTimestamp,
 *   onThresholdAlert: alertHook
 * });
 * ```
 *
 * ## De-duplication
 *
 * At most one email per (scope × feature × thresholdPct × period) is sent,
 * enforced by a `billing_notification_log` idempotency-key lookup.
 *
 * @returns A `ThresholdAlertHook` suitable for use as `onThresholdAlert` in
 *   `CheckCostCeilingInput`.
 */
export function createAiCostThresholdAlertHook(): ThresholdAlertHook {
    return (input: ThresholdAlertInput): void => {
        // Enqueue async work without awaiting — fire-and-forget per the engine contract.
        void handleAlert(input);
    };
}
