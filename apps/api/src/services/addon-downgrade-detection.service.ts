/**
 * Addon Downgrade Detection Service
 *
 * Handles detection of per-limit-key downgrades after a plan change (AC-4.1–4.4)
 * and dispatches `PLAN_DOWNGRADE_LIMIT_WARNING` notifications when current usage
 * exceeds the new (lower) combined limit.
 *
 * Extracted from addon-plan-change.service.ts to keep that module under 500 lines.
 *
 * ### What this module does
 * - Resolves customer contact info from QZPay (once per call, shared across keys).
 * - For each successfully recalculated key where `newMaxValue < oldMaxValue`:
 *   - Checks current usage via `billing.limits.check`.
 *   - If usage exceeds the new limit: fires a `PLAN_DOWNGRADE_LIMIT_WARNING`
 *     notification (fire-and-forget) and reports to Sentry via `captureMessage`.
 *
 * ### What this module does NOT do
 * - It does NOT apply limits — that is done before this module is called.
 * - It does NOT block the caller on notification delivery failures.
 *
 * @module services/addon-downgrade-detection
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import type { PlanDefinition } from '@repo/billing';
import { NotificationType } from '@repo/notifications';
import * as Sentry from '@sentry/node';
import { apiLogger } from '../utils/logger.js';
import { sendNotification } from '../utils/notification-helper.js';
import type { RecalculationResult } from './addon-limit-recalculation.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Input for the downgrade detection and notification dispatch step.
 */
export interface DetectAndNotifyDowngradesInput {
    /** Billing customer UUID. */
    customerId: string;
    /** Recalculation results from the main plan-change flow. */
    recalculations: readonly RecalculationResult[];
    /** Initialized QZPay billing instance (used to check usage + resolve customer). */
    billing: QZPayBilling;
    /** New plan definition (for human-readable plan name in the notification). */
    newPlanDef: PlanDefinition;
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * Detects per-limit-key downgrades in a plan change result and dispatches
 * `PLAN_DOWNGRADE_LIMIT_WARNING` notifications for keys where usage exceeds
 * the new (lower) limit (AC-4.1–4.4).
 *
 * This function is called after all limits have been applied. It is
 * fire-and-forget from the caller's perspective — notification failures do
 * not propagate.
 *
 * @param input - Customer ID, recalculations, billing client, and new plan def.
 * @returns Void — notifications are dispatched asynchronously.
 *
 * @example
 * ```ts
 * await detectAndNotifyDowngrades({
 *   customerId: 'cust-uuid',
 *   recalculations,
 *   billing,
 *   newPlanDef,
 * });
 * ```
 */
export async function detectAndNotifyDowngrades(
    input: DetectAndNotifyDowngradesInput
): Promise<void> {
    const { customerId, recalculations, billing, newPlanDef } = input;

    const downgradedKeys = recalculations.filter(
        (r) => r.outcome === 'success' && r.newMaxValue < r.oldMaxValue
    );

    if (downgradedKeys.length === 0) {
        return;
    }

    // Resolve customer contact info once for all downgraded keys.
    // If lookup fails, we skip notifications but do not block the operation.
    let customerEmail: string | null = null;
    let customerName: string | null = null;
    let customerUserId: string | null = null;

    try {
        const customer = await billing.customers.get(customerId);

        if (customer) {
            customerEmail = customer.email;
            customerName = String(customer.metadata?.name ?? customer.email);
            customerUserId =
                typeof customer.metadata?.userId === 'string' ? customer.metadata.userId : null;
        } else {
            apiLogger.warn(
                { customerId },
                'Customer not found when resolving contact info for downgrade notifications'
            );
        }
    } catch (customerErr) {
        const msg = customerErr instanceof Error ? customerErr.message : String(customerErr);
        apiLogger.warn(
            { customerId, error: msg },
            'Could not resolve customer contact info for downgrade notifications; skipping all downgrade warnings'
        );
    }

    for (const recalc of downgradedKeys) {
        const { limitKey, oldMaxValue, newMaxValue } = recalc;

        // AC-4.1: check current usage for this limitKey
        let currentValue: number;

        try {
            const usage = await billing.limits.check(customerId, limitKey);
            currentValue = usage.currentValue;
        } catch (usageErr) {
            const msg = usageErr instanceof Error ? usageErr.message : String(usageErr);
            // AC-4.4: log warning, skip notification, continue to next key
            apiLogger.warn(
                { customerId, limitKey, error: msg },
                `Could not read current usage for ${limitKey}, skipping downgrade warning check`
            );
            continue;
        }

        // AC-4.2: no notification needed when usage is within the new limit
        if (currentValue <= newMaxValue) {
            apiLogger.debug(
                { customerId, limitKey, currentValue, newMaxValue },
                'Current usage within new limit after downgrade; no notification needed'
            );
            continue;
        }

        // AC-4.3: usage exceeds new limit — notify and report to Sentry

        // AC-4.3-b: report to Sentry (captureMessage, not captureException — expected behavior)
        Sentry.captureMessage(
            `Plan downgrade limit exceeded for customer ${customerId} on limitKey '${limitKey}'`,
            {
                level: 'warning',
                tags: {
                    subsystem: 'billing-addon-lifecycle',
                    action: 'plan_downgrade_limit_exceeded'
                },
                extra: {
                    customerId,
                    limitKey,
                    oldLimit: oldMaxValue,
                    newLimit: newMaxValue,
                    currentUsage: currentValue
                }
            }
        );

        // AC-4.3-c: structured log
        apiLogger.warn(
            {
                eventType: 'plan_downgrade_limit_exceeded',
                customerId,
                limitKey,
                oldLimit: oldMaxValue,
                newLimit: newMaxValue,
                currentUsage: currentValue
            },
            'Customer usage exceeds new limit after plan downgrade'
        );

        // AC-4.3-a: dispatch notification (fire-and-forget)
        if (customerEmail !== null) {
            try {
                void sendNotification({
                    type: NotificationType.PLAN_DOWNGRADE_LIMIT_WARNING,
                    recipientEmail: customerEmail,
                    recipientName: customerName ?? customerEmail,
                    userId: customerUserId,
                    customerId,
                    limitKey,
                    oldLimit: oldMaxValue,
                    newLimit: newMaxValue,
                    currentUsage: currentValue,
                    planName: newPlanDef.name,
                    idempotencyKey: `plan_downgrade_limit_warning:${customerId}:${limitKey}:${new Date().toISOString().slice(0, 10)}`
                }).catch((notifyErr: unknown) => {
                    const errMsg =
                        notifyErr instanceof Error ? notifyErr.message : String(notifyErr);
                    apiLogger.warn(
                        { customerId, limitKey, error: errMsg },
                        'Downgrade limit warning notification dispatch failed (non-blocking)'
                    );
                });
            } catch (syncErr) {
                apiLogger.warn({ err: syncErr }, 'Sync error dispatching notification');
            }
        }
    }
}
