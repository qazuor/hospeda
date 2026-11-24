import { reconciliationReasonCopy } from './reconciliation-summary-enrichment.js';

/**
 * Spanish labels shared by the reconciliation summary and the immediate staff
 * notices (HOS-2565 §7.2). A staff reader never sees a raw enum value: every
 * value maps to words here, and an unknown value renders as received so the
 * information stays visible.
 *
 * @module templates/billing/reconciliation-labels
 */

/** Kind of record a reconciliation mark or refund points at. */
export type ReconciliationSubjectType = 'subscription' | 'addon_instance';

/**
 * Resolves a reconciliation reason code to a Spanish label, or `null` when
 * unknown (HOS-2565 D8). Injected by `apps/api`, which reads the admin's own
 * labels; this package does not depend on `@repo/i18n`.
 */
export type ReconciliationReasonLabelResolver = (input: {
    readonly reason: string;
}) => string | null;

/** Plain-words name of each subject type. */
export const SUBJECT_TYPE_LABELS: Readonly<Record<ReconciliationSubjectType, string>> = {
    subscription: 'Suscripción',
    addon_instance: 'Complemento'
};

/** Plain-words name of each refund reason (RF1). Email-only: the admin shows none. */
export const REFUND_REASON_LABELS: Readonly<Record<string, string>> = {
    REVOCATION: 'Revocación',
    ADDON_ORPHAN: 'Complemento sin suscripción',
    ONE_TIME_ADDON_REVOCATION: 'Revocación de complemento único'
};

/** Plain-words name of each payment source kind. Email-only. */
export const REFUND_SOURCE_KIND_LABELS: Readonly<Record<string, string>> = {
    payment: 'Pago con Mercado Pago',
    manual_payment: 'Pago manual'
};

/** Looks a value up in a label map, echoing the value when the map lacks it. */
function labelOrRaw(map: Readonly<Record<string, string>>, value: string): string {
    return Object.hasOwn(map, value) ? (map[value] as string) : value;
}

/**
 * Label of a subject type ("Suscripción" or "Complemento").
 *
 * @param subjectType - The stored subject type
 * @returns The Spanish label, or the value itself when unknown
 */
export function subjectTypeLabel(subjectType: string): string {
    return labelOrRaw(SUBJECT_TYPE_LABELS, subjectType);
}

/**
 * Label of a refund reason (`REVOCATION`, `ADDON_ORPHAN`, `ONE_TIME_ADDON_REVOCATION`).
 *
 * @param refundReason - The stored refund reason
 * @returns The Spanish label, or the value itself when unknown
 */
export function refundReasonLabel(refundReason: string): string {
    return labelOrRaw(REFUND_REASON_LABELS, refundReason);
}

/**
 * Label of a refund's payment source kind.
 *
 * @param sourceKind - The stored source kind
 * @returns The Spanish label, or the value itself when unknown
 */
export function refundSourceKindLabel(sourceKind: string): string {
    return labelOrRaw(REFUND_SOURCE_KIND_LABELS, sourceKind);
}

/**
 * Spanish label of a reconciliation reason code.
 *
 * Order: the injected resolver (the admin's own wording, D8), then the copy
 * this package already carries for the summary mail, then the raw code. The
 * raw code is the last resort, shown in the "Motivo" row only.
 *
 * @param input.reason - The stored reason code
 * @param input.resolve - Optional resolver injected by `apps/api`
 * @returns A label, never an empty string
 *
 * @example
 * ```ts
 * resolveReasonLabel({ reason: 'COBRO_DUPLICADO' }) // "Cobro duplicado"
 * resolveReasonLabel({ reason: 'ALGO_NUEVO' })      // "ALGO_NUEVO"
 * ```
 */
export function resolveReasonLabel(input: {
    readonly reason: string;
    readonly resolve?: ReconciliationReasonLabelResolver | undefined;
}): string {
    return (
        input.resolve?.({ reason: input.reason }) ??
        reconciliationReasonCopy(input.reason)?.label ??
        input.reason
    );
}
