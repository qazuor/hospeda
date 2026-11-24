/**
 * Spanish label of a reconciliation reason code, for the billing staff mails
 * (HOS-2565 D8).
 *
 * The admin already shows these labels (`admin-billing.reconciliationMarks.reasons.*`),
 * so the mails read the same catalog instead of copying it. `@repo/notifications`
 * does not depend on `@repo/i18n`: it receives this function as a port.
 *
 * @module utils/reconciliation-summary/reconciliation-reason-label
 */

import { trans } from '@repo/i18n';
import type { ReconciliationReasonLabelResolver } from '@repo/notifications';

/** Key prefix of the reason labels inside the flattened Spanish catalog. */
const REASON_KEY_PREFIX = 'admin-billing.reconciliationMarks.reasons.';

/**
 * Resolves a reconciliation reason code to its Spanish label.
 *
 * @param input.reason - The stored reason code, e.g. `COBRO_DUPLICADO`
 * @returns The label, or `null` when the code is not in the catalog
 *
 * @example
 * ```ts
 * resolveReconciliationReasonLabel({ reason: 'COBRO_DUPLICADO' }) // "Cobro duplicado"
 * resolveReconciliationReasonLabel({ reason: 'ALGO_NUEVO' })      // null
 * ```
 */
export const resolveReconciliationReasonLabel: ReconciliationReasonLabelResolver = ({ reason }) => {
    const label = trans.es?.[`${REASON_KEY_PREFIX}${reason}`];
    return typeof label === 'string' && label.trim() !== '' ? label : null;
};
