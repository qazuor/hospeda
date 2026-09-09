/**
 * The operations mailboxes that receive admin alerts.
 *
 * Extracted from `lead-intake-ports.ts` (HOS-1299) when a second caller
 * appeared — the partner payment review — rather than copied. One parser for
 * one env var: a second copy would drift on the first change to how the list is
 * split, and the failure mode of that drift is an alert that reaches nobody,
 * which is silent by definition.
 *
 * @module utils/ops-recipients
 */

import { env } from './env.js';

/**
 * Resolves the operations mailboxes that receive admin alerts.
 *
 * Reads `HOSPEDA_ADMIN_NOTIFICATION_EMAILS`, the address list every other ops
 * alert already uses (payment disputes, webhook failures, AI cost thresholds).
 * A second list per alert type would create a second thing to keep set.
 *
 * @returns The trimmed, non-empty addresses. Empty when the var is unset —
 *   callers must treat that as a condition worth logging, not as "nobody needs
 *   to know".
 */
export function resolveOpsRecipients(): readonly string[] {
    return (env.HOSPEDA_ADMIN_NOTIFICATION_EMAILS ?? '')
        .split(',')
        .map((address) => address.trim())
        .filter((address) => address.length > 0);
}
