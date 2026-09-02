import type { TranslationKey } from '@repo/i18n';
import { defaultIntlLocale } from '@repo/i18n';
import {
    formatCentsToArs,
    formatDateWithTime as formatDateWithTimeHelper
} from '@/lib/format-helpers';
import type { DivergenceCandidate, OrphanQueueFlow, OrphanQueueReason } from './types';

/**
 * Formatters and small label lookups for the orphan-payment rescue screen (HOS-765).
 *
 * @module features/billing-reconciliation/utils
 */

/**
 * Format a date string with time (DD/MM/YYYY HH:mm).
 *
 * Thin wrapper over the shared helper — kept local so this feature's call
 * sites stay symmetrical with `billing-payments/utils.ts`.
 */
export function formatDate(
    date: Date | string | number | null | undefined,
    locale: string = defaultIntlLocale
): string {
    return formatDateWithTimeHelper({ date, locale });
}

/**
 * Format an ARS amount given in integer CENTAVOS.
 *
 * The name carries the unit on purpose — see `billing-payments/utils.ts`
 * `formatArsFromCents` JSDoc for why a bare `formatArs` name caused a real
 * defect in this codebase (a formatter documented as "whole units" silently
 * fed centavos).
 *
 * @example
 * ```ts
 * formatArsFromCents(1800000) // => "$ 18.000,00"
 * ```
 */
export function formatArsFromCents(
    cents: number | null | undefined,
    locale: string = defaultIntlLocale
): string {
    return formatCentsToArs({ cents, locale });
}

/**
 * Badge variant for a raw MercadoPago `status` string.
 *
 * MP statuses are free-form strings on both `payment` and `preapproval`
 * objects (not a closed enum this codebase controls), so this is a best-effort
 * classification rather than an exhaustive switch. Unrecognized statuses fall
 * back to `'outline'` rather than throwing.
 */
export function getMpStatusVariant(
    mpStatus: string
): 'success' | 'default' | 'destructive' | 'outline' {
    const normalized = mpStatus.toLowerCase();
    if (normalized === 'approved' || normalized === 'authorized') {
        return 'success';
    }
    if (
        normalized === 'rejected' ||
        normalized === 'cancelled' ||
        normalized === 'refunded' ||
        normalized === 'charged_back'
    ) {
        return 'destructive';
    }
    if (normalized === 'pending' || normalized === 'in_process' || normalized === 'in_mediation') {
        return 'default';
    }
    return 'outline';
}

/**
 * Translation key for one {@link DivergenceCandidate.matchedOn} signal.
 *
 * Falls back to the raw signal string (rendered verbatim) for a signal this
 * screen does not yet know how to label, so an unexpected value never
 * disappears — it just shows up un-translated instead of being swallowed.
 */
export function getMatchedOnLabel(signal: string, t: (key: TranslationKey) => string): string {
    const knownSignalKeys: Record<string, TranslationKey> = {
        'external-reference': 'admin-billing.reconciliation.matchedOn.externalReference',
        'payer-email': 'admin-billing.reconciliation.matchedOn.payerEmail',
        'mp-plan-id': 'admin-billing.reconciliation.matchedOn.mpPlanId',
        'preapproval-id': 'admin-billing.reconciliation.matchedOn.preapprovalId'
    };
    const key = knownSignalKeys[signal];
    return key ? t(key) : signal;
}

/**
 * Translation key + fallback label for a {@link DivergenceKind} value, used
 * on the table's "type" badge.
 */
export function getKindLabel(
    kind: 'unrecorded-payment' | 'orphan-preapproval',
    t: (key: TranslationKey) => string
): string {
    return kind === 'unrecorded-payment'
        ? t('admin-billing.reconciliation.kinds.unrecordedPayment')
        : t('admin-billing.reconciliation.kinds.orphanPreapproval');
}

/** Label for one {@link OrphanQueueFlow} value, used on the queue table. */
export function getQueueFlowLabel(
    flow: OrphanQueueFlow,
    t: (key: TranslationKey) => string
): string {
    const labels: Record<OrphanQueueFlow, TranslationKey> = {
        'plan-change-upgrade': 'admin-billing.reconciliation.queue.flows.planChangeUpgrade',
        'annual-upfront': 'admin-billing.reconciliation.queue.flows.annualUpfront',
        'addon-purchase': 'admin-billing.reconciliation.queue.flows.addonPurchase',
        'subscription-authorized-payment-retry':
            'admin-billing.reconciliation.queue.flows.authorizedPaymentRetry'
    };
    return t(labels[flow]);
}

/**
 * Label for one {@link OrphanQueueReason} value.
 *
 * The map is EXHAUSTIVE over the union rather than falling back to the raw
 * string, unlike {@link getMatchedOnLabel}. That vocabulary is MercadoPago's and
 * open; this one is ours and closed, and the API already refuses to serve a row
 * carrying anything outside it. A fallback here would be dead code pretending
 * the guard upstream might fail.
 */
export function getQueueReasonLabel(
    reason: OrphanQueueReason,
    t: (key: TranslationKey) => string
): string {
    const labels: Record<OrphanQueueReason, TranslationKey> = {
        'subscription-not-found': 'admin-billing.reconciliation.queue.reasons.subscriptionNotFound',
        'subscription-status-not-applicable':
            'admin-billing.reconciliation.queue.reasons.statusNotApplicable',
        'ledger-write-failed': 'admin-billing.reconciliation.queue.reasons.ledgerWriteFailed'
    };
    return t(labels[reason]);
}
